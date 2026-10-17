import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { Rpc } from './rpc.mjs';
const target=process.platform==='win32'?'windows-x64':'darwin-arm64';
const root=resolve('.stage',target), rpc=new Rpc(root,resolve('.test-data','dev'));await rpc.initialize();
const port=Number(process.env.PORT||4178),origin=`http://127.0.0.1:${port}`;
const clients=new Set();rpc.on('event',e=>{for(const c of clients)c.write(`data: ${JSON.stringify(e)}\n\n`);});
const bridge=`window.dbxPlugin={ready:Promise.resolve(),locale:'zh-CN',invoke:async(method,params)=>{const r=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params})});const v=await r.json();if(v.error)throw Error(v.error);return v.result;},sendBinary:async(channel,data)=>{const r=await fetch('/binary?channel='+encodeURIComponent(channel),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:data});if(!r.ok)throw Error(await r.text());},onEvent:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};const listeners=new Set();new EventSource('/events').onmessage=e=>{const v=JSON.parse(e.data);for(const fn of listeners)fn(v);};`;
const server=createServer(async(req,res)=>{
  try{
    if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403).end();return;}
    const url=new URL(req.url,origin);
    if(url.pathname==='/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.write(': ready\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
    if(req.method==='POST'){
      let size=0;const chunks=[];for await(const b of req){size+=b.length;if(size>1024*1024)throw Error('Request too large');chunks.push(b);}const bytes=Buffer.concat(chunks);
      if(url.pathname==='/binary'){rpc.binary(url.searchParams.get('channel')||'',bytes);res.end('ok');return;}
      if(url.pathname==='/rpc'){const {method,params}=JSON.parse(bytes);const result=await rpc.request(method,params);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result}));return;}
    }
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);if(path.includes('..')||path.includes('\\'))throw Error('Invalid path');
    const file=resolve(root,'ui',path);if(!file.startsWith(resolve(root,'ui')+'/')&&!file.startsWith(resolve(root,'ui')+'\\'))throw Error('Invalid path');
    if(!existsSync(file)){res.writeHead(404).end();return;}
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'}[extname(file)]||'application/octet-stream';
    res.setHeader('Content-Type',mime);let data=readFileSync(file);if(path==='index.html'){
      // Local visual QA only: exercise the same theme attribute and locale as DBX.
      const theme=url.searchParams.get('theme')==='dark'?'dark':'light';
      const locale=url.searchParams.get('locale')==='en'?'en':'zh-CN';
      const environment=`document.documentElement.dataset.dbxTheme=${JSON.stringify(theme)};window.dbxPlugin.locale=${JSON.stringify(locale)};`;
      data=Buffer.from(data.toString().replace('<head>','<head><script>'+bridge+environment+'</script>'));
    }res.end(data);
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Development settings: ${origin}`));
async function close(){for(const c of clients)c.end();server.close();await rpc.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
