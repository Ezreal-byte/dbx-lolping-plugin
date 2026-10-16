// Imports the audited revision. Run only when intentionally updating vendored resources.
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const source = resolve(process.argv[2] ?? '../lolPing');
const expected = 'b947aab8d379015687117544191160bd82141954';
const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== expected) throw new Error(`Expected upstream ${expected}, received ${revision}`);
mkdirSync('resources', { recursive: true });
for (const dir of ['emotes', 'textures', 'sounds']) cpSync(join(source, 'assets', dir), join('resources', dir), { recursive: true });
const catalog = [...readFileSync(join(source, 'src/shared/emoteCatalog.ts'), 'utf8').matchAll(/\{ slug: '([^']+)', leagueId: (\d+), name: '((?:\\.|[^'])*)', nameZh: '((?:\\.|[^'])*)', hasSound: (true|false) \}/g)]
  .map((m) => ({ slug: m[1], leagueId: Number(m[2]), name: m[3].replaceAll("\\'", "'"), nameZh: m[4].replaceAll("\\'", "'"), hasSound: m[5] === 'true' }));
if (catalog.length !== 44) throw new Error('Unexpected upstream catalog');
const files = {};
for (const dir of ['emotes', 'textures', 'sounds']) for (const file of readdirSync(join('resources', dir))) {
  const bytes = readFileSync(join('resources', dir, file));
  files[`${dir}/${file}`] = { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
writeFileSync('resources/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
writeFileSync('resources/upstream.json', JSON.stringify({ repository: 'https://github.com/darrenprx/lolPing', revision, files }, null, 2) + '\n');
console.log(`Imported ${catalog.length} emotes and ${Object.keys(files).length} assets at ${revision}`);
