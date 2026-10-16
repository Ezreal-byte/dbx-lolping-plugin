#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]
mod assets;
mod audio;
mod cache;
mod native;
mod service;
mod settings;
use dbx_plugin_sdk::{PluginMetadata, PluginServer, PluginTransport};
use native::UserEvent;
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};
use tao::{
    event::Event,
    event_loop::{ControlFlow, EventLoopBuilder},
};

fn main() {
    if let Err(e) = run() {
        eprintln!("lolPing Lite: {e}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), String> {
    let root = std::env::var_os("LOLPING_ROOT")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_dir().map_err(|e| e.to_string())?);
    let data = std::env::var_os("DBX_PLUGIN_DATA_DIR")
        .map(PathBuf::from)
        .ok_or("DBX_PLUGIN_DATA_DIR is required")?;
    let shared = service::Shared::new(root, data)?;
    #[allow(unused_mut)]
    let mut event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    #[cfg(target_os = "macos")]
    {
        use tao::platform::macos::{ActivationPolicy, EventLoopExtMacOS};
        event_loop.set_activation_policy(ActivationPolicy::Accessory);
        event_loop.set_dock_visibility(false);
        event_loop.set_activate_ignoring_other_apps(false);
    }
    let proxy = event_loop.create_proxy();
    let sdk_proxy = proxy.clone();
    let handler = service::Handler {
        shared: shared.clone(),
        proxy: proxy.clone(),
    };
    std::thread::spawn(move || {
        let metadata = PluginMetadata::new("io.dbx.lolping.lite", env!("CARGO_PKG_VERSION"))
            .with_capability("events")
            .with_capability("binary");
        if let Err(e) = PluginServer::new(metadata, handler)
            .transport(PluginTransport::Framed)
            .serve()
        {
            eprintln!("Protocol: {e}");
        }
        let _ = sdk_proxy.send_event(UserEvent::Quit);
    });
    let mut native = native::Native::new(shared, proxy);
    event_loop.run(move |event, target, flow| {
        *flow = ControlFlow::WaitUntil(Instant::now() + Duration::from_millis(500));
        match event {
            Event::UserEvent(UserEvent::Control {
                method,
                params,
                reply,
            }) => {
                let _ = reply.send(native.control(target, &method, params));
            }
            Event::UserEvent(UserEvent::Settings(s, library_changed)) => {
                native.refresh(s, library_changed)
            }
            Event::UserEvent(UserEvent::Helper(id, v)) => native.helper_event(id, v),
            Event::UserEvent(UserEvent::HelperGone(id)) => native.helper_gone(id),
            Event::UserEvent(UserEvent::Renderer(id, v)) => native.renderer(id, v),
            Event::UserEvent(UserEvent::Quit) => {
                let _ = native.control(target, "lolping/stop", serde_json::Value::Null);
                *flow = ControlFlow::Exit;
            }
            Event::MainEventsCleared => native.tick(target),
            _ => {}
        }
    })
}
