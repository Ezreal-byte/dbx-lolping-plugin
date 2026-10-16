// A real Windows WebView probe; no synthetic OS input or changes to installed plugin data.
// Frame timing is dispatch -> renderer animation-frame ACK, not hardware input-to-photon latency.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Rpc } from './rpc.mjs';
if(process.platform!=='win32')throw Error('Memory probe currently supports Windows only');
const stage=resolve(process.argv[2]||'.stage/windows-x64');
const rpc=new Rpc(stage,resolve('.test-data',`benchmark-${Date.now()}`));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const memory=()=>JSON.parse(execFileSync(process.env.CODEX_PWSH_PATH||'pwsh',['-NoProfile','-File',resolve('scripts/measure-processes.ps1'),'-RootProcess',String(rpc.child.pid)],{encoding:'utf8',windowsHide:true}));
const report={version:rpc.manifest.version,measurement:'Working-set sum includes shared pages; private commit is not resident RAM. Frame ACK excludes OS input and display scanout.',samples:{}};
try{
  await rpc.initialize();await rpc.request('lolping/settings',{volume:0,keepLastPing:false,trigger:{vk:117},pingDurationS:1});
  await rpc.request('lolping/start');await rpc.waitFor(e=>e.method==='lolping/status'&&e.params.state==='running');
  for(let i=0;i<12;i++){await rpc.request('lolping/preview',{id:i%2?'danger':'generic',wheel:'ping'});await sleep(100);}
  await sleep(4000);report.samples.warm=memory();
  await sleep(17000);report.samples.idle=memory();
  let d=await rpc.request('lolping/diagnostics');
  if(rpc.manifest.version!=='0.1.0'){
    assert.equal(d.visibleWindows,0);assert.equal(d.lowMemoryWindows,d.windows);
    const initialFrames=d.frameMs.length;
    await rpc.request('lolping/preview',{id:'danger',wheel:'ping'});
    for(let i=0;i<200;i++){d=await rpc.request('lolping/diagnostics');if(d.frameMs.length>initialFrames)break;await sleep(10);}
    assert.equal(d.frameMs.length,initialFrames+1,'First idle wake must render');
    report.firstIdleWakeFrameMs=d.frameMs.at(-1);
    for(let i=0;i<24;i++){await rpc.request('lolping/preview',{id:'danger',wheel:'ping'});await sleep(50);}
    await sleep(200);d=await rpc.request('lolping/diagnostics');assert.equal(d.frameMs.length,initialFrames+25,'Every repeated signal must render');
    const warm=d.frameMs.slice(initialFrames+1).sort((a,b)=>a-b);
    report.warmFrames={count:warm.length,p50Ms:warm[Math.floor(warm.length*.5)],p95Ms:warm[Math.floor(warm.length*.95)],maxMs:warm.at(-1)};
    assert.ok(report.firstIdleWakeFrameMs<100,'Idle wake exceeded 100ms frame-ACK regression budget');
    assert.ok(report.warmFrames.p95Ms<80,'Repeated frame ACK exceeded 80ms regression budget');
  }
  await rpc.request('lolping/stop');await sleep(3000);report.samples.stopped=memory();
  mkdirSync('dist',{recursive:true});writeFileSync(`dist/performance-${rpc.manifest.version}-report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await rpc.close();}
