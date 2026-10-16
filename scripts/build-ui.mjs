import { build } from 'esbuild';
import { mkdirSync, copyFileSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
const defaults = JSON.parse(readFileSync('resources/default-settings.json', 'utf8'));
mkdirSync('ui/overlay', { recursive: true });
mkdirSync('ui/emotes', { recursive: true });
for (const dir of ['sounds', 'textures']) cpSync(`resources/${dir}`, `ui/${dir}`, { recursive: true });
for (const id of new Set([...defaults.emoteWheel, defaults.clickEmoteId])) {
  for (const ext of ['png', 'webp', 'ogg']) copyFileSync(`resources/emotes/${id}.${ext}`, `ui/emotes/${id}.${ext}`);
}
await build({ entryPoints: ['src/renderer/overlay/main.ts'], outfile: 'ui/overlay/main.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], legalComments: 'eof' });
const icons = Object.fromEntries(readdirSync('resources/textures').filter(n=>n.endsWith('.png')).map(n=>[n.slice(0,-4), `data:image/png;base64,${readFileSync(`resources/textures/${n}`).toString('base64')}`]));
await build({ entryPoints: ['src/renderer/settings/main.tsx'], outfile: 'ui/settings.js', bundle: true, minify: true, format: 'iife', target: ['es2022'], define: { 'process.env.NODE_ENV': '"production"', '__PING_ICONS__': JSON.stringify(icons), '__PLUGIN_ICON__': JSON.stringify(`data:image/png;base64,${readFileSync('assets/plugin.png').toString('base64')}`) }, legalComments: 'eof' });
copyFileSync('src/renderer/overlay/overlay.css', 'ui/overlay/overlay.css');
writeFileSync('ui/overlay/index.html', readFileSync('src/renderer/overlay/index.html', 'utf8').replace('./main.ts', './main.js'));
// DBX uses a sandboxed srcdoc frame: relative script/style/image URLs are blocked.
const settingsHtml = readFileSync('src/renderer/settings/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="./settings.css">', `<style>${readFileSync('ui/settings.css', 'utf8')}</style>`)
  .replace('<script src="./settings.js"></script>', () => `<script>${readFileSync('ui/settings.js', 'utf8').replaceAll('</script', '<\\/script')}</script>`);
writeFileSync('ui/index.html', settingsHtml);
console.log('Built settings, overlay and core assets (9 emotes).');
