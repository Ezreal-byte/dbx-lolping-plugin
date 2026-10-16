use crate::{assets, audio::Audio, service::Shared, settings};
use serde_json::{json, Value};
use std::{
    borrow::Cow,
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc::SyncSender, Arc},
    time::{Duration, Instant},
};
use tao::{
    dpi::{PhysicalPosition, PhysicalSize},
    event_loop::{EventLoopProxy, EventLoopWindowTarget},
    window::{Window, WindowBuilder, WindowId},
};
use wry::{WebContext, WebView, WebViewBuilder};

pub enum UserEvent {
    Control {
        method: String,
        params: Value,
        reply: SyncSender<Result<Value, String>>,
    },
    Settings(Value, bool),
    Helper(u64, Value),
    HelperGone(u64),
    Renderer(WindowId, Value),
    Quit,
}
#[derive(Clone, PartialEq)]
pub struct Display {
    pub x: i32,
    pub y: i32,
    pub w: u32,
    pub h: u32,
    pub scale: f64,
}
impl Display {
    pub fn local(&self, x: f64, y: f64, mac: bool) -> (f64, f64) {
        if mac {
            (
                x - self.x as f64 / self.scale,
                y - self.y as f64 / self.scale,
            )
        } else {
            (
                (x - self.x as f64) / self.scale,
                (y - self.y as f64) / self.scale,
            )
        }
    }
    fn contains(&self, x: f64, y: f64) -> bool {
        let (x, y) = self.local(x, y, cfg!(target_os = "macos"));
        x >= 0. && y >= 0. && x < self.w as f64 / self.scale && y < self.h as f64 / self.scale
    }
}
struct Overlay {
    webview: WebView,
    window: Window,
    display: Display,
    ready: bool,
    pending_preview: Option<Value>,
    epoch: u64,
    visible: bool,
    idle_since: Option<Instant>,
    low_memory: bool,
    frames: HashMap<u64, Instant>,
    frame_ms: Vec<f64>,
}
impl Overlay {
    fn send(&mut self, name: &str, mut p: Value) {
        if self.ready {
            if name == "maintenance" {
                let _ = self
                    .webview
                    .evaluate_script("window.receive('maintenance',null)");
                return;
            }
            self.epoch += 1;
            if matches!(name, "wheelOpen" | "click" | "preview") {
                let dispatched = Instant::now();
                // Keep the loaded document alive: wake before dispatch, without a cold WebView rebuild.
                if self.low_memory {
                    self.memory_low(false);
                }
                self.idle_since = None;
                if !self.visible {
                    let _ = self.webview.set_visible(true);
                    self.window.set_visible(true);
                    self.visible = true;
                }
                self.window.set_always_on_top(true);
                if self.frames.len() >= 128 {
                    self.frames.clear();
                }
                self.frames.insert(self.epoch, dispatched);
            }
            if !p.is_object() {
                p = json!({});
            }
            p["_epoch"] = json!(self.epoch);
            let _ = self
                .webview
                .evaluate_script(&format!("window.receive({},{})", json!(name), p));
        }
    }
    fn idle(&mut self, epoch: u64) {
        // A delayed idle report must never hide a newer wheel or click.
        if epoch != self.epoch {
            return;
        }
        if self.visible {
            let _ = self.webview.set_visible(false);
            self.window.set_visible(false);
            self.visible = false;
        }
        self.idle_since.get_or_insert_with(Instant::now);
    }
    fn memory_low(&mut self, low: bool) {
        #[cfg(target_os = "windows")]
        {
            use wry::{MemoryUsageLevel, WebViewExtWindows};
            let _ = self.webview.set_memory_usage_level(if low {
                MemoryUsageLevel::Low
            } else {
                MemoryUsageLevel::Normal
            });
        }
        self.low_memory = low;
    }
    fn maintain(&mut self) {
        if !self.low_memory
            && self
                .idle_since
                .is_some_and(|t| t.elapsed() >= Duration::from_secs(15))
        {
            self.memory_low(true);
        }
    }
}
struct Helper {
    child: Child,
    input: ChildStdin,
    generation: u64,
    ready: bool,
    config: Option<Value>,
    suspended: Option<bool>,
    config_updates: u64,
}
impl Helper {
    fn send(&mut self, v: Value) -> Result<(), String> {
        writeln!(self.input, "{v}").map_err(|e| e.to_string())
    }
}
impl Drop for Helper {
    fn drop(&mut self) {
        let _ = self.send(json!({"type":"shutdown"}));
        let deadline = Instant::now() + Duration::from_millis(500);
        while Instant::now() < deadline {
            if self.child.try_wait().ok().flatten().is_some() {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub struct Native {
    shared: Arc<Shared>,
    proxy: EventLoopProxy<UserEvent>,
    windows: HashMap<WindowId, Overlay>,
    web_context: WebContext,
    helper: Option<Helper>,
    settings: Value,
    enabled: bool,
    generation: u64,
    wheel: Option<WindowId>,
    audio: Audio,
    preview_until: Option<Instant>,
    suspend_until: Option<Instant>,
    last_displays: Vec<Display>,
    last_poll: Instant,
    ready_until: Option<Instant>,
    pause_reason: Option<&'static str>,
    last_maintenance: Instant,
}
impl Native {
    pub fn new(shared: Arc<Shared>, proxy: EventLoopProxy<UserEvent>) -> Self {
        let settings = shared.store.lock().unwrap().settings.clone();
        let web_context = WebContext::new(Some(shared.data.join("webview")));
        Self {
            shared,
            proxy,
            settings,
            windows: HashMap::new(),
            web_context,
            helper: None,
            enabled: false,
            generation: 0,
            wheel: None,
            audio: Audio::default(),
            preview_until: None,
            suspend_until: None,
            last_displays: Vec::new(),
            last_poll: Instant::now(),
            ready_until: None,
            pause_reason: None,
            last_maintenance: Instant::now(),
        }
    }
    fn displays(target: &EventLoopWindowTarget<UserEvent>) -> Vec<Display> {
        target
            .available_monitors()
            .map(|m| {
                let p = m.position();
                let s = m.size();
                Display {
                    x: p.x,
                    y: p.y,
                    w: s.width,
                    h: s.height,
                    scale: m.scale_factor(),
                }
            })
            .collect()
    }
    fn rebuild(&mut self, target: &EventLoopWindowTarget<UserEvent>) -> Result<(), String> {
        let displays = Self::displays(target);
        if displays == self.last_displays && !self.windows.is_empty() {
            return Ok(());
        }
        self.windows.clear();
        self.wheel = None;
        self.last_displays.clear();
        if let Some(h) = &mut self.helper {
            h.send(json!({"type":"suspend","on":true}))?;
            h.suspended = Some(true);
        }
        self.ready_until = Some(Instant::now() + Duration::from_secs(15));
        for display in &displays {
            let builder = WindowBuilder::new()
                .with_title("lolPing Lite overlay")
                .with_visible(false)
                .with_transparent(true)
                .with_decorations(false)
                .with_resizable(false)
                .with_always_on_top(true)
                .with_focusable(false)
                .with_focused(false)
                .with_inner_size(PhysicalSize::new(
                    display.w,
                    if cfg!(target_os = "windows") {
                        display.h.saturating_sub(1)
                    } else {
                        display.h
                    },
                ))
                .with_position(PhysicalPosition::new(display.x, display.y));
            #[cfg(target_os = "windows")]
            let builder = {
                use tao::platform::windows::WindowBuilderExtWindows;
                builder.with_skip_taskbar(true)
            };
            #[cfg(target_os = "macos")]
            let builder = {
                use tao::platform::macos::WindowBuilderExtMacOS;
                builder.with_has_shadow(false)
            };
            let window = builder.build(target).map_err(|e| e.to_string())?;
            window
                .set_ignore_cursor_events(true)
                .map_err(|e| e.to_string())?;
            #[cfg(target_os = "macos")]
            unsafe {
                use tao::platform::macos::WindowExtMacOS;
                let ns = window.ns_window() as *mut objc2::runtime::AnyObject;
                let _: () = objc2::msg_send![ns,setLevel:1000isize];
                // CanJoinAllSpaces | Stationary | IgnoresCycle | FullScreenAuxiliary.
                let _: () = objc2::msg_send![ns,setCollectionBehavior:337usize];
                let _: () = objc2::msg_send![ns,setHidesOnDeactivate:false];
            }
            let id = window.id();
            let proxy = self.proxy.clone();
            let root = self.shared.root.clone();
            let data = self.shared.data.clone();
            let webview = WebViewBuilder::new_with_web_context(&mut self.web_context)
                .with_transparent(true)
                .with_focused(false)
                .with_clipboard(false)
                .with_background_throttling(wry::BackgroundThrottlingPolicy::Throttle)
                .with_custom_protocol("lolping".into(), move |_, request| {
                    let path = assets::resolve_asset(&root, &data, request.uri().path());
                    let (status, mime, bytes) =
                        match path.and_then(|p| fs::read(&p).ok().map(|b| (p, b))) {
                            Some((p, b)) => (200, assets::mime(&p), b),
                            None => (404, "text/plain", b"Not found".to_vec()),
                        };
                    wry::http::Response::builder()
                        .status(status)
                        .header("Content-Type", mime)
                        .header("Cache-Control", "no-store")
                        .body(Cow::Owned(bytes))
                        .unwrap()
                })
                .with_navigation_handler(|url| {
                    url.starts_with("lolping://localhost/")
                        || url.starts_with("http://lolping.localhost/")
                })
                .with_ipc_handler(move |request| {
                    if request.body().len() < 8192 {
                        if let Ok(v) = serde_json::from_str(request.body()) {
                            let _ = proxy.send_event(UserEvent::Renderer(id, v));
                        }
                    }
                })
                .with_url("lolping://localhost/overlay/index.html")
                .build(&window)
                .map_err(|e| e.to_string())?;
            window.set_visible(true);
            self.windows.insert(
                id,
                Overlay {
                    webview,
                    window,
                    display: display.clone(),
                    ready: false,
                    pending_preview: None,
                    epoch: 0,
                    visible: true,
                    idle_since: None,
                    low_memory: false,
                    frames: HashMap::new(),
                    frame_ms: Vec::new(),
                },
            );
        }
        self.last_displays = displays;
        Ok(())
    }
    fn all(&mut self, event: &str, value: Value) {
        for w in self.windows.values_mut() {
            w.send(event, value.clone());
        }
    }
    fn stop(&mut self) {
        self.helper = None;
        self.windows.clear();
        self.last_displays.clear();
        self.audio.clear();
        self.wheel = None;
        self.enabled = false;
        self.preview_until = None;
        self.suspend_until = None;
        self.ready_until = None;
        self.pause_reason = None;
        self.shared.status("stopped", false, None);
    }
    fn fail(&mut self, error: String) {
        self.stop();
        self.shared.status("failed", false, Some(error));
    }
    fn start(&mut self, target: &EventLoopWindowTarget<UserEvent>) -> Result<Value, String> {
        if self.helper.is_some() {
            return Ok(self.shared.status.lock().unwrap().clone());
        }
        self.rebuild(target)?;
        self.preview_until = None;
        self.generation += 1;
        let path = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("missingExecutableDirectory")?
            .join(if cfg!(target_os = "windows") {
                "hook-helper.exe"
            } else {
                "hook-helper"
            });
        let mut cmd = Command::new(path);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        let mut child = cmd.spawn().map_err(|e| e.to_string())?;
        let input = child.stdin.take().ok_or("missingHelperInput")?;
        let output = child.stdout.take().ok_or("missingHelperOutput")?;
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    eprintln!("[helper] {line}");
                }
            });
        }
        let generation = self.generation;
        let proxy = self.proxy.clone();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(output);
            loop {
                let mut line = String::new();
                match reader.by_ref().take(65537).read_line(&mut line) {
                    Ok(0) | Err(_) => break,
                    _ => {}
                }
                if line.len() > 65536 {
                    break;
                }
                if let Ok(v) = serde_json::from_str(&line) {
                    let _ = proxy.send_event(UserEvent::Helper(generation, v));
                }
            }
            let _ = proxy.send_event(UserEvent::HelperGone(generation));
        });
        self.enabled = true;
        self.helper = Some(Helper {
            child,
            input,
            generation,
            ready: false,
            config: None,
            suspended: None,
            config_updates: 0,
        });
        self.shared.status("starting", true, None);
        Ok(self.shared.status.lock().unwrap().clone())
    }
    pub fn control(
        &mut self,
        target: &EventLoopWindowTarget<UserEvent>,
        method: &str,
        p: Value,
    ) -> Result<Value, String> {
        match method {
            "lolping/start" => {
                let result = self.start(target);
                if let Err(ref e) = result {
                    self.fail(e.clone());
                }
                result
            }
            "lolping/stop" => {
                self.stop();
                Ok(json!({"state":"stopped","enabled":false}))
            }
            "lolping/diagnostics" => Ok(
                json!({"windows":self.windows.len(),"readyWindows":self.windows.values().filter(|w|w.ready).count(),"visibleWindows":self.windows.values().filter(|w|w.visible).count(),"lowMemoryWindows":self.windows.values().filter(|w|w.low_memory).count(),"frameMs":self.windows.values().flat_map(|w|w.frame_ms.iter().copied()).collect::<Vec<_>>(),"audioCacheBytes":self.audio.cached_bytes(),"helperConfigWrites":self.helper.as_ref().map(|h|h.config_updates),"helperPid":self.helper.as_ref().map(|h|h.child.id()),"enabled":self.enabled}),
            ),
            "lolping/pause" => {
                if self.helper.is_none() {
                    return Err("notRunning".into());
                }
                self.enabled = p["on"] != true;
                self.pause_reason = (!self.enabled).then_some("manual");
                if !self.enabled {
                    self.all("clear", Value::Null);
                    self.audio.clear();
                    self.wheel = None;
                }
                self.sync_helper();
                Ok(self.shared.status.lock().unwrap().clone())
            }
            "lolping/suspend" => {
                let on = p["on"] == true;
                self.suspend_until = on.then(|| Instant::now() + Duration::from_secs(20));
                if on {
                    self.all("clear", Value::Null);
                    self.wheel = None;
                }
                self.sync_helper();
                Ok(json!({"ok":true}))
            }
            "lolping/permission" => {
                #[cfg(target_os = "macos")]
                {
                    let helper = std::env::current_exe()
                        .map_err(|e| e.to_string())?
                        .parent()
                        .ok_or("missingExecutableDirectory")?
                        .join("hook-helper");
                    let _ = Command::new(helper).arg("--request-access").status();
                    Command::new("open").arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility").spawn().map_err(|e|e.to_string())?;
                }
                Ok(json!({"ok":true}))
            }
            "lolping/preview" => {
                let id = p["id"].as_str().ok_or("invalidPreview")?;
                let emote = p["wheel"] == "emote";
                if emote {
                    let store = self.shared.store.lock().unwrap();
                    if !store.available.contains(id) {
                        return Err("missingEmote".into());
                    }
                } else if !settings::PINGS.contains(&id) {
                    return Err("invalidPing".into());
                }
                self.rebuild(target)?;
                if self.helper.is_none() {
                    self.preview_until = Some(Instant::now() + Duration::from_secs(10));
                }
                // Queueing through the renderer's ready handshake also supports the very first preview.
                let primary = target.primary_monitor().map(|m| m.position());
                let selected = self
                    .windows
                    .iter()
                    .find(|(_, w)| {
                        primary.is_some_and(|p| p.x == w.display.x && p.y == w.display.y)
                    })
                    .map(|(id, _)| *id)
                    .or_else(|| self.windows.keys().next().copied())
                    .ok_or("noDisplay")?;
                let window = self.windows.get_mut(&selected).unwrap();
                let message = json!({"id":id,"wheel":if emote{"emote"}else{"ping"},"x":window.display.w as f64/window.display.scale/2.,"y":window.display.h as f64/window.display.scale/2.});
                if window.ready {
                    window.send("preview", message);
                } else {
                    window.pending_preview = Some(message);
                }
                Ok(json!({"ok":true}))
            }
            _ => Err("unknownControl".into()),
        }
    }
    pub fn refresh(&mut self, s: Value, library_changed: bool) {
        self.settings = s;
        if library_changed {
            self.audio.invalidate_custom();
            self.all("library", Value::Null);
        }
        self.all("settings", self.settings.clone());
        self.sync_helper();
    }
    fn sync_helper(&mut self) {
        let ready = !self.windows.is_empty() && self.windows.values().all(|w| w.ready);
        if ready {
            self.ready_until = None;
        }
        if let Some(h) = &mut self.helper {
            if !h.ready {
                return;
            }
            let config = settings::helper_config(&self.settings, self.enabled && ready);
            let suspended = !ready || self.suspend_until.is_some();
            // setConfig cancels an in-flight gesture; appearance/audio edits must not send it.
            let result = (|| {
                if h.config.as_ref() != Some(&config) {
                    h.send(config.clone())?;
                    h.config = Some(config);
                    h.config_updates += 1;
                }
                if h.suspended != Some(suspended) {
                    h.send(json!({"type":"suspend","on":suspended}))?;
                    h.suspended = Some(suspended);
                }
                Ok::<(), String>(())
            })();
            if let Err(e) = result {
                self.fail(e);
            } else {
                self.shared.status_with_pause(
                    if ready { "running" } else { "starting" },
                    self.enabled && ready && !suspended,
                    None,
                    if self.suspend_until.is_some() {
                        Some("capture")
                    } else {
                        self.pause_reason
                    },
                );
            }
        }
    }
    pub fn renderer(&mut self, id: WindowId, v: Value) {
        match v["type"].as_str().unwrap_or("") {
            "idle" => {
                if let Some(w) = self.windows.get_mut(&id) {
                    w.idle(v["epoch"].as_u64().unwrap_or(u64::MAX));
                }
            }
            "frame" => {
                if let Some(w) = self.windows.get_mut(&id) {
                    if let Some(start) = v["epoch"]
                        .as_u64()
                        .and_then(|epoch| w.frames.remove(&epoch))
                    {
                        if w.frame_ms.len() >= 128 {
                            w.frame_ms.remove(0);
                        }
                        w.frame_ms.push(start.elapsed().as_secs_f64() * 1000.);
                    }
                }
            }
            "ready" => {
                if let Some(w) = self.windows.get_mut(&id) {
                    w.ready = true;
                    w.send("settings", self.settings.clone());
                    if let Some(p) = w.pending_preview.take() {
                        w.send("preview", p);
                    }
                }
                self.shared.emit(
                    "lolping/overlayReady",
                    json!({"count":self.windows.values().filter(|w|w.ready).count()}),
                );
                self.sync_helper();
            }
            "sound" => {
                let key = v["key"].as_str().unwrap_or("");
                let volume = if self.settings["muted"] == true {
                    0.
                } else {
                    self.settings["volume"].as_f64().unwrap_or(70.) as f32 / 100.
                };
                let volume = if key == "button" {
                    if self.settings["tickSound"] == true {
                        volume * 0.5
                    } else {
                        0.
                    }
                } else if key.starts_with("emote:") && self.settings["emoteSound"] != true {
                    0.
                } else {
                    volume
                };
                if let Err(e) = self
                    .audio
                    .play(&self.shared.root, &self.shared.data, key, volume)
                {
                    self.shared.emit("lolping/audioError", json!({"error":e}));
                }
            }
            "selected" => {
                for (other, w) in &mut self.windows {
                    if *other != id {
                        w.send("clear", json!(null));
                    }
                }
            }
            _ => {}
        }
    }
    pub fn helper_event(&mut self, generation: u64, v: Value) {
        if self
            .helper
            .as_ref()
            .is_none_or(|h| h.generation != generation)
        {
            return;
        }
        match v["type"].as_str().unwrap_or("") {
            "ready" => {
                if let Some(h) = &mut self.helper {
                    h.ready = true;
                }
                self.sync_helper();
            }
            "error" => {
                let no_access = v["code"] == "noAccess";
                let error = v["message"].as_str().unwrap_or("helperFailed").to_string();
                self.stop();
                self.shared.status(
                    if no_access { "noAccess" } else { "failed" },
                    false,
                    Some(error),
                );
            }
            "toggled" => {
                self.enabled = v["enabled"] == true;
                self.pause_reason = (!self.enabled).then_some("shortcut");
                // The helper already changed its state; avoid a redundant config/cancel round-trip.
                if let Some(config) = self.helper.as_mut().and_then(|h| h.config.as_mut()) {
                    config["enabled"] = json!(self.enabled);
                }
                if !self.enabled {
                    self.all("clear", Value::Null);
                    self.audio.clear();
                    self.wheel = None;
                }
                self.sync_helper();
            }
            "cancel" => {
                self.all("cancel", Value::Null);
                self.wheel = None;
            }
            kind @ ("wheelOpen" | "wheelMove" | "wheelRelease" | "click") => {
                let (Some(x), Some(y)) = (v["x"].as_f64(), v["y"].as_f64()) else {
                    return;
                };
                let id = if kind == "wheelMove" || kind == "wheelRelease" {
                    self.wheel
                } else {
                    self.windows
                        .iter()
                        .find(|(_, w)| w.display.contains(x, y))
                        .map(|(id, _)| *id)
                };
                if kind == "wheelOpen" {
                    self.wheel = id;
                }
                if let Some(id) = id {
                    if let Some(w) = self.windows.get_mut(&id) {
                        let (x, y) = w.display.local(x, y, cfg!(target_os = "macos"));
                        if kind == "wheelOpen" || kind == "click" {
                            w.window.set_always_on_top(true);
                        }
                        let mut p = v.clone();
                        p["x"] = json!(x);
                        p["y"] = json!(y);
                        w.send(kind, p);
                    }
                }
                if kind == "wheelRelease" {
                    self.wheel = None;
                }
            }
            _ => {}
        }
    }
    pub fn helper_gone(&mut self, generation: u64) {
        if self
            .helper
            .as_ref()
            .is_some_and(|h| h.generation == generation)
        {
            self.fail("helperExited".into());
        }
    }
    pub fn tick(&mut self, target: &EventLoopWindowTarget<UserEvent>) {
        if self.last_poll.elapsed() < Duration::from_millis(500) {
            return;
        }
        self.last_poll = Instant::now();
        if self.ready_until.is_some_and(|t| Instant::now() >= t) {
            self.fail("overlayTimeout".into());
            return;
        }
        if self.suspend_until.is_some_and(|t| Instant::now() >= t) {
            self.suspend_until = None;
            self.sync_helper();
        }
        if self.preview_until.is_some_and(|t| Instant::now() >= t) {
            self.preview_until = None;
            if self.helper.is_none() {
                self.windows.clear();
                self.audio.clear();
                self.last_displays.clear();
            }
        }
        if (self.helper.is_some() || self.preview_until.is_some())
            && Self::displays(target) != self.last_displays
        {
            if let Err(e) = self.rebuild(target) {
                self.fail(e);
            }
        }
        for w in self.windows.values_mut() {
            w.maintain();
        }
        self.audio.maintain();
        if self.last_maintenance.elapsed() >= Duration::from_secs(30) {
            self.last_maintenance = Instant::now();
            self.all("maintenance", Value::Null);
        }
    }
}
impl Drop for Native {
    fn drop(&mut self) {
        self.stop();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn coordinates_handle_negative_monitors_and_scaling() {
        let d = Display {
            x: -2560,
            y: 0,
            w: 2560,
            h: 1440,
            scale: 2.,
        };
        assert_eq!(d.local(-2460., 200., false), (50., 100.));
        assert_eq!(d.local(-1230., 100., true), (50., 100.));
    }
}
