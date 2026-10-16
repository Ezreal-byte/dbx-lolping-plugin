use crate::{
    assets::{self, Uploads},
    native::UserEvent,
    settings,
};
use dbx_plugin_sdk::{PluginEmitter, PluginError, PluginHandler, RequestContext};
use serde_json::{json, Value};
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tao::event_loop::EventLoopProxy;

pub struct Store {
    pub settings: Value,
    pub uploads: Uploads,
    pub available: HashSet<String>,
}
pub struct Shared {
    pub root: PathBuf,
    pub data: PathBuf,
    pub store: Mutex<Store>,
    pub status: Mutex<Value>,
    pub emitter: Mutex<Option<PluginEmitter>>,
}
impl Shared {
    pub fn new(root: PathBuf, data: PathBuf) -> Result<Arc<Self>, String> {
        fs::create_dir_all(&data).map_err(|e| e.to_string())?;
        let raw = fs::read(data.join("settings.json"))
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_else(settings::defaults);
        let available: HashSet<_> = assets::library_metadata(&root, &data, &raw["customEmotes"])
            .iter()
            .filter_map(|v| v["id"].as_str().map(str::to_owned))
            .collect();
        let mut s = settings::normalize(&raw, &available, cfg!(target_os = "macos"));
        s["customEmotes"] = json!(assets::library_metadata(&root, &data, &raw["customEmotes"])
            .into_iter()
            .filter(|v| v["custom"] == true)
            .map(|mut v| {
                v.as_object_mut().unwrap().remove("thumbnail");
                v.as_object_mut().unwrap().remove("custom");
                v
            })
            .collect::<Vec<_>>());
        Ok(Arc::new(Self {
            root,
            data,
            store: Mutex::new(Store {
                settings: s,
                uploads: Uploads::default(),
                available,
            }),
            status: Mutex::new(
                json!({"state":"stopped","enabled":false,"error":null,"pauseReason":null}),
            ),
            emitter: Mutex::new(None),
        }))
    }
    pub fn status(&self, state: &str, enabled: bool, error: Option<String>) {
        self.status_with_pause(state, enabled, error, None);
    }
    pub fn status_with_pause(
        &self,
        state: &str,
        enabled: bool,
        error: Option<String>,
        reason: Option<&str>,
    ) {
        let value = json!({"state":state,"enabled":enabled,"error":error,"pauseReason":reason});
        *self.status.lock().unwrap() = value.clone();
        self.emit("lolping/status", value);
    }
    pub fn emit(&self, method: &str, value: Value) {
        if let Some(e) = self.emitter.lock().unwrap().as_ref() {
            let _ = e.event(method, value);
        }
    }
    pub fn snapshot(&self) -> Value {
        let store = self.store.lock().unwrap();
        json!({"status":self.status.lock().unwrap().clone(),"settings":store.settings,
            "emotes":assets::library(&self.root,&self.data,&store.settings["customEmotes"]),
            "platform":if cfg!(target_os="macos"){"mac"}else{"win"},"version":env!("CARGO_PKG_VERSION"),
            "extraPackInstalled":assets::pack_dir(&self.data).is_dir()})
    }
}
pub struct Handler {
    pub shared: Arc<Shared>,
    pub proxy: EventLoopProxy<UserEvent>,
}
fn err(e: impl ToString) -> PluginError {
    PluginError::new(-32000, e.to_string())
}
impl Handler {
    fn control(&self, method: &str, p: Value) -> Result<Value, PluginError> {
        let (tx, rx) = mpsc::sync_channel(1);
        self.proxy
            .send_event(UserEvent::Control {
                method: method.into(),
                params: p,
                reply: tx,
            })
            .map_err(err)?;
        rx.recv_timeout(Duration::from_secs(25))
            .map_err(err)?
            .map_err(err)
    }
    fn refresh(&self, s: Value, library_changed: bool) {
        let _ = self
            .proxy
            .send_event(UserEvent::Settings(s.clone(), library_changed));
        self.shared.emit("lolping/settings", json!({"settings":s}));
        if library_changed {
            self.shared.emit("lolping/library", json!({"changed":true}));
        }
    }
}
impl PluginHandler for Handler {
    fn handle(
        &self,
        _context: RequestContext,
        method: &str,
        p: Value,
        emitter: &PluginEmitter,
    ) -> Result<Value, PluginError> {
        *self.shared.emitter.lock().unwrap() = Some(emitter.clone());
        match method {
            "lolping/state" => Ok(self.shared.snapshot()),
            "lolping/start"
            | "lolping/stop"
            | "lolping/preview"
            | "lolping/suspend"
            | "lolping/pause"
            | "lolping/permission"
            | "lolping/diagnostics" => self.control(method, p),
            "lolping/settings" => {
                let mut store = self.shared.store.lock().unwrap();
                let patch = p.as_object().ok_or_else(|| err("invalidSettings"))?;
                let mut raw = store.settings.clone();
                for (k, v) in patch {
                    if settings::defaults().get(k).is_some()
                        && k != "customEmotes"
                        && k != "version"
                    {
                        raw[k] = v.clone();
                    }
                }
                let next = settings::normalize(&raw, &store.available, cfg!(target_os = "macos"));
                if next == store.settings {
                    return Ok(next);
                }
                settings::atomic_json(&self.shared.data.join("settings.json"), &next)
                    .map_err(err)?;
                store.settings = next.clone();
                drop(store);
                self.refresh(next.clone(), false);
                Ok(next)
            }
            "lolping/upload/begin" => {
                let id = self
                    .shared
                    .store
                    .lock()
                    .unwrap()
                    .uploads
                    .begin(&p, &self.shared.data)
                    .map_err(err)?;
                Ok(json!({"id":id}))
            }
            "lolping/upload/cancel" => {
                self.shared
                    .store
                    .lock()
                    .unwrap()
                    .uploads
                    .active
                    .remove(p["id"].as_str().unwrap_or(""));
                Ok(json!({"ok":true}))
            }
            "lolping/upload/commit" => {
                let id = p["id"].as_str().ok_or_else(|| err("invalidUpload"))?;
                let mut store = self.shared.store.lock().unwrap();
                let upload = store.uploads.take(id).map_err(err)?;
                let bytes = fs::read(&upload.path).map_err(err)?;
                let result = match upload.kind.as_str() {
                    "pack" => {
                        assets::import_pack(&bytes, &self.shared.data).map_err(err)?;
                        json!({"ok":true})
                    }
                    "image" => {
                        json!({"id":assets::import_image(&bytes,&upload.name,&self.shared.data,&mut store.settings).map_err(err)?})
                    }
                    "sound" => {
                        let hash =
                            assets::custom_id(&upload.target).ok_or_else(|| err("invalidEmote"))?;
                        let mut next = store.settings.clone();
                        let item = next["customEmotes"]
                            .as_array_mut()
                            .unwrap()
                            .iter_mut()
                            .find(|v| v["id"] == upload.target)
                            .ok_or_else(|| err("missingEmote"))?;
                        crate::audio::validate_sound(&bytes).map_err(err)?;
                        fs::write(
                            self.shared
                                .data
                                .join("custom")
                                .join(format!("{hash}.sound")),
                            bytes,
                        )
                        .map_err(err)?;
                        item["sound"] = json!(true);
                        settings::atomic_json(&self.shared.data.join("settings.json"), &next)
                            .map_err(err)?;
                        store.settings = next;
                        json!({"ok":true})
                    }
                    _ => return Err(err("invalidUpload")),
                };
                let next = store.settings.clone();
                store.available = assets::library_metadata(
                    &self.shared.root,
                    &self.shared.data,
                    &next["customEmotes"],
                )
                .iter()
                .filter_map(|v| v["id"].as_str().map(str::to_owned))
                .collect();
                drop(store);
                drop(upload);
                self.refresh(next, true);
                Ok(result)
            }
            "lolping/emote/remove" => {
                let id = p["id"].as_str().ok_or_else(|| err("invalidEmote"))?;
                let hash = assets::custom_id(id).ok_or_else(|| err("invalidEmote"))?;
                let mut store = self.shared.store.lock().unwrap();
                let mut next = store.settings.clone();
                next["customEmotes"]
                    .as_array_mut()
                    .unwrap()
                    .retain(|v| v["id"] != id);
                let available = assets::library_metadata(
                    &self.shared.root,
                    &self.shared.data,
                    &next["customEmotes"],
                )
                .iter()
                .filter_map(|v| v["id"].as_str().map(str::to_owned))
                .collect();
                next = settings::normalize(&next, &available, cfg!(target_os = "macos"));
                settings::atomic_json(&self.shared.data.join("settings.json"), &next)
                    .map_err(err)?;
                store.settings = next.clone();
                store.available = available;
                for ext in ["png", "anim", "sound"] {
                    let _ = fs::remove_file(
                        self.shared
                            .data
                            .join("custom")
                            .join(format!("{hash}.{ext}")),
                    );
                }
                drop(store);
                self.refresh(next, true);
                Ok(json!({"ok":true}))
            }
            _ => Err(PluginError::method_not_found(method)),
        }
    }
    fn handle_binary(
        &self,
        channel: &str,
        bytes: Vec<u8>,
        emitter: &PluginEmitter,
    ) -> Result<(), PluginError> {
        let id = channel
            .strip_prefix("upload/")
            .ok_or_else(|| err("invalidUploadChannel"))?;
        let result = self.shared.store.lock().unwrap().uploads.chunk(id, &bytes);
        let params = match result {
            Ok(received) => json!({"id":id,"received":received}),
            Err(e) => json!({"id":id,"error":e}),
        };
        emitter.event("lolping/upload", params)
    }
}
