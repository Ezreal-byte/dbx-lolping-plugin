# lolPing Lite · DBX plugin

Desktop-wide pings and local emotes, controlled from a DBX workbench. Rust draws the overlay directly into native transparent windows and plays audio; the upstream C++ helper handles input. The overlay has no WebView, browser subprocesses or Electron runtime. No rooms, LAN discovery, relays, telemetry or automatic downloads are included.

Plugin ID: **`io.dbx.lolping.lite`**. Based on [darrenprx/lolPing](https://github.com/darrenprx/lolPing), pinned to [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954). Thanks to Darren and the upstream contributors for the input engine, wheel, animations and tests. The plugin icon is the upstream Riot-owned `enemy_missing.png` question mark. [中文说明](README.zh-CN.md)

## Install

Version 0.2.2 fixes Windows wheels becoming partially visible or disappearing after a wheel is triggered at a screen edge. Cursor position, wheel anchor and gesture behavior remain unchanged; see [edge regression validation](docs/validation-0.2.2.md). The native Rust overlay and DBX-hosted settings introduced in 0.2.1 remain in place. Windows single-desktop samples from 0.2.1 were approximately 39–52 MiB for the plugin process tree, excluding DBX and its settings UI; see [measurement limits](docs/validation-0.2.1.md). Existing settings and assets remain compatible.

Enable development package installation in DBX Plugin Center settings and select the platform `.dbxp`. These are unsigned development candidates; a repository operator must sign marketplace releases. Open Desktop pings and press Start. Hold Alt/Option and drag to ping, Ctrl for emotes, Ctrl+Alt+P to pause/resume. Closing the settings tab keeps the service running. Stop releases all listeners and overlay windows; quitting DBX ends the plugin. A new DBX session requires manually starting it again.

Nine default emotes ship in the core package. Click **Download on GitHub** beside **Import extra emote pack**, download `lolping-extra-emotes-1.zip` from Release Assets, then import it in settings to add the remaining 35. Import works offline. Up to 24 custom PNG/JPEG/GIF/WebP images are supported: static input ≤8 MiB; animation ≤5 MiB and ≤1024 pixels per side. Custom WAV/OGG/MP3 audio is limited to 1 MiB and 5 seconds.

macOS requires Accessibility permission. Use the settings button to open the system pane, allow lolPing Lite / DBX, then retry. The macOS backend and helper reside in an app bundle. Local builds use ad-hoc signing unless `LOLPING_SIGN_IDENTITY` is set; updates may require renewed permission. Ad-hoc builds are not notarized.

## Build and test

Requires Node.js 22, Rust, CMake and the native C++ compiler (Visual Studio Build Tools on Windows; Xcode Command Line Tools on macOS). Targets are Windows x64 and macOS Apple Silicon. The plugin overlay does not require WebView2 or WKWebView. Linux and Intel Mac are not supported in this version.

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

Download builds from this repository's Actions artifacts or [Releases](https://github.com/Ezreal-byte/dbx-lolping-plugin/releases). The edge regression validation is in `docs/validation-0.2.2.md`; earlier Windows memory samples are in `docs/validation-0.2.1.md`. Release package hashes are recorded in `release-candidates.json` and platform `.artifact.json` assets.

The `backend/` directory implements framed DBX RPC, persistence, checked uploads, native audio and overlay windows. `backend/src/render/` uses tiny-skia for vector art, bounded sprite storage, fixed-point image composition and two background animation decoders. Windows presents premultiplied pixels through UpdateLayeredWindow; macOS uses CoreGraphics images in a CALayer. Only the current scene bounds have a surface; idle windows release their drawing buffers. `src/renderer/` contains the React settings page. `native/hook-helper/` retains the upstream input state machine, with UTF-8 compiler flags and a macOS permission-request entry point. `resources/` holds the pinned assets and their hashes.

RPC methods use the `lolping/` prefix: `state`, `start`, `stop`, `pause` (`on` boolean), `settings`, `preview`, `suspend`, `permission`, `diagnostics`, `emote/remove`, `upload/begin`, `upload/cancel`, `upload/commit`. `lolping/settings` events carry `{settings}`; `lolping/library` events tell settings pages to refresh the resource list. Runtime status includes `pauseReason` (`manual`, `shortcut`, `capture` or null). Upload chunks use `upload/<id>` binary channels, an 8-byte big-endian offset and ≤512 KiB payload. Wait for the `lolping/upload` event acknowledgment before sending the next chunk. Settings and imported data reside in `DBX_PLUGIN_DATA_DIR`.

Upstream: <https://github.com/darrenprx/lolPing>, revision `b947aab8d379015687117544191160bd82141954`. MIT applies to code, not Riot Games' icons, animations and sounds. See LICENSE and THIRD_PARTY_NOTICES.md.
