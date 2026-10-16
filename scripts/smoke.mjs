import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { zipSync, unzipSync } from 'fflate';
import { Rpc } from './rpc.mjs';
import { once } from 'node:events';
const target = process.platform === 'win32' ? 'windows-x64' : 'darwin-arm64';
const stage = resolve('.stage', target), data = resolve('.test-data', `smoke-${Date.now()}`);
const rpc = new Rpc(stage, data); const results = [];
try {
  const hello = await rpc.initialize(); assert.equal(hello.protocolVersion, 1); assert.equal(hello.plugin.id, 'io.dbx.lolping.lite'); results.push('framed handshake');
  let s = await rpc.request('lolping/state'); assert.equal(s.status.state, 'stopped'); assert.equal(s.emotes.length, 9); results.push('manual activation and nine core emotes');
  await rpc.request('lolping/settings', { volume: 101, trigger: { vk: 65 }, toggleHotkey: { mods: 4, vk: 66 } });
  s = await rpc.request('lolping/state'); assert.equal(s.settings.volume, 100); assert.deepEqual(s.settings.toggleHotkey, { mods: 3, vk: 80 });
  await rpc.request('lolping/settings', { volume: 0, trigger: 'alt', keepLastPing: false }); results.push('settings validation and persistence');
  const settingEvent = rpc.history.filter(e=>e.method==='lolping/settings').at(-1);
  assert.equal(settingEvent.params.settings.volume,0);assert.equal(settingEvent.params.emotes,undefined);
  assert.equal(rpc.history.filter(e=>e.method==='lolping/library').length,0);
  const eventCount=rpc.history.filter(e=>e.method==='lolping/settings').length;
  await rpc.request('lolping/settings',{volume:0});assert.equal(rpc.history.filter(e=>e.method==='lolping/settings').length,eventCount);
  results.push('settings events carry no thumbnails and unchanged settings do not write or broadcast');
  const { id } = await rpc.upload(readFileSync('resources/emotes/facepalm.png'), 'image');
  s = await rpc.request('lolping/state'); assert.equal(s.emotes.length, 10); assert.ok(id.startsWith('c:'));
  await assert.rejects(rpc.upload(readFileSync('resources/emotes/facepalm.png'), 'image'), /duplicateEmote/); results.push('custom image and duplicate rejection');
  await rpc.upload(readFileSync('resources/emotes/facepalm.ogg'), 'sound', { target: id });
  s = await rpc.request('lolping/state'); assert.equal(s.settings.customEmotes[0].sound, true); results.push('custom OGG sound');
  const pack = readFileSync('dist/lolping-extra-emotes-1.zip'); await rpc.upload(pack, 'pack');
  s = await rpc.request('lolping/state'); assert.equal(s.emotes.length, 45); assert.equal(s.extraPackInstalled, true);
  await rpc.upload(pack, 'pack'); results.push('offline pack and idempotent reimport');
  await assert.rejects(rpc.upload(Buffer.from('invalid zip'), 'pack'), /invalidPack/);
  const bad = unzipSync(pack), first = Object.keys(bad).find(k => k.endsWith('.png')); bad['../escape.png'] = bad[first]; delete bad[first];
  await assert.rejects(rpc.upload(Buffer.from(zipSync(bad)), 'pack'), /unsafePackPath/); results.push('corrupt and traversal packs rejected');
  await rpc.request('lolping/emote/remove', { id }); s = await rpc.request('lolping/state'); assert.equal(s.emotes.length, 44); results.push('custom emote removal');
  if (!process.argv.includes('--no-desktop')) {
    await rpc.request('lolping/preview', { id: 'danger', wheel: 'ping' });
    let d = await rpc.request('lolping/diagnostics'); assert.ok(d.windows > 0);
    await rpc.waitFor(e => e.method === 'lolping/overlayReady' && e.params.count === d.windows);
    d = await rpc.request('lolping/diagnostics'); assert.equal(d.windows, d.readyWindows); assert.equal(d.helperPid, null); assert.equal(d.renderer,'native'); results.push('native overlays initialize on every display without input hooks for preview');
    if(process.platform==='win32') assert.deepEqual(d.systemFrames,Array(d.windows).fill(false),'DWM must not decorate transparent surfaces');
    await rpc.request('lolping/start'); await rpc.waitFor(e => e.method === 'lolping/status' && e.params.state === 'running');
    d = await rpc.request('lolping/diagnostics'); assert.ok(d.helperPid > 0); const pid = d.helperPid;
    await rpc.request('lolping/start'); d = await rpc.request('lolping/diagnostics'); assert.equal(d.helperPid, pid);
    const configWrites=d.helperConfigWrites;
    await rpc.request('lolping/settings',{volume:5,pingSizePx:120});
    d=await rpc.request('lolping/diagnostics');assert.equal(d.helperConfigWrites,configWrites);
    await rpc.request('lolping/settings',{volume:0});
    await rpc.request('lolping/pause',{on:true});s=await rpc.request('lolping/state');assert.equal(s.status.enabled,false);assert.equal(s.status.pauseReason,'manual');
    await rpc.request('lolping/suspend', { on: true });s=await rpc.request('lolping/state');assert.equal(s.status.pauseReason,'capture');
    await rpc.request('lolping/suspend', { on: false });s=await rpc.request('lolping/state');assert.equal(s.status.pauseReason,'manual');assert.equal(s.status.enabled,false);
    await rpc.request('lolping/pause',{on:false});s=await rpc.request('lolping/state');assert.equal(s.status.enabled,true);assert.equal(s.status.pauseReason,null);
    results.push('appearance edits preserve input configuration; capture restores a prior manual pause');
    const waitForDiagnostics=async(predicate,timeout=20000)=>{const end=Date.now()+timeout;do{const value=await rpc.request('lolping/diagnostics');if(predicate(value))return value;await new Promise(r=>setTimeout(r,100));}while(Date.now()<end);throw Error('Overlay lifecycle timeout');};
    await waitForDiagnostics(d=>d.visibleWindows===0&&d.lowMemoryWindows===d.windows);
    for(let i=0;i<12;i++)await rpc.request('lolping/preview',{id:'danger',wheel:'ping'});
    d=await waitForDiagnostics(d=>d.frameMs.length>=12);assert.ok(d.visibleWindows>0);assert.equal(d.helperPid,pid);
    if(process.platform==='win32') {
      assert.deepEqual(d.systemFrames,Array(d.windows).fill(false),'DWM decoration must stay disabled after idle/wake and resize');
      results.push('Windows system frames remain disabled through show, hide, resize and wake');
    }
    await rpc.request('lolping/pause',{on:true});await waitForDiagnostics(d=>d.visibleWindows===0);
    await rpc.request('lolping/pause',{on:false});
    results.push('hidden idle overlays wake without recreation, acknowledge burst frames, and clear on pause');
    await rpc.request('lolping/stop'); d = await rpc.request('lolping/diagnostics'); assert.equal(d.windows, 0); assert.equal(d.helperPid, null);
    assert.throws(() => process.kill(pid, 0)); results.push('idempotent start, key capture suspension, stop removes helper and windows');
    rpc.history.length = 0;
    await rpc.request('lolping/start'); await rpc.waitFor(e => e.method === 'lolping/status' && e.params.state === 'running');
    const running = await rpc.request('lolping/diagnostics');
    await rpc.close(); assert.throws(() => process.kill(running.helperPid, 0)); results.push('host pipe EOF cleans running helper and overlays');
  }
  await rpc.close();
  const second = new Rpc(stage, data); try { await second.initialize(); s = await second.request('lolping/state'); assert.equal(s.status.state, 'stopped'); assert.equal(s.settings.volume, 0); assert.equal(s.emotes.length, 44); } finally { await second.close(); }
  results.push('restart preserves settings and pack while remaining stopped');
  if (!process.argv.includes('--no-desktop')) {
    const crash = new Rpc(stage, data);
    try {
      await crash.initialize(); await crash.request('lolping/start');
      await crash.waitFor(e => e.method === 'lolping/status' && e.params.state === 'running');
      const d = await crash.request('lolping/diagnostics');
      const exit = once(crash.child, 'exit'); crash.child.kill(); await exit;
      const end = Date.now() + 4000;
      while (Date.now() < end) {
        try { process.kill(d.helperPid, 0); } catch { break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert.throws(() => process.kill(d.helperPid, 0)); results.push('forced sidecar termination leaves no input helper');
    } finally { await crash.close(); }
  }
  mkdirSync('dist', { recursive: true });writeFileSync('dist/smoke-report.json', JSON.stringify({ target, passed: results, at: new Date().toISOString(), dataDirectory: data }, null, 2));
  console.log(JSON.stringify({ passed: results }, null, 2));
} finally { await rpc.close(); }
