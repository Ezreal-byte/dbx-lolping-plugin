# DBX settings icons

These 15 white transparent PNGs use Microsoft's Fluent System Icons, the same
icon set as the upstream lolPing settings. The first six use the exact upstream
navigation symbols. See `sources.json` for the icon-to-symbol mapping.

Source package: `@fluentui/react-icons` **2.0.343** from the official npm registry.
The source SVG paths are unchanged; `generate.mjs` extracts them without running
package code and rasterizes at 96 × 96 for crisp 20–24 point icons up to 200%
scale. These assets were imported from the standalone LOLPing Lite 0.2.0 settings
and preserve the same symbols in the DBX plugin. The plugin embeds the PNGs as
data URIs in its settings bundle because DBX uses a sandboxed srcdoc frame.
CSS masks tint them with `currentColor`, following the host's light/dark theme.
The Fluent React package is a source asset only and is not a runtime dependency.

- Repository: https://github.com/microsoft/fluentui-system-icons
- npm source revision: `e17e4b6a88cb4f5daf6331c2a7bb7cc7217f9b11`
- Package tarball: https://registry.npmjs.org/@fluentui/react-icons/-/react-icons-2.0.343.tgz
- Tarball SHA-256: `fc60ab88ce7ce9c9a8a5396a44ea15d636d1c40fb1d7eca142c1f3b58e2b23bc`
- License: MIT, copyright © 2020 Microsoft Corporation. The complete notice is
  in `../../licenses/Fluent-System-Icons-MIT.txt`.

Development-only regeneration requires Node.js and Sharp. Extract the pinned
npm tarball, then run:

```text
node resources/settings-icons/generate.mjs /path/to/unpacked/package /path/to/node_modules/sharp
```
