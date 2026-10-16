# Third-party notices

lolPing Lite derives the ping wheel, animations, settings concepts, input helper, app icon and tests from [darrenprx/lolPing](https://github.com/darrenprx/lolPing), revision `b947aab8d379015687117544191160bd82141954`. Its MIT license is reproduced in LICENSE. Changes replace Electron with a DBX Rust sidecar, remove networking, and add offline resource packs. The helper enables UTF-8 and the conforming MSVC preprocessor, and adds a macOS permission-request entry point.

League of Legends ping and emote icons, animations and sounds are © Riot Games. They are **not covered by the MIT license**. This project is not endorsed by Riot Games and does not reflect the views of Riot Games. League of Legends and Riot Games are trademarks of Riot Games, Inc. The optional emote pack contains the same Riot-owned assets, with byte-for-byte upstream checksums.

DBX plugin SDK is vendored under vendor/dbx-plugin-sdk; see its Cargo.toml, README.md and LICENSE. It is Apache-2.0 licensed. React is MIT licensed. Wry and Tao are Apache-2.0/MIT licensed; rodio is MIT/Apache-2.0 licensed. Cargo.lock and package-lock.json record the complete dependency versions and their source registries.

Ogg Opus emotes are decoded by libopus through the `opus` and `opusic-sys` Rust crates; the `ogg` crate demultiplexes their packets. libopus copyright and redistribution terms are reproduced in `licenses/opus-COPYING`. Original sound files are shipped unchanged.
