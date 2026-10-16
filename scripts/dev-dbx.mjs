import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
const dbx = resolve(process.argv[2] || '../dbx');
const runtime = join(dbx, 'plugins/sdk/dev-host/runtime.mjs');
const shellHtml = join(dbx, 'plugins/sdk/dev-host/dist/ui/index.html');
if (!existsSync(shellHtml)) throw Error('Build the DBX development host UI first; see its README.');
const target = process.platform === 'win32' ? 'windows-x64' : 'darwin-arm64';
const project = resolve('.stage', target), dataDir = resolve('.test-data/dbx-host');
mkdirSync(dataDir, { recursive: true });
// Older development hosts inherit the environment without supplying this variable.
process.env.DBX_PLUGIN_DATA_DIR = join(dataDir, 'plugin-data');
const manifest = JSON.parse(readFileSync(join(project, 'manifest.json'), 'utf8'));
const { startDevelopment } = await import(pathToFileURL(runtime).href);
await startDevelopment({ project, dataDir, shellHtml, port: 5190, backend: manifest.entrypoints.backend.executable });
