// Active animation + idle CPU/memory probe for the native overlay, using isolated data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {Rpc} from './rpc.mjs';
if(process.platform!=='win32') throw Error('Windows memory measurement only');
const rpc=new Rpc(resolve('.stage/windows-x64'),resolve('.test-data',`native-load-${Date.now()}`));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const memory=()=>JSON.parse(execFileSync(process.env.CODEX_PWSH_PATH||'pwsh',['-NoProfile','-File',resolve('scripts/measure-processes.ps1'),'-RootProcess',String(rpc.child.pid)],{encoding:'utf8',windowsHide:true}));
const report={version:rpc.manifest.version,scope:'Isolated native plugin process tree; one desktop, sampled working set includes shared pages. CPU is one-core-equivalent percentage. Active samples are not a maximum-memory guarantee.',samples:{}};
try {
  await rpc.initialize();await rpc.request('lolping/settings',{muted:true,keepLastPing:false,trigger:{vk:117}});
  await rpc.request('lolping/start');await rpc.waitFor(e=>e.method==='lolping/status'&&e.params.state==='running');
  report.samples.started=memory();
  for(const id of ['facepalm','unworthy_cn','gg_heart']) {
    await rpc.request('lolping/preview',{id,wheel:'emote'});await sleep(700);
    report.samples[`emote-${id}`]=memory();
    await sleep(2700);
  }
  const {id}=await rpc.upload(readFileSync('resources/emotes/bee_mad.webp'),'image');
  await rpc.request('lolping/preview',{id,wheel:'emote'});await sleep(700);report.samples.customAnimated=memory();await sleep(2700);
  await rpc.request('lolping/settings',{muted:false,volume:10});
  await rpc.request('lolping/preview',{id:'danger',wheel:'ping'});await sleep(500);report.samples.pingWithAudio=memory();
  await sleep(4000);const start=memory(),t=Date.now();await sleep(5000);report.samples.idle=memory();
  report.idleCpuOneCorePercent=(report.samples.idle.cpuSeconds-start.cpuSeconds)/((Date.now()-t)/1000)*100;
  for(const sample of Object.values(report.samples)) {
    assert.ok(!sample.processes.some(p=>/webview|webkit|chrome|msedge/i.test(p.name)),'No browser processes');
    assert.ok(sample.workingSetBytes<200*1048576,'Native process tree exceeded the 200 MiB sampled budget');
  }
  await rpc.request('lolping/stop');await sleep(1000);report.samples.stopped=memory();
  mkdirSync('dist',{recursive:true});writeFileSync('dist/native-load-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally {await rpc.close();}
