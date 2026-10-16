# lolPing Lite 0.1.0

Initial release of **io.dbx.lolping.lite**, a local desktop ping and emote plugin for DBX.

- Desktop ping and emote wheels, click signals, animation and native sound.
- DBX-style settings without a separate sidebar, using the original lolPing icon.
- Nine bundled emotes; import the optional `lolping-extra-emotes-1.zip` for 35 more. Custom images and sounds stay local.
- Manual start/stop. Closing settings keeps the service running; DBX shutdown releases the overlay and input helper.
- Windows x64 and macOS Apple Silicon. Rust and the system WebView replace Electron; the upstream C++ input helper is retained. Rooms, network synchronization, updater and system auto-start are excluded.

Download the `.dbxp` for your platform. These are unsigned DBX Store candidates: enable development package installation in DBX to test them before store review/signing. Mac native components are ad-hoc signed, not notarized; Accessibility permission is required. Mac fullscreen Spaces and real input behavior still need hardware validation.

Source and acknowledgments: [darrenprx/lolPing](https://github.com/darrenprx/lolPing), fixed revision [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954). Original code is MIT licensed. League of Legends icons, animations and sounds belong to Riot Games and are excluded from MIT; this project is not endorsed by Riot Games.

The Release includes platform packages, size/SHA-256 metadata, `release-candidates.json`, and the optional offline emote pack.
