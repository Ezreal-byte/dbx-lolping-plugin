# Settings UI 0.3.0 — design QA

## Visual target

- Layout source: standalone LOLPing Lite 0.2.0, `docs/images/standalone-0.2.0-reference.png`, cropped from its actual Windows settings window (1123×871 → client 1120×840, x=1/y=30). Original: Ezreal-byte/lolping-lite v0.2.0, `docs/images/ui-0.2.0-release-wheel.jpg`.
- User's latest direction overrides the gold palette: use DBX host colors, typography, controls and corners. No standalone autostart, tray or theme selector.
- Production DBX reference: `apps/desktop/src/styles/tokens.css`, `components/ui/button/index.ts`, `components/ui/tabs/TabsTrigger.vue`, and resolved theme forwarding in `components/plugins/PluginWorkbenchHost.vue`.
- Rendered implementation: `docs/images/ui-0.3.0-wheel-dark.png`, browser viewport 1120×840, DPR approximately 1. Light/English and all six dark/Chinese pages are also recorded in `docs/images/ui-0.3.0-*.png`.
- Full-view side-by-side comparison: `docs/images/ui-0.3.0-comparison.png` (2240×840; both inputs 1120×840, no density scaling).
- Focused right-panel comparison: `docs/images/ui-0.3.0-focused.png` (source and implementation 450×350 crops in a 920×350 canvas).
- State: north slot selected, default ping wheel, default 600px size. Source application running; isolated plugin preview stopped. This intentional status difference does not affect editing layout.

## Findings and iteration history

1. **P2 — material pool clipped at desktop viewport.** First rendered comparison (`ui-0.3.0-wheel-iteration1.png`) placed the pool below the persistent footer because the parameter card was too tall. Reduced spacing, aligned the center picker horizontally and removed redundant help text. Recaptured `ui-0.3.0-wheel-dark.png`: all 12 tiles and the full material panel are visible at 1120×840.
2. **P2 — source links could not open in DBX.** The actual iframe only allows scripts, so new `target=_blank` anchors were inoperative. Replaced them with full selectable source URLs. The existing GitHub emote download button still uses the established native RPC action. Verified actual srcdoc behavior in the DBX SDK development host.
3. The final combined comparison has no remaining actionable P0/P1/P2 differences. Color, font size, radius and header wording differences from standalone are intentional host adaptation, not uncorrected drift.

## Required fidelity surfaces

- **Typography:** host `--font-sans` with Chinese system fallbacks, 24px page titles, 14px controls/body, 12px secondary text. Smaller than the standalone 28/16/14 system to match DBX density. Chinese and English render without missing glyphs. Long material names truncate with full title/accessible names; source URLs wrap.
- **Spacing/layout:** fixed header, six horizontal tabs, independent scrolling content and persistent save footer. Wheel composition retains canvas left, parameters right, materials below. Below 960px, the columns stack. 760×560 and 420×760 checks show no body/content horizontal overflow; overflowing tab navigation scrolls horizontally and remains keyboard accessible.
- **Colors/tokens:** uses forwarded `--color-*`, `--font-*`, `--radius-*`; neutral primary buttons, line tabs and focus ring. Light/dark fallbacks match DBX defaults. Original colorful signal artwork and yellow question-mark logo are retained. SDK development host's own blue theme differs from production DBX; its capture verifies token forwarding and sandbox compatibility, not the production default palette.
- **Images/assets:** original twelve ping icons and installed emote thumbnails; licensed Fluent navigation/action masks embedded as data URIs. No substitute icon glyphs, external font requests, overlay WebView or extra animation engine.
- **Copy/content:** six categories are Trigger, Shortcut, Pings & sound, Wheel, Emotes, Plugin. Only plugin functions appear. Status, recording suspension, errors, resource imports and save feedback use text. The plugin page explains that settings live inside DBX while the overlay is native.

## Interactions and browser evidence

- Real DBX SDK srcdoc: start → pause → record → cancel restores prior paused state → resume; assign a wheel resource; explicit desktop preview; stop. Browser console warning/error list empty.
- Frontend integration tests cover slot swapping, independent center, no implicit preview, no-op same-item assignment, retained selection/scroll across tabs, event/late-reply protection, recording cancellation, modifier validation and reset preserving custom resources.
- All six pages checked in dark Chinese and light English. Narrow states: `ui-0.3.0-narrow-wheel-en.png`, `ui-0.3.0-narrow-wheel-controls-en.png`, `ui-0.3.0-narrow-plugin-zh.png`. Keyboard navigation reaches scrolled material controls with the header/footer still visible.
- Sandbox evidence: `ui-0.3.0-dbx-sandbox.png`. Desktop/RPC/package checks and platform limitations are recorded separately in `docs/validation-0.3.0.md`; visual QA does not claim macOS hardware acceptance or new memory measurements.

final result: passed
