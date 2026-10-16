import { DEFAULT_SETTINGS, type Settings } from '../../shared/settings';
import { ALL_PINGS, pingById, textureUrl } from '../../shared/pings';
import { customAnimUrl, customStillUrl, emoteIconUrl, isCustomRef, customHash, type EmoteArt } from '../../shared/emotes';
import { Wheel } from './wheel';
import { spawnPing } from './pingFx';
import { EmoteStage } from './emoteFx';

declare global {interface Window {ipc:{postMessage(message:string):void};receive:(name:string,p:Record<string,unknown>|Settings|null)=>void;pendingPreview?:Record<string,unknown>|null}}
const send=(v:object)=>window.ipc.postMessage(JSON.stringify(v));
const layer=document.querySelector<HTMLElement>('#pings');
const svg=document.querySelector<SVGSVGElement>('#wheel');
if (!layer || !svg) throw new Error('Missing overlay elements');
const emoteSvg=svg.cloneNode(false) as SVGSVGElement;emoteSvg.id='emoteWheel';svg.after(emoteSvg);
const emoteLayer=document.createElement('div');emoteLayer.id='emotes';layer.after(emoteLayer);
let settings:Settings=structuredClone(DEFAULT_SETTINGS);
const sound=(key:string)=>send({type:'sound',key});
const pingWheel=new Wheel(svg,'PING',textureUrl('generic_ping'),()=>sound('button'));
const emoteWheel=new Wheel(emoteSvg,'EMOTE',emoteIconUrl('facepalm'),()=>sound('button'));
const stage=new EmoteStage(emoteLayer);let kept:HTMLElement|null=null;
let epoch=0;
function reportIdle(){
  if(!pingWheel.isOpen&&!emoteWheel.isOpen&&!layer!.childElementCount&&!emoteLayer.childElementCount)send({type:'idle',epoch});
}
// No polling or animation loop while idle. DOM removal is the completion signal, including kept pings.
const observer=new MutationObserver(reportIdle);
observer.observe(layer,{childList:true});observer.observe(emoteLayer,{childList:true});
function apply(s:Settings){settings=s;pingWheel.setSize(s.wheelSizePx);emoteWheel.setSize(s.wheelSizePx);
  pingWheel.setItems(s.wheel.map((id)=>{const p=pingById(id)??ALL_PINGS[0];return {key:p.id,icon:textureUrl(p.icon)};}));
  emoteWheel.setItems(s.emoteWheel.map((id)=>({key:id,icon:isCustomRef(id)?customStillUrl(customHash(id)):emoteIconUrl(id)})));
  if(!s.keepLastPing){kept?.remove();kept=null;}
}
function place(id:string,x:number,y:number,emote:boolean,preview=false){
  if(emote){let art:EmoteArt={kind:'bundled',slug:id};let hasSound=true;
    if(isCustomRef(id)){const item=settings.customEmotes.find((c)=>c.id===id);if(!item)return;const hash=customHash(id);art={kind:'custom',url:item.animated?customAnimUrl(hash):customStillUrl(hash),animated:item.animated};hasSound=item.sound===true;}
    stage.spawn(preview?'preview':'self',art,x,y,{sizePx:settings.emoteSizePx});if(hasSound)sound(`emote:${id}`);
  }else{const def=pingById(id);if(!def||!layer)return;const keep=!preview&&settings.keepLastPing;
    kept?.remove();kept=null;const element=spawnPing(layer,def,x,y,{sizePx:settings.pingSizePx,durationS:settings.pingDurationS,keep});if(keep)kept=element;sound(def.sound);
  }
  if(!preview)send({type:'selected'});
}
window.receive=(name,raw)=>{
  const p=(raw??{}) as Record<string,unknown>;const emote=p.wheel==='emote';const wheel=emote?emoteWheel:pingWheel;
  if(typeof p._epoch==='number')epoch=p._epoch;
  if(name==='settings'){apply(raw as Settings);reportIdle();return;}
  if(name==='maintenance'){stage.trimCache();return;}
  const x=Number(p.x??0),y=Number(p.y??0);
  switch(name){
    case 'wheelOpen':wheel.open(x,y);break;
    case 'wheelMove':wheel.move(x,y);break;
    case 'wheelRelease':{const chosen=wheel.release(x,y);if(chosen)place(chosen.key,chosen.x,chosen.y,emote);break;}
    case 'click':place(emote?settings.clickEmoteId:settings.clickPingId,x,y,emote);break;
    case 'preview':place(String(p.id),x,y,emote,true);break;
    case 'cancel':pingWheel.cancel();emoteWheel.cancel();break;
    case 'library':stage.clear('self');stage.clear('preview');break;
    case 'clear':pingWheel.cancel();emoteWheel.cancel();layer!.replaceChildren();kept=null;stage.clear('self');stage.clear('preview');break;
  }
  if(name==='wheelOpen'||name==='click'||name==='preview'){
    const frameEpoch=epoch;requestAnimationFrame(()=>send({type:'frame',epoch:frameEpoch}));
  }
  reportIdle();
};
apply(settings);send({type:'ready'});
if(window.pendingPreview){window.receive('preview',window.pendingPreview);window.pendingPreview=null;}
