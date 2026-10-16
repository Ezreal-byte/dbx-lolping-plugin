# lolPing Lite · DBX plugin

Desktop-wide pings and local emotes, controlled from a DBX workbench. Rust uses the system WebView and native audio; the upstream C++ helper handles input. No Electron runtime, rooms, LAN discovery, relays, telemetry or automatic downloads are included.

Plugin ID: **`io.dbx.lolping.lite`**. Based on [darrenprx/lolPing](https://github.com/darrenprx/lolPing), pinned to [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954). Thanks to Darren and the upstream contributors for the input engine, wheel, animations, tests and original app icon. [中文说明](README.zh-CN.md)

## Install

Enable development package installation in DBX Plugin Center settings and select the platform `.dbxp`. These are unsigned development candidates; a repository operator must sign marketplace releases. Open Desktop pings and press Start. Hold Alt/Option and drag to ping, Ctrl for emotes, Ctrl+Alt+P to pause/resume. Closing the settings tab keeps the service running. Stop releases all listeners and overlay windows; quitting DBX ends the plugin. A new DBX session requires manually starting it again.

Nine default emotes ship in the core package. Import the optional `lolping-extra-emotes-1.zip` in settings to add the remaining 35 without network access. Up to 24 custom PNG/JPEG/GIF/WebP images are supported: static input ≤8 MiB; animation ≤5 MiB and ≤1024 pixels per side. Custom WAV/OGG/MP3 audio is limited to 1 MiB and 5 seconds.

macOS requires Accessibility permission. Use the settings button to open the system pane, allow lolPing Lite / DBX, then retry. The macOS backend and helper reside in an app bundle. Local builds use ad-hoc signing unless `LOLPING_SIGN_IDENTITY` is set; updates may require renewed permission. Ad-hoc builds are not notarized.

## Build and test

Requires Node.js 22, Rust, CMake and the native C++ compiler (Visual Studio Build Tools on Windows; Xcode Command Line Tools on macOS). Targets are Windows x64 and macOS Apple Silicon. Windows also needs Microsoft WebView2 Runtime. Linux and Intel Mac are not supported in this version.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:helper
npm run test:backend
npm run build
npm run package
npm run test:smoke
npm run dev
```

Development settings use `http://127.0.0.1:4178` with the real sidecar and a local bridge shim. This does not replace testing inside DBX. `node scripts/smoke.mjs --no-desktop` skips GUI/input checks. CI builds both target platforms; macOS Accessibility and fullscreen Spaces still require hardware validation. See `docs/manual-validation.md`.

`npm run dev:dbx -- ../dbx` uses the official DBX development host from a neighboring source checkout with its shell UI already built. The workbench document embeds scripts, CSS and icons to run inside the host's restrictive iframe sandbox.

## GitHub Actions

The workflow in `.github/workflows/build.yml` builds Windows x64 (`windows-2022`) and macOS arm64 (`macos-15`) on push, pull requests and manual dispatch. Each job checks architecture, runs all language tests, builds release binaries, packages and verifies the `.dbxp`, then runs protocol/resource smoke tests without desktop input hooks. Artifacts contain the platform package, size/SHA-256 metadata, offline emote pack and reports, retained for 30 days. Mac components receive ad-hoc signing; DBX marketplace signing and Apple notarization are separate release steps.

Download builds from this repository's Actions artifacts or [Releases](https://github.com/Ezreal-byte/dbx-lolping-plugin/releases). The current Windows validation record is in `docs/validation-2026-10-16.md`. Release package hashes are recorded in `release-candidates.json` and platform `.artifact.json` assets.

The `backend/` directory implements framed DBX RPC, persistence, checked uploads, native audio and overlay windows. `src/renderer/` contains React settings and the reused TypeScript/SVG/DOM renderer. `native/hook-helper/` retains the upstream input state machine, with UTF-8 compiler flags and a macOS permission-request entry point. `resources/` holds the pinned assets and their hashes.

RPC methods use the `lolping/` prefix: `state`, `start`, `stop`, `settings`, `preview`, `suspend`, `permission`, `diagnostics`, `emote/remove`, `upload/begin`, `upload/cancel`, `upload/commit`. Upload chunks use `upload/<id>` binary channels, an 8-byte big-endian offset and ≤512 KiB payload. Wait for the `lolping/upload` event acknowledgment before sending the next chunk. Settings and imported data reside in `DBX_PLUGIN_DATA_DIR`.

Upstream: <https://github.com/darrenprx/lolPing>, revision `b947aab8d379015687117544191160bd82141954`. MIT applies to code, not Riot Games' icons, animations and sounds. See LICENSE and THIRD_PARTY_NOTICES.md.
