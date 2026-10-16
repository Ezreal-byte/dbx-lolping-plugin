import type { Settings } from '../../shared/settings';
export interface Status {state:'stopped'|'starting'|'running'|'failed'|'noAccess';enabled:boolean;error:string|null}
export interface Emote {id:string;name:string;nameZh?:string;custom:boolean;thumbnail:string;animated?:boolean;sound?:boolean}
export interface State {status:Status;settings:Settings;emotes:Emote[];platform:'win'|'mac';extraPackInstalled:boolean;version:string}
interface HostEvent {method:string;params:unknown}
export interface Host {ready:Promise<void>;locale:string;invoke(method:string,params?:unknown):Promise<unknown>;sendBinary(channel:string,data:ArrayBuffer):Promise<void>;onEvent(listener:(e:HostEvent)=>void):()=>void}
declare global {interface Window{dbxPlugin?:Host}}
export function host():Host{if(!window.dbxPlugin)throw new Error('hostRequired');return window.dbxPlugin;}
export async function invoke<T>(method:string,params:unknown={}):Promise<T>{return await host().invoke(`lolping/${method}`,params) as T;}
let writes=Promise.resolve();
export function update(patch:Partial<Settings>):Promise<Settings>{const result=writes.then(()=>invoke<Settings>('settings',patch));writes=result.then(()=>undefined,()=>undefined);return result;}
export async function upload(file:File,kind:'image'|'sound'|'pack',progress:(p:number)=>void,target?:string){
  const max=kind==='pack'?64*1024*1024:kind==='image'?8*1024*1024:1024*1024;
  if(file.size>max)throw new Error('uploadTooLarge');
  const {id}=await invoke<{id:string}>('upload/begin',{kind,size:file.size,name:file.name.replace(/\.[^.]+$/,''),target});
  try{
    for(let offset=0;offset<file.size;offset+=512*1024){
      const bytes=await file.slice(offset,offset+512*1024).arrayBuffer();const frame=new Uint8Array(bytes.byteLength+8);
      new DataView(frame.buffer).setBigUint64(0,BigInt(offset));frame.set(new Uint8Array(bytes),8);
      let unsubscribe=()=>{};let timeout:ReturnType<typeof setTimeout>;
      const ack=new Promise<void>((resolve,reject)=>{
        timeout=setTimeout(()=>{unsubscribe();reject(new Error('uploadTimeout'));},15000);
        unsubscribe=host().onEvent((event)=>{if(event.method!=='lolping/upload')return;const p=event.params as {id?:string;received?:number;error?:string};if(p.id!==id)return;
          clearTimeout(timeout);unsubscribe();if(p.error)reject(new Error(p.error));else if(p.received===offset+bytes.byteLength)resolve();else reject(new Error('invalidChunkOffset'));
        });
      });
      try{await Promise.all([host().sendBinary(`upload/${id}`,frame.buffer),ack]);}finally{unsubscribe();clearTimeout(timeout!);}
      progress(Math.round((offset+bytes.byteLength)/file.size*100));
    }
    return await invoke('upload/commit',{id});
  }catch(error){await invoke('upload/cancel',{id}).catch(()=>{});throw error;}
}
