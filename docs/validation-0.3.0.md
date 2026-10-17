# 0.3.0 Windows settings validation (2026-10-17)

This update reorganizes the DBX settings page into six horizontal tabs: **Trigger / Shortcut / Pings & sound / Wheel / Emotes / Plugin** (触发／快捷开关／信号与声音／轮盘／表情／插件). It inherits DBX theme colors, fonts and corner radii, uses neutral action buttons, and adds visual wheel editing and emote search. Standalone-only autostart and tray options are absent.

The overlay remains natively rendered in Rust. A small Windows surface fix removes a remaining rounded clipping region after window display, raising or geometry changes; the C++ input implementation and gesture behavior are unchanged. Existing settings, custom assets and offline emote packs remain compatible. This report describes local Windows validation; remote CI results and release artifact hashes are recorded separately when publication completes.

## Automated checks

| Check | Local result |
| --- | --- |
| TypeScript | `npm run typecheck` passed |
| Frontend / shared logic | 106 Vitest tests passed |
| C++ input helper | 444 checks passed |
| Rust | 25 tests passed; one interactive desktop test excluded from the ordinary suite |
| Separate Windows desktop regression | The explicitly invoked interactive test passed all 17 edge/center/idle-wake scenes |
| Packaged Windows desktop smoke | 17 checks passed |
| Package verification | Schema, embedded checksums, native-overlay component constraints and 30 MiB size limit passed |

The desktop smoke test uses the staged native backend and helper with an isolated test data directory. It covers:

- Framed RPC, settings validation/persistence and settings events without repeated thumbnail payloads.
- Custom image import, duplicate rejection, custom OGG sound, offline pack import/reimport, custom removal, and corrupt/path-traversal pack rejection.
- Native overlay initialization, disabled Windows DWM frames, pause/resume and restoration of an existing manual pause after key capture.
- Repeated start without replacing the helper, appearance changes without input reconfiguration, idle buffer release/wake and burst-frame acknowledgement.
- Stop, host pipe EOF and forced sidecar termination cleanup; restarting preserves saved settings and the imported pack while remaining stopped.

The ordinary Rust suite intentionally excludes `edge_then_center_keeps_native_surface_geometry`, which requires a visible Windows desktop. Running it separately exposed an explicit rounded HWND clipping region that remained even with the DWM corner preference disabled. The window geometry and CPU frame were correct, but the region clipped corner pixels on the actual desktop.

The Windows surface now clears that region after geometry changes and after showing/raising the overlay, so frame alpha determines transparency. The existing 0.2.2 position/size synchronization remains in place. Input handling, cursor coordinates, wheel anchors and gesture thresholds were not changed.

After the fix, the explicitly invoked native regression passed all **17 scenes** on a **2880 × 1800 Windows desktop at 150% scaling**: the four edges and four corners, a centered wheel after each, and idle release/wake. All sampled opaque desktop pixels matched the submitted frame (**100%**, including 40/40 in the top-left scene); the existing **98%** acceptance threshold was not relaxed. Additional assertions check the corner region and raising an already-visible overlay without changing its geometry. The independent 17-check smoke suite also passed. The prior 0.2.2 regression is documented in [validation-0.2.2.md](validation-0.2.2.md).

```powershell
cargo test --locked --manifest-path backend/Cargo.toml edge_then_center_keeps_native_surface_geometry -- --ignored --nocapture
```

## Settings appearance and interaction

The implemented page was inspected in the in-app browser at **1120 × 840**, including all six categories, dark Chinese and light English appearances. Narrow layouts at **760 × 560** and **420 × 760** had no horizontal body overflow; lower controls remained reachable by scrolling. Screenshots and the source/implementation comparison are in [design-qa.md](../design-qa.md) and `docs/images/ui-0.3.0-*.png`.

The page was also exercised through the **official DBX SDK development host at `127.0.0.1:5190`**, inside its actual sandboxed iframe and connected to the real local sidecar:

- Start, manual pause and resume completed.
- Cancelling shortcut recording restored the preceding manual pause; it did not silently resume input.
- Choosing a wheel direction and assigning a resource updated the settings; preview was invoked separately and displayed the native signal.
- Stop released the running service.
- Browser console inspection found no errors during these checks.

The SDK host's sample theme is not identical to the production DBX default palette. The implementation uses the host's exported `--color-*`, `--font-*` and `--radius-*` tokens, with neutral fallbacks matching DBX. Theme checks and screenshots exercise the corresponding production-style colors as well as the live SDK bridge. This is validation of the official development host and backend, not a claim that every production DBX installation has been tested.

## Local package and release boundary

The locally checked Windows package was **18,901,141 bytes (18.026 MiB)**, with **24,326,636 bytes (23.200 MiB)** of installed package files. These figures describe that local test build; the Windows/macOS CI packages can differ. Final release sizes and SHA-256 values belong to the Release's `release-candidates.json` and per-platform `.artifact.json` files.

The settings page continues to use DBX's existing UI container; this change adds no standalone settings browser and makes no new memory-reduction claim. The previously documented 39–52 MiB samples are from 0.2.1 and exclude DBX and the settings page.

macOS hardware acceptance was not performed in this validation. Accessibility authorization, full-screen Spaces, display scaling and real input feel on macOS remain device checks. CI build/test success cannot establish those results. Linux and Intel Mac are not supported plugin targets.
