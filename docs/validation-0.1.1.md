# 0.1.1 validation

Windows x64, 2026-10-16. The published 0.1.0 Windows CI package was extracted as the baseline. Each version ran sequentially with a separate temporary data folder, the same 12 muted ping previews and the same idle period. The user's installed plugin/data were not modified. Measurements cover the sidecar and its descendants, not DBX or unrelated WebViews.

| Measurement | 0.1.0 | 0.1.1 |
| --- | ---: | ---: |
| Idle working-set sum | 508.3 MiB | 434.2 MiB |
| Idle private commit | 283.7 MiB | 277.2 MiB |
| Stopped working-set sum | 22.4 MiB | 22.0 MiB |

Working sets include shared pages; private commit is committed private virtual memory, not resident memory. Windows' low memory target mostly releases resident renderer pages and is best-effort. The remaining browser/GPU process costs are substantial. This is one run per version on one desktop, not a universal percentage guarantee or a memory-leak diagnosis. Full data: [performance-0.1.1.json](performance-0.1.1.json).

After the overlay was hidden and in low-memory mode, its first preview was acknowledged at the renderer's next animation frame in 11.7 ms. All 24 subsequent previews were acknowledged: median 7.3 ms, P95 9.2 ms, maximum 9.5 ms. Timing starts before visibility/memory restoration and includes native dispatch to the renderer-frame callback. It excludes input-hook delivery, physical display scanout and subjective feel. No overlay was recreated during wake. The benchmark asserts an idle frame-ACK budget of 100 ms and a burst P95 budget of 80 ms to catch large regressions; those are test ceilings, not UX targets.

## Automated checks

- 125 frontend tests: existing wheel/input/animation tests plus cache limits, expiry, failure retry, asynchronous invalidation, coalesced writes, stale response protection, hidden-overlay completion, kept pings, pause/capture UI and thumbnail reload isolation.
- 12 Rust tests: normalization, resources/uploads/audio and byte-bounded LRU cache expiry/invalidation.
- 444 Windows C++ helper assertions. The upstream input state machine is unchanged.
- 16 Windows desktop smoke scenarios: framed RPC, resources/imports/persistence, real overlays, input configuration stability during appearance edits, prior pause restoration after recording, idle visibility/low-memory transition, repeated frame acknowledgments, stop/EOF/crash cleanup.
- Official DBX development host: light-theme settings, start, manual pause, recording/cancel while paused, resume, slider save and stop inspected in the actual sandboxed workbench.
- Windows x64 / macOS arm64 CI performs type checking, all applicable language tests, release compilation, package/checksum checks and 10 protocol/resource smoke scenarios without desktop hooks.

## Implementation limits

- Windows uses `MemoryUsageLevel::Low` only after 15 seconds idle, then returns to `Normal` before dispatch. It does not destroy or fully suspend the document. A stale idle acknowledgment is ignored using a monotonically increasing dispatch epoch.
- macOS hides empty WKWebView windows, requests background throttling where supported, and shares the same bounded caches. No Windows-specific memory API is claimed on macOS.
- Blob cache is at most 16 MiB / 16 entries per overlay; decoded audio cache is at most 8 MiB globally. Entries unused for 120 seconds are reclaimed on use/maintenance (Blob sweep every 30 seconds). These budgets exclude live images, browser-decoded surfaces, the audio device and active playback buffers.
- Settings slider edits coalesce in the UI, flush at interaction/lifecycle boundaries and serialize writes. Discrete controls save immediately. Crashes before a pending edit reaches the backend can still lose that unsaved edit.
- Mac permission/fullscreen behavior, mixed-DPI display hotplug, production-host upgrade/uninstall and subjective real input feel remain manual checks in [manual-validation.md](manual-validation.md). CI success is not a substitute for those checks.

Reproduce after building/packaging with `node scripts/smoke.mjs` and `node scripts/benchmark.mjs`. For comparison, pass an extracted old package directory to the benchmark. On Windows set `CODEX_PWSH_PATH` if PowerShell 7 is not on PATH. No system input is injected by the benchmark.
