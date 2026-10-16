# 0.2.0 native overlay validation

The desktop overlay is implemented in Rust. Wry, WebView2/WKWebView integration, custom browser protocols, DOM/CSS overlay code and overlay web assets have been removed. DBX continues to host the React settings page in its own workbench.

## Architecture and budgets

- tiny-skia draws wheel paths; fixed-point premultiplied RGBA composition draws images. Ping glow/ring sprites are prepared once. Stable scaled sprites have an 8 MiB per-display cache, released when the scene becomes idle.
- Windows uses a non-activating, click-through layered window and UpdateLayeredWindow. macOS uses a transparent, non-activating Tao window, a CoreGraphics image and CALayer contents with implicit animations disabled.
- Native surfaces cover the current scene bounds, clipped to the display. Their CPU buffers are released when hidden. Display changes rebuild the overlays and temporarily suspend the unchanged C++ input helper.
- Two background animation decoders stream into bounded two-frame channels. Each live animation additionally owns a current frame and look-ahead frame. The decoder can own another frame in progress. Images are not expanded into an unbounded animation-frame cache.
- Audio device startup, decoding and playback run on a separate worker with a bounded queue and the existing 8 MiB/120-second sample cache. Pause/stop invalidates queued playback and clears the device. Volume/appearance edits still do not reset the input helper or cancel its gesture.
- Release compilation prioritizes rendering speed with optimization level 3, LTO, one codegen unit and stripped symbols. Packages retain the 30 MiB size check.

## Automated and local checks

Rust tests cover wheel direction/dead-zone parity, size changes, cancel/release, kept pings, ping floods and expiry, settings changes during a gesture, transparency, alpha blending, clipping/scaling, original WebP animation decoding, custom GIF looping, decoder cancellation and audio worker cleanup. Existing settings/resource/protocol and C++ input tests remain in place.

`scripts/smoke.mjs` exercises actual native Windows surfaces, preview without hooks, repeated start, appearance edits without helper reconfiguration, manual/capture pause restoration, idle wake, burst frame submission, stop, host EOF and forced process termination. Render fixtures exercise both wheels, selected sectors, signal art and the All In halves.

`scripts/benchmark.mjs` measures an isolated plugin process tree and dispatch-to-frame timing. In 0.1.x, the endpoint was a WebView requestAnimationFrame acknowledgment; in 0.2.0 it is native surface submission. Neither measures OS input delivery, compositor presentation or physical display scanout. These endpoints are different and must not be presented as a strict input-latency comparison.

`scripts/benchmark-native.mjs` samples original/custom emotes, audio-enabled signals, idle CPU and stopped memory. Working-set sums include shared pages and exclude DBX's host process and separately accounted GPU resources. Private commit is not resident physical RAM. These single-machine samples are not a multi-machine or worst-case guarantee; display resolution, scaling, concurrent effects and custom media affect usage.

## Windows local candidate (2026-10-16)

- Package: `io.dbx.lolping.lite-0.2.0-windows-x64.dbxp`, 18,781,940 bytes (17.91 MiB); staged installation 22.68 MiB.
- SHA-256: `d49d5eb0eca4d49e0de7645c94fb4b3027140f711d3a27009d0517f5663d1216`.
- Latest release build: 24 Rust tests passed; package schema/checksums passed; all 16 desktop smoke checks passed. Frontend checks previously passed (103 tests and type checking), as did 444 C++ input assertions; those sources did not change afterward.
- The packaged executable's native load probe sampled 39.11 MiB after start, 49.01–50.55 MiB during built-in/custom animation, 53.60 MiB for an audio-enabled signal, 49.19 MiB idle after that workload, and 22.41 MiB stopped. No browser child processes were present. The idle CPU sample was approximately 1.02% of one CPU core over five seconds; this short sample is not a steady-state guarantee.
- Raw reports: generated `dist/smoke-report.json` and `dist/native-load-report.json`. This is a local Windows testing candidate; macOS CI and a public 0.2.0 release have not been completed.

## Remaining manual acceptance

CI compilation does not validate macOS Accessibility authorization, fullscreen Spaces, screen orientation, mixed-DPI/negative-origin display behavior or subjective input feel. Windows native transparency was inspected locally; full multi-monitor/hotplug, game fullscreen and long-duration input acceptance remain covered by `manual-validation.md`, not claimed by unit tests.

Settings and custom assets remain in the same DBX_PLUGIN_DATA_DIR format. The original optional emote ZIP remains compatible. The installed user plugin is not replaced by these isolated development checks.
