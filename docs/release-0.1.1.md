# lolPing Lite 0.1.1

Performance and pause/resume improvements for **io.dbx.lolping.lite**.

- Empty overlays hide after the last animation ends. Windows lowers the WebView2 memory target after 15 seconds idle; loaded windows are retained and restored before the next signal. Kept pings and open wheels remain visible.
- Animation Blob caches are limited to 16 MiB / 16 entries per overlay; decoded audio cache to 8 MiB. Unused entries expire after 2 minutes, with periodic cleanup. Active playback keeps its resources until it finishes.
- Slider changes coalesce over 200 ms and flush on release, keyboard completion, blur or page hiding. Settings events no longer reload the full thumbnail library. Old responses cannot overwrite newer local edits.
- Audio and appearance changes no longer resend input configuration or cancel an active gesture. Existing sound playback is preserved.
- Pause / Resume buttons, an amber paused indicator and the actual resume shortcut clarify runtime state. Key recording has its own temporary pause state and restores the previous running/paused state.

On one Windows desktop, the isolated idle process-tree working-set sum decreased from **508.3 MiB to 434.2 MiB (~14.6%)** versus the 0.1.0 CI release. Private commit changed from 283.7 MiB to 277.2 MiB; the working-set reduction mainly reflects reclaimable resident memory, not equivalent freed allocations. The first signal after idle received a renderer-frame acknowledgment in **11.7 ms**; 24 consecutive signals had **9.2 ms P95**. This is dispatch-to-frame-ACK timing, not end-to-end input latency. Results vary by hardware/runtime; see [validation notes](https://github.com/Ezreal-byte/dbx-lolping-plugin/blob/v0.1.1/docs/validation-0.1.1.md).

Download `io.dbx.lolping.lite-0.1.1-windows-x64.dbxp` for Windows or `io.dbx.lolping.lite-0.1.1-darwin-arm64.dbxp` for Apple Silicon Macs. The optional `lolping-extra-emotes-1.zip` is unchanged and does not need reimporting. Existing settings and imported resources remain in the plugin data directory.

These are unsigned DBX Store candidates for local development-package installation. Mac native components are ad-hoc signed, not notarized. Windows and macOS CI cover builds, language tests, package verification and protocol/resource smoke tests. Mac Accessibility, fullscreen Spaces and subjective input feel still require hardware validation; the Windows measurements are not Mac measurements.

Based on [darrenprx/lolPing](https://github.com/darrenprx/lolPing), fixed upstream revision [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954). Code is MIT licensed; Riot Games' game images, animation and audio are excluded from MIT. Original icon and attribution are retained.
