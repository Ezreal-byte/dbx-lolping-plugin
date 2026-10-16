import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { unzipSync } from 'fflate';
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
const validate = ajv.compile(JSON.parse(readFileSync('resources/dbx-manifest.schema.json', 'utf8')));
const report = [];
for (const filename of readdirSync('dist').filter(n => n.endsWith('.dbxp'))) {
  const bytes = readFileSync(`dist/${filename}`), files = unzipSync(bytes);
  const manifest = JSON.parse(Buffer.from(files['manifest.json']).toString());
  assert.ok(validate(manifest), JSON.stringify(validate.errors));
  const checksums = JSON.parse(Buffer.from(files['checksums.json']).toString());
  assert.equal(checksums.algorithm, 'sha256');
  assert.equal(Object.keys(checksums.files).length, Object.keys(files).length - 1);
  for (const [path, expected] of Object.entries(checksums.files)) {
    assert.ok(!path.startsWith('/') && !path.split('/').includes('..') && !path.includes('\\'));
    assert.equal(createHash('sha256').update(files[path]).digest('hex'), expected, path);
  }
  assert.ok(files[manifest.entrypoints.backend.executable]); assert.ok(files[manifest.entrypoints.ui.entry]);
  const settingsHtml = Buffer.from(files[manifest.entrypoints.ui.entry]).toString();
  assert.ok(!/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(settingsHtml), 'Settings must work inside the DBX srcdoc sandbox');
  assert.ok(settingsHtml.includes('data:image/png;base64,'), 'Ping icons must use sandbox-compatible URLs');
  assert.equal(manifest.entrypoints.backend.transport, 'stdio-framed');
  assert.equal(Object.keys(files).filter(p => /^ui\/emotes\/.*\.webp$/.test(p)).length, 9);
  assert.ok(!Object.keys(files).some(p => /electron|node_modules|rooms?\//i.test(p)));
  assert.ok(bytes.length <= 30 * 1048576, `Core package exceeds 30 MiB: ${filename}`);
  report.push({ filename, bytes: bytes.length, files: Object.keys(files).length, schema: 'valid', checksums: 'valid', coreEmotes: 9, within30MiB: true });
}
assert.ok(report.length);writeFileSync('dist/package-verification-report.json', JSON.stringify(report, null, 2));console.log(JSON.stringify(report, null, 2));
