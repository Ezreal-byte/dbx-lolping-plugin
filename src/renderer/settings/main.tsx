import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, LIMITS, type Settings, type TriggerKey } from '../../shared/settings';
import { resolveLang, strings, type Strings } from '../../shared/i18n';
import { ALL_PINGS, type PingId } from '../../shared/pings';
import { vkLabel } from '../../shared/keys';
import { evaluateKeyDown } from './keyCaptureLogic';
import { host, invoke, update, upload, type State, type Emote } from './api';
import './settings.css';

type Capture='trigger'|'emoteTrigger'|'toggleHotkey';
declare const __PING_ICONS__: Record<string, string>;
declare const __PLUGIN_ICON__: string;
const triggerLabel=(key:TriggerKey|'off',platform:'win'|'mac',t:Strings):string=>typeof key==='object'?vkLabel(key.vk,platform):({alt:platform==='mac'?'⌥ Option':'Alt',ctrl:platform==='mac'?'⌃ Control':'Ctrl',shift:'Shift',win:platform==='mac'?'⌘ Command':'Win',capslock:'Caps Lock',mouse4:t.mouse4,mouse5:t.mouse5,off:t.off}[key]);
function App(){
  const [state,setState]=useState<State|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<number|null>(null);const [capture,setCapture]=useState<Capture|null>(null);
  const [hint,setHint]=useState('');const [locale,setLocale]=useState('en');
  const imageInput=useRef<HTMLInputElement>(null),packInput=useRef<HTMLInputElement>(null),soundInput=useRef<HTMLInputElement>(null);
  const soundTarget=useRef('');const loadSequence=useRef(0);
  const settings=state?.settings??DEFAULT_SETTINGS;
  const lang=resolveLang(settings.language,locale),t=strings(lang);
  const load=async()=>{const sequence=++loadSequence.current;const value=await invoke<State>('state');if(sequence===loadSequence.current)setState(value);};
  useEffect(()=>{
    if(!window.dbxPlugin){setError('hostRequired');return;}
    let alive=true,unsubscribe=()=>{};
    const environment=()=>setLocale(host().locale);
    window.addEventListener('dbx-plugin-env',environment);
    void host().ready.then(async()=>{if(!alive)return;setLocale(host().locale);await load();if(!alive)return;
      unsubscribe=host().onEvent((e)=>{
        if(e.method==='lolping/status')setState(s=>s?{...s,status:e.params as State['status']}:s);
        if(e.method==='lolping/settings')void load().catch(e=>setError(String(e.message??e)));
        if(e.method==='lolping/audioError')setError('audio');
      });
    }).catch(e=>setError(String(e.message??e)));
    return()=>{alive=false;unsubscribe();window.removeEventListener('dbx-plugin-env',environment);};
  },[]);
  useEffect(()=>{
    if(!capture||!state)return;
    let cancelled=false;
    void invoke('suspend',{on:true}).catch(e=>{setError(String(e.message??e));setCapture(null);});
    const keydown=(e:KeyboardEvent)=>{
      e.preventDefault();e.stopPropagation();
      const result=evaluateKeyDown(e,{platform:state.platform,requireModifier:capture==='toggleHotkey'});
      if(result.kind==='cancel'){setCapture(null);return;}
      if(result.kind==='hint'){setHint(result.hint);return;}
      if(result.kind==='capture'){
        const value=capture==='toggleHotkey'?{mods:result.mods,vk:result.vk}:{vk:result.vk};
        void patch({[capture]:value});setCapture(null);
      }
    };
    window.addEventListener('keydown',keydown,true);
    const timer=setTimeout(()=>{if(!cancelled)setCapture(null);},15000);
    return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener('keydown',keydown,true);void invoke('suspend',{on:false}).catch(()=>{});};
  },[capture,state?.platform]);
  async function patch(p:Partial<Settings>){
    setError('');setState(s=>s?{...s,settings:{...s.settings,...p}}:s);
    try{const value=await update(p);setState(s=>s?{...s,settings:value}:s);}catch(e){setError(e instanceof Error?e.message:String(e));await load();}
  }
  async function act(method:string,params:unknown={}){setError('');setBusy(true);try{await invoke(method,params);await load();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function importFile(file:File|undefined,kind:'pack'|'image'|'sound'){
    if(!file)return;setError('');setBusy(true);setProgress(0);
    try{await upload(file,kind,setProgress,soundTarget.current);await load();}catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);setProgress(null);for(const ref of [imageInput,packInput,soundInput])if(ref.current)ref.current.value='';}
  }
  function humanError(message:string){if(message==='hostRequired')return t.hostRequired;const key=Object.keys(t.errors).find(k=>message.includes(k));return key?t.errors[key as keyof typeof t.errors]:`${t.error}: ${message}`;}
  const row=(label:React.ReactNode,control:React.ReactNode)=><div className="row"><span>{label}</span><div className="control">{control}</div></div>;
  const toggle=(key:'clickPing'|'emoteClick'|'gameCheck'|'muted'|'tickSound'|'keepLastPing'|'emoteSound')=>row(t[key],<input aria-label={t[key]} role="switch" type="checkbox" checked={settings[key]} onChange={e=>void patch({[key]:e.target.checked})}/>);
  const slider=(key:keyof typeof LIMITS)=>row(t[key],<><input aria-label={t[key]} type="range" {...LIMITS[key]} value={settings[key]} onChange={e=>void patch({[key]:Number(e.target.value)})}/><output>{settings[key]} {key==='volume'?'%':key==='pingDurationS'?t.seconds:t.pixels}</output></>);
  const trigger=(key:'trigger'|'emoteTrigger')=>{
    const platform=state?.platform??'win';const value=settings[key];
    const keys=['alt','ctrl','shift','win',...(platform==='win'?['capslock']:[]),'mouse4','mouse5',...(key==='emoteTrigger'?['off']:[])];
    return row(t[key],<><select aria-label={t[key]} value={typeof value==='object'?'custom':value} onChange={e=>{if(e.target.value==='custom'){setHint('');setCapture(key);}else void patch({[key]:e.target.value});}}>
      {keys.map(k=><option key={k} value={k}>{triggerLabel(k as TriggerKey,platform,t)}</option>)}<option value="custom">{typeof value==='object'?triggerLabel(value,platform,t):t.custom}</option>
    </select><button className="small" onClick={()=>{setHint('');setCapture(key);}}>{t.custom}</button></>);
  };
  const emoteName=(e:Emote)=>lang==='zh-CN'&&e.nameZh?e.nameZh:e.name;
  const pingSelect=(value:string,change:(v:PingId)=>void,label:string)=><select aria-label={label} value={value} onChange={e=>change(e.target.value as PingId)}>{ALL_PINGS.map(p=><option key={p.id} value={p.id}>{t.pingNames[p.id]}</option>)}</select>;
  const emoteSelect=(value:string,change:(v:string)=>void,label:string)=><select aria-label={label} value={value} onChange={e=>change(e.target.value)}>{state?.emotes.map(e=><option key={e.id} value={e.id}>{emoteName(e)}</option>)}</select>;
  const chooseSlot=(key:'wheel'|'emoteWheel',i:number,value:string)=>{
    const items=[...settings[key]];const other=items.indexOf(value);if(other>=0)items[other]=items[i];items[i]=value;
    void patch(key==='wheel'?{wheel:items as PingId[]}:{emoteWheel:items});
  };
  return <div className="app"><main><header><div className="heading"><img className="plugin-icon" src={__PLUGIN_ICON__} alt=""/><div><h1>{t.title}<span className="version">{state?.version??'0.1.0'}</span></h1><p>{t.subtitle}</p></div></div>
      <button className={state?.status.state==='running'||state?.status.state==='starting'?'danger':'primary'} disabled={!state||busy} onClick={()=>void act(state?.status.state==='running'||state?.status.state==='starting'?'stop':'start')}>{state?.status.state==='running'||state?.status.state==='starting'?t.stop:t.start}</button></header>
      <section className="status-card"><div className={`status-dot ${state?.status.enabled?'active':''}`}/><div><strong>{state?t[state.status.state==='running'&&!state.status.enabled?'paused':state.status.state]:t.loading}</strong><p>{t.intro}</p><p className="muted">{t.lifecycle}</p></div></section>
      {state?.status.state==='noAccess'&&<div className="notice"><p>{t.permissionHelp}</p><button onClick={()=>void act('permission')}>{t.permission}</button><button onClick={()=>void act('start')}>{t.retry}</button></div>}
      {(error||state?.status.error)&&<div className="notice error" role="alert">{humanError(error||state?.status.error||'')}</div>}
      {capture&&<div className="notice capture" role="status">{capture==='toggleHotkey'?t.captureShortcut:t.capture}{hint&&<p>{t[hint as 'hintUnusable'|'hintNotTrigger'|'hintNeedModifier']}</p>}<button onClick={()=>setCapture(null)}>Esc</button></div>}
      {progress!==null&&<div className="notice" role="status">{t.upload} · {progress}%<progress value={progress} max={100}/></div>}
      <fieldset disabled={!state||busy}>
      <section id="triggers"><h2>{t.triggers}</h2><div className="panel">{trigger('trigger')}{trigger('emoteTrigger')}
        {row(t.toggle,<button onClick={()=>{setHint('');setCapture('toggleHotkey');}}>{[(settings.toggleHotkey.mods&1)?'Ctrl':'',(settings.toggleHotkey.mods&2)?'Alt':'',(settings.toggleHotkey.mods&4)?'Shift':'',(settings.toggleHotkey.mods&8)?(state?.platform==='mac'?'⌘':'Win'):'',vkLabel(settings.toggleHotkey.vk,state?.platform??'win')].filter(Boolean).join(' + ')}</button>)}
        {slider('dragThresholdPx')}{toggle('clickPing')}{toggle('emoteClick')}{state?.platform==='win'&&toggle('gameCheck')}
      </div></section>
      <section id="pings"><h2>{t.pings}</h2><div className="ping-grid">{ALL_PINGS.map(p=><button className="ping-choice" key={p.id} onClick={()=>void act('preview',{id:p.id,wheel:'ping'})}><img src={__PING_ICONS__[p.icon]} alt=""/><span>{t.pingNames[p.id]}</span></button>)}</div>
        <div className="panel">{slider('volume')}{toggle('muted')}{toggle('tickSound')}{slider('pingSizePx')}{slider('pingDurationS')}{toggle('keepLastPing')}{slider('wheelSizePx')}
          {row(t.clickPingId,pingSelect(settings.clickPingId,id=>void patch({clickPingId:id}),t.clickPingId))}
        </div><h3>{t.wheel}</h3><div className="slot-grid">{settings.wheel.map((id,i)=><label key={i}><span>{t.slots[i]}</span>{pingSelect(id,v=>chooseSlot('wheel',i,v),`${t.wheel} ${t.slots[i]}`)}</label>)}</div>
      </section>
      <section id="emotes"><h2>{t.emotes}</h2><p className="muted">{state?.extraPackInstalled?t.packInstalled:t.packHint}</p>
        <div className="actions"><button onClick={()=>imageInput.current?.click()}>{t.addImage}</button><button disabled={state?.extraPackInstalled} onClick={()=>packInput.current?.click()}>{t.importPack}</button></div>
        <input hidden ref={imageInput} type="file" accept=".png,.jpg,.jpeg,.gif,.webp" onChange={e=>void importFile(e.target.files?.[0],'image')}/>
        <input hidden ref={packInput} type="file" accept=".zip" onChange={e=>void importFile(e.target.files?.[0],'pack')}/>
        <input hidden ref={soundInput} type="file" accept=".wav,.ogg,.mp3" onChange={e=>void importFile(e.target.files?.[0],'sound')}/>
        <div className="emote-grid">{state?.emotes.map(e=><article key={e.id}><button className="emote-preview" title={t.preview} onClick={()=>void act('preview',{id:e.id,wheel:'emote'})}><img src={e.thumbnail} alt=""/><span>{emoteName(e)}</span></button>{e.custom&&<div className="emote-actions"><button onClick={()=>{soundTarget.current=e.id;soundInput.current?.click();}}>{t.sound}</button><button onClick={()=>void act('emote/remove',{id:e.id})}>{t.remove}</button></div>}</article>)}</div>
        <div className="panel">{slider('emoteSizePx')}{toggle('emoteSound')}{row(t.clickEmoteId,emoteSelect(settings.clickEmoteId,id=>void patch({clickEmoteId:id}),t.clickEmoteId))}</div>
        <h3>{t.emoteWheel}</h3><div className="slot-grid">{settings.emoteWheel.map((id,i)=><label key={i}><span>{t.slots[i]}</span>{emoteSelect(id,v=>chooseSlot('emoteWheel',i,v),`${t.emoteWheel} ${t.slots[i]}`)}</label>)}</div>
      </section>
      <section id="preferences"><h2>{t.preferences}</h2><div className="panel">{row(t.language,<select aria-label={t.language} value={settings.language} onChange={e=>void patch({language:e.target.value as Settings['language']})}><option value="auto">{t.auto}</option><option value="zh-CN">简体中文</option><option value="en">English</option></select>)}{row(t.reset,<button onClick={()=>void patch(DEFAULT_SETTINGS)}>{t.reset}</button>)}</div></section>
      </fieldset><footer>{t.attribution}</footer>
    </main></div>;
}
const root=document.getElementById('root');if(root)createRoot(root).render(<App/>);
