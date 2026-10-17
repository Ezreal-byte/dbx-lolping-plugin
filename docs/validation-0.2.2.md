# 0.2.2 Windows candidate validation (2026-10-17)

Opening a wheel at a display edge, leaving a signal there, and opening another wheel toward the display center could leave the Windows layered surface cropped or invisible. The CPU frame, HWND position and reported window size were correct, but the desktop retained the previous smaller visible region when the surface moved and grew through `UpdateLayeredWindow` alone.

The Windows surface now establishes changed destination geometry with `SetWindowPos` before uploading pixels. It disables activation, z-order changes and copying old client pixels. Unchanged geometry skips this additional call, and releasing an idle surface resets the geometry cache. The existing suppression of DWM frames remains in place.

Cursor position, wheel anchor, gesture thresholds, direction mapping, input helper and signal timing remain unchanged. A wheel can still extend past a screen edge, and the system cursor cannot move outside the desktop; the fix prevents that clipping from affecting subsequent wheels elsewhere. macOS uses a different surface path that already sets window position and size before assigning layer contents. No macOS device validation or CI run was performed for this local Windows candidate.

## Validation

- 25 Rust tests passed; the interactive desktop test is excluded from the ordinary suite. A new scene regression checks cancellation at an edge followed by normal selection, including bounds at 100%, 125%, 150% and 200% scale.
- The separately invoked Windows desktop regression passed 17 visual cases: four edges and four corners, each followed by a centered wheel, plus hiding, releasing the surface and waking it again. It checks actual opaque desktop pixels against the submitted frame, not just the window rectangle. Every case met the 98% matching threshold.
- Negative control: temporarily disabling only the new geometry update reproduced the defect. The left-edge case matched 110/110 opaque samples, but the following centered wheel matched only 9/208. Restoring the fix passed the complete sequence. The bypass is not present in the delivered source or binary.
- 17 existing Windows smoke checks passed, covering RPC, settings, imports, overlay initialization, DWM frame suppression, pause/resume, repeated start/stop, idle wake, host EOF and forced sidecar termination cleanup.
- Release build, package schema, all embedded checksums and the 30 MiB budget passed. Staged executable hashes match the newly built release backend and input helper.

Commands, from the repository root:

```powershell
cargo test --locked --manifest-path backend/Cargo.toml
cargo test --locked --manifest-path backend/Cargo.toml edge_then_center_keeps_native_surface_geometry -- --ignored --nocapture
cargo build --release --locked --manifest-path backend/Cargo.toml
npm run build:ui
npm run build:helper
npm run package
node scripts/verify-package.mjs
node scripts/smoke.mjs
```

The interactive test requires a visible Windows desktop and an existing `.stage/windows-x64` resource tree. Run it separately from other overlay tests so their topmost windows cannot obscure its pixel samples. It does not install input hooks or move the cursor. The physical display regression ran on this machine's primary display; the fractional-scale scene checks are not a substitute for mixed-DPI multi-monitor hardware validation.

## Local package

Package: `dist/io.dbx.lolping.lite-0.2.2-windows-x64.dbxp`

Compressed: 18,875,218 bytes (18.00 MiB). Installed files: 24,258,939 bytes (23.14 MiB).

SHA-256: `5bdef777baef86b65b7cdc924fea540cd2c855c213809bbd84fa742986dffb83`

Stop the installed plugin, import this package in DBX and start it again. Existing settings and imported resources do not need to be removed. This is a local Windows test package; a GitHub Release and store upgrade are not part of this validation.
