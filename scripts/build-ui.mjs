import { build } from 'esbuild';
import { mkdirSync, copyFileSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
const defaults = JSON.parse(readFileSync('resources/default-settings.json', 'utf8'));
// Remove only this project's obsolete generated overlay; no browser assets ship in 0.2+.
const obsolete = resolve('ui/overlay');
if (relative(resolve('ui'), obsolete) !== 'overlay') throw Error('Invalid generated overlay path');
try { if (lstatSync(obsolete).isSymbolicLink()) throw Error('Generated overlay must not be a symlink'); rmSync(obsolete, { recursive: true }); } catch(e) { if (e.code !== 'ENOENT') throw e; }
mkdirSync('ui/emotes', { recursive: true });
for (const dir of ['sounds', 'textures']) cpSync(`resources/${dir}`, `ui/${dir}`, { recursive: true });
for (const id of new Set([...defaults.emoteWheel, defaults.clickEmoteId])) {
  for (const ext of ['png', 'webp', 'ogg']) copyFileSync(`resources/emotes/${id}.${ext}`, `ui/emotes/${id}.${ext}`);
}
const icons = Object.fromEntries(readdirSync('resources/textures').filter(n=>n.endsWith('.png')).map(n=>[n.slice(0,-4), `data:image/png;base64,${readFileSync(`resources/textures/${n}`).toString('base64')}`]));
const uiIcons = Object.fromEntries(readdirSync('resources/settings-icons').filter(n=>n.endsWith('.png')).map(n=>[n.slice(0,-4), `data:image/png;base64,${readFileSync(`resources/settings-icons/${n}`).toString('base64')}`]));
await build({ entryPoints: ['src/renderer/settings/main.tsx'], outfile: 'ui/settings.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], define: { 'process.env.NODE_ENV': '"production"', '__PING_ICONS__': JSON.stringify(icons), '__UI_ICONS__': JSON.stringify(uiIcons), '__PLUGIN_ICON__': JSON.stringify(`data:image/png;base64,${readFileSync('assets/plugin.png').toString('base64')}`) }, legalComments: 'eof' });
// DBX uses a sandboxed srcdoc frame: relative script/style/image URLs are blocked.
const settingsHtml = readFileSync('src/renderer/settings/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="./settings.css">', `<style>${readFileSync('ui/settings.css', 'utf8')}</style>`)
  .replace('<script src="./settings.js"></script>', () => `<script>${readFileSync('ui/settings.js', 'utf8').replaceAll('</script', '<\\/script')}</script>`);
writeFileSync('ui/index.html', settingsHtml);
console.log('Built DBX settings and native renderer core assets (9 emotes).');
