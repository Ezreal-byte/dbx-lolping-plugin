import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync, chmodSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';
export const target = process.platform === 'win32' && process.arch === 'x64' ? 'windows-x64' : process.platform === 'darwin' && process.arch === 'arm64' ? 'darwin-arm64' : null;
if (!target) throw new Error('Supported targets: Windows x64 and macOS arm64');
const root = resolve('.');
const stage = resolve(root, '.stage', target);
if (relative(root, stage) !== join('.stage', target)) throw new Error('Stage escaped project');
// This script only replaces its own exact staging directory, never caller-supplied paths.
try { if (lstatSync(stage).isSymbolicLink()) throw new Error('Stage must not be a symlink'); rmSync(stage, { recursive: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
mkdirSync(stage, { recursive: true }); mkdirSync('dist', { recursive: true });
for (const dir of ['ui', 'assets', 'licenses']) cpSync(dir, join(stage, dir), { recursive: true });
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) cpSync(name, join(stage, name));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const bin = target === 'darwin-arm64' ? 'bin/lolping.app/Contents/MacOS' : 'bin';
mkdirSync(join(stage, bin), { recursive: true });
const suffix = process.platform === 'win32' ? '.exe' : '';
const profile = process.argv.includes('--debug') ? 'debug' : 'release';
cpSync(`backend/target/${profile}/lolping-backend${suffix}`, join(stage, bin, `lolping-backend${suffix}`));
cpSync(`native/hook-helper/build/hook-helper${suffix}`, join(stage, bin, `hook-helper${suffix}`));
manifest.entrypoints.backend.executable = `${bin}/lolping-backend${suffix}`;
writeFileSync(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
if (process.platform === 'darwin') {
  for (const exe of ['lolping-backend', 'hook-helper']) chmodSync(join(stage, bin, exe), 0o755);
  writeFileSync(join(stage, 'bin/lolping.app/Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>io.dbx.lolping.lite</string><key>CFBundleName</key><string>lolPing Lite</string><key>CFBundleExecutable</key><string>lolping-backend</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${manifest.version}</string><key>CFBundleVersion</key><string>${manifest.version}</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>`);
  const identity = process.env.LOLPING_SIGN_IDENTITY || '-';
  execFileSync('codesign', ['--force', '--sign', identity, join(stage, bin, 'hook-helper')], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', identity, join(stage, 'bin/lolping.app')], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', join(stage, 'bin/lolping.app')], { stdio: 'inherit' });
}
console.log(`Staged ${stage}`);
if (!process.argv.includes('--stage-only')) {
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const files = {}, checksums = {}; let unpacked = 0;
  function walk(dir) { for (const name of readdirSync(dir).sort()) { const path = join(dir, name), stat = lstatSync(path); if (stat.isSymbolicLink()) throw new Error('Symlinks are not permitted'); if (stat.isDirectory()) walk(path); else {
    const key = relative(stage, path).replaceAll('\\', '/');
    if (key === 'ui/settings.js' || key === 'ui/settings.css') continue; // Already embedded in index.html.
    const bytes = readFileSync(path); const executable = key.endsWith('lolping-backend') || key.endsWith('hook-helper');
    files[key] = [bytes, { os: 3, attrs: ((executable ? 0o100755 : 0o100644) << 16) >>> 0 }]; checksums[key] = hash(bytes); unpacked += bytes.length;
  } } }
  walk(stage);files['checksums.json'] = strToU8(JSON.stringify({ algorithm: 'sha256', files: checksums }, null, 2));
  const bytes = zipSync(files, { level: 9, mtime: new Date('2020-01-01T00:00:00Z') });
  const name = `${manifest.id}-${manifest.version}-${target}.dbxp`;writeFileSync(join('dist', name), bytes);
  const metadata = { target, url: name, sha256: hash(bytes), size: bytes.length, unpackedSize: unpacked, developmentUnsigned: true };
  writeFileSync(join('dist', name.replace('.dbxp', '.artifact.json')), JSON.stringify(metadata, null, 2) + '\n');
  const defaults = JSON.parse(readFileSync('resources/default-settings.json', 'utf8'));
  const core = new Set([...defaults.emoteWheel, defaults.clickEmoteId]);
  const upstream = JSON.parse(readFileSync('resources/upstream.json', 'utf8'));
  const extra = {}, index = {};
  for (const [key, spec] of Object.entries(upstream.files)) { if (!key.startsWith('emotes/') || core.has(key.split('/')[1].split('.')[0])) continue;
    const content = readFileSync(join('resources', key)); if (hash(content) !== spec.sha256) throw new Error(`Upstream hash mismatch: ${key}`);
    extra[key] = content; index[key] = spec;
  }
  extra['pack.json'] = strToU8(JSON.stringify({ version: 1, id: 'lolping-extra-emotes', upstream: upstream.revision, files: index }, null, 2));
  const pack = zipSync(extra, { level: 9, mtime: new Date('2020-01-01T00:00:00Z') });
  writeFileSync('dist/lolping-extra-emotes-1.zip', pack);
  console.log(JSON.stringify({ package: name, packageMiB: bytes.length / 1048576, installedMiB: unpacked / 1048576, extraPackMiB: pack.length / 1048576, within30MiB: bytes.length <= 30 * 1048576 }, null, 2));
}
