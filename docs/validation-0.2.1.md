# 0.2.1 validation (2026-10-16)

The 0.2.0 test build could show a gray rounded rectangle and shadow around transparent wheels and pings. Tao's undecorated window still retains `WS_CAPTION`; hiding the title bar does not reliably suppress DWM non-client rendering. The Windows surface now disables DWM non-client rendering, opts out of Windows 11 border coloring/corner rounding, and disables the unused blur-behind setup. It continues to present the original premultiplied pixels with `UpdateLayeredWindow`.

The hand-built stroke alphabet has been replaced with filled Inter 4.1 font outlines. PING/EMOTE use semibold glyphs, while BACK uses medium glyphs with improved contrast, spacing and a centered mouse hint. All four fixed labels are prepared once before input starts and scale with the wheel/display. The original helper, gesture thresholds, direction mapping and signal timing were not changed in this revision.

## Local Windows renderer candidate

These measurements and the hash below identify the locally accepted candidate before the final download-button and question-mark-icon changes. Release artifacts are built separately by Windows/macOS CI; their hashes and sizes are in the Release's `release-candidates.json`.

Validation:

- 24 Rust tests passed, including wheel selection/cancellation, transparency and rendering at multiple sizes.
- 17 Windows desktop smoke checks passed. The new regression checks query actual DWM non-client rendering state after preview and idle/wake: all surfaces report disabled.
- An actual native question-mark signal was visually inspected over a light desktop application. Its surrounding area remained transparent without the rounded rectangle/border/shadow. Both wheel fixtures were rendered with the new font; the PING wheel was visually inspected.
- Package schema, checksums and 30 MiB budget passed. Windows was tested locally; macOS Accessibility, fullscreen Spaces and input feel require physical-device acceptance in addition to CI.

Package: `io.dbx.lolping.lite-0.2.1-windows-x64.dbxp`

Compressed: 19,319,153 bytes (18.42 MiB). Installed files: 24,772,859 bytes (23.63 MiB).

SHA-256: `d96ce2d20437ca5c94474146246433788d3037fedeb1a73d8406ae374ce03ee2`

Stop the existing plugin, import this development package in DBX, and start the plugin again. Version 0.2.1 distinguishes this build from the original 0.2.0 candidate. No settings/data migration or removal is required.

## Memory sample

The same local candidate was remeasured after verifying that the staged executables and manifest matched the delivered ZIP. The isolated plugin process tree measured 39.3 MiB after start, 46.9–47.1 MiB during built-in emotes, 47.5 MiB for a custom animation, 51.4 MiB with a ping/audio, 47.0 MiB idle afterward, and 20.1 MiB stopped. A separate snapshot of the user's running installation was 46.6 MiB. Raw values and package provenance are in [performance-0.2.1.json](performance-0.2.1.json).

These are sampled working-set sums, including shared pages, for one Windows desktop. They exclude the DBX host, its settings UI and separately accounted GPU memory. They are not a worst-case ceiling. Larger/custom media, multiple displays and simultaneous effects can change usage. The five-second idle CPU sample was about 1% of one CPU core, not 1% of the whole multicore machine.

## Release UI additions

The settings page now explains which optional ZIP to download and sends a fixed `lolping/releases` RPC when the user clicks Download on GitHub. The RPC thread opens only the project's fixed HTTPS Releases URL in the default browser using ShellExecuteW on Windows or `/usr/bin/open` on macOS. It accepts no URL/command from the caller, downloads no files itself, and leaves the overlay/input event loop untouched. The settings integration test covers the RPC and its translated error fallback. The plugin/workbench icon is the original question-mark texture; its checksum matches the pinned upstream asset.
