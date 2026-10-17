# Third-party notices

lolPing Lite derives the ping wheel, animations, settings concepts, input helper, app icon and tests from [darrenprx/lolPing](https://github.com/darrenprx/lolPing), revision `b947aab8d379015687117544191160bd82141954`. Its MIT license is reproduced in LICENSE. Changes replace Electron with a DBX Rust sidecar, remove networking, and add offline resource packs. The helper enables UTF-8 and the conforming MSVC preprocessor, and adds a macOS permission-request entry point.

League of Legends ping and emote icons, animations and sounds are © Riot Games. They are **not covered by the MIT license**. This project is not endorsed by Riot Games and does not reflect the views of Riot Games. League of Legends and Riot Games are trademarks of Riot Games, Inc. The optional emote pack contains the same Riot-owned assets, with byte-for-byte upstream checksums.

DBX plugin SDK is vendored under vendor/dbx-plugin-sdk; see its Cargo.toml, README.md and LICENSE. It is Apache-2.0 licensed. React is MIT licensed. Tao is Apache-2.0/MIT licensed; tiny-skia is BSD-3-Clause licensed; rodio is MIT/Apache-2.0 licensed. Cargo.lock and package-lock.json record the complete dependency versions and their source registries. The native overlay no longer depends on Wry or a browser engine.

Ogg Opus emotes are decoded by libopus through the `opus` and `opusic-sys` Rust crates; the `ogg` crate demultiplexes their packets. libopus copyright and redistribution terms are reproduced in `licenses/opus-COPYING`. Original sound files are shipped unchanged.

Native overlay labels use the unmodified Inter 4.1 font by The Inter Project Authors, embedded in the backend under the SIL Open Font License 1.1. See `licenses/Inter-OFL.txt` and `backend/resources/README.md` for its source and checksum. `ttf-parser` (MIT/Apache-2.0) converts the fixed labels to cached vector outlines.

Settings navigation and action icons use Microsoft Fluent System Icons, sourced from `@fluentui/react-icons` 2.0.343 (MIT, copyright © 2020 Microsoft Corporation). The unchanged SVG paths were rasterized into transparent PNGs and are tinted with the DBX host theme at display time. See `resources/settings-icons/README.md` and `sources.json` for provenance, and `licenses/Fluent-System-Icons-MIT.txt` for the complete license. Settings text continues to use the host system fonts.
