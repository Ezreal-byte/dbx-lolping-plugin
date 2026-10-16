import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const artifacts = readdirSync(root).filter(n=>n.endsWith('.artifact.json')).map(name=>{
  const a = JSON.parse(readFileSync(join(root, name), 'utf8'));
  assert.ok(['windows-x64','darwin-arm64'].includes(a.target));
  assert.equal(a.url, `${manifest.id}-${manifest.version}-${a.target}.dbxp`);
  const bytes = readFileSync(join(root,a.url));
  assert.equal(bytes.length,a.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
  return {target:a.target,url:a.url,sha256:a.sha256,size:a.size};
}).sort((a,b)=>a.target.localeCompare(b.target));
assert.deepEqual(artifacts.map(a=>a.target),['darwin-arm64','windows-x64']);
writeFileSync(join(root,'release-candidates.json'),JSON.stringify({schemaVersion:1,plugin:{id:manifest.id,publisher:manifest.publisher,version:manifest.version,permissions:manifest.permissions},artifacts},null,2)+'\n');
console.log('Verified both platform artifacts and wrote release-candidates.json');
