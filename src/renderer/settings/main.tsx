import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS, LIMITS, type Settings, type TriggerKey } from '../../shared/settings';
import { resolveLang, strings, type Strings } from '../../shared/i18n';
import { ALL_PINGS, type PingId } from '../../shared/pings';
import { HOTKEY_PRIMARY_MODS, vkLabel } from '../../shared/keys';
import { dropPatch } from '../../shared/wheelLayout';
import { evaluateKeyDown } from './keyCaptureLogic';
import { host, invoke, update, upload, type State, type Emote } from './api';
import { SettingsWriter } from './settingsWriter';
import { Icon, type IconName } from './Icon';
import { WheelEditor, type WheelSelection } from './WheelEditor';
import './settings.css';

type Capture='trigger'|'emoteTrigger'|'toggleHotkey';
type Tab='trigger'|'hotkey'|'sound'|'wheel'|'emotes'|'app';
declare const __PING_ICONS__: Record<string, string>;
declare const __PLUGIN_ICON__: string;
const triggerLabel=(key:TriggerKey|'off',platform:'win'|'mac',t:Strings):string=>typeof key==='object'?vkLabel(key.vk,platform):({alt:platform==='mac'?'⌥ Option':'Alt',ctrl:platform==='mac'?'⌃ Control':'Ctrl',shift:'Shift',win:platform==='mac'?'⌘ Command':'Win',capslock:'Caps Lock',mouse4:t.mouse4,mouse5:t.mouse5,off:t.off}[key]);
function App(){
  const [state,setState]=useState<State|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<number|null>(null);const [capture,setCapture]=useState<Capture|null>(null);
  const [hint,setHint]=useState('');const [locale,setLocale]=useState('en');
  const [saving,setSaving]=useState(false);
  const [tab,setTab]=useState<Tab>('trigger');
  const [emoteTab,setEmoteTab]=useState<'library'|'wheel'>('library');
  const [pingSlot,setPingSlot]=useState<WheelSelection>(0),[emoteSlot,setEmoteSlot]=useState<WheelSelection>(0);
  const [search,setSearch]=useState(''),[previewPing,setPreviewPing]=useState<PingId>('missing');
  const [pendingDelete,setPendingDelete]=useState<string|null>(null),[confirmReset,setConfirmReset]=useState(false);
  const [modifierHint,setModifierHint]=useState(false);
  const contentRef=useRef<HTMLDivElement>(null),scrollPositions=useRef<Partial<Record<Tab,number>>>({});
  useLayoutEffect(()=>{if(contentRef.current)contentRef.current.scrollTop=scrollPositions.current[tab]??0;},[tab]);
  const imageInput=useRef<HTMLInputElement>(null),packInput=useRef<HTMLInputElement>(null),soundInput=useRef<HTMLInputElement>(null);
  const soundTarget=useRef('');const loadSequence=useRef(0);const settingsEpoch=useRef(0);
  const settings=state?.settings??DEFAULT_SETTINGS;
  const lang=resolveLang(settings.language,locale),t=strings(lang);
  const writer=useRef<SettingsWriter|null>(null);
  const load=async()=>{const sequence=++loadSequence.current,epoch=settingsEpoch.current;const value=await invoke<State>('state');if(sequence===loadSequence.current)setState(s=>({...value,settings:writer.current!.overlay(epoch===settingsEpoch.current?value.settings:s?.settings??value.settings)}));};
  if(!writer.current)writer.current=new SettingsWriter(update,
    value=>{settingsEpoch.current++;setState(s=>s?{...s,settings:value}:s);},
    e=>{setError(e instanceof Error?e.message:String(e));void load().catch(()=>{});},setSaving);
  useEffect(()=>{
    if(!window.dbxPlugin){setError('hostRequired');return;}
    let alive=true,unsubscribe=()=>{};
    const environment=()=>setLocale(host().locale);
    window.addEventListener('dbx-plugin-env',environment);
    void host().ready.then(async()=>{if(!alive)return;setLocale(host().locale);await load();if(!alive)return;
      unsubscribe=host().onEvent((e)=>{
        if(e.method==='lolping/status')setState(s=>s?{...s,status:e.params as State['status']}:s);
        if(e.method==='lolping/settings'){settingsEpoch.current++;setState(s=>s?{...s,settings:writer.current!.overlay((e.params as {settings:Settings}).settings)}:s);}
        if(e.method==='lolping/library')void load().catch(e=>setError(String(e.message??e)));
        if(e.method==='lolping/audioError')setError('audio');
      });
    }).catch(e=>setError(String(e.message??e)));
    const flush=()=>writer.current!.flush();
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',flush);
    return()=>{flush();alive=false;unsubscribe();window.removeEventListener('dbx-plugin-env',environment);window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',flush);};
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
  function patch(p:Partial<Settings>,deferred=false){
    settingsEpoch.current++;
    setError('');setState(s=>s?{...s,settings:{...s.settings,...p}}:s);
    writer.current!.set(p,deferred);
  }
  async function act(method:string,params:unknown={}){setError('');setBusy(true);try{await invoke(method,params);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function importFile(file:File|undefined,kind:'pack'|'image'|'sound'){
    if(!file)return;setError('');setBusy(true);setProgress(0);
    try{await upload(file,kind,setProgress,soundTarget.current);}catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);setProgress(null);for(const ref of [imageInput,packInput,soundInput])if(ref.current)ref.current.value='';}
  }
  function humanError(message:string){if(message==='hostRequired')return t.hostRequired;const key=Object.keys(t.errors).find(k=>message.includes(k));return key?t.errors[key as keyof typeof t.errors]:`${t.error}: ${message}`;}
  const zh=lang==='zh-CN',copy=(cn:string,en:string)=>zh?cn:en;
  const row=(label:React.ReactNode,control:React.ReactNode,description?:string)=><div className="setting-row"><div className="row-copy"><strong>{label}</strong>{description&&<p>{description}</p>}</div><div className="control">{control}</div></div>;
  const toggle=(key:'clickPing'|'emoteClick'|'gameCheck'|'muted'|'tickSound'|'keepLastPing'|'emoteSound',description?:string)=>row(t[key],<input aria-label={t[key]} role="switch" type="checkbox" checked={settings[key]} onChange={e=>void patch({[key]:e.target.checked})}/>,description);
  const slider=(key:keyof typeof LIMITS,description?:string)=>row(t[key],<><input aria-label={t[key]} type="range" {...LIMITS[key]} value={settings[key]} onChange={e=>patch({[key]:Number(e.target.value)},true)} onPointerUp={()=>writer.current!.flush()} onKeyUp={()=>writer.current!.flush()} onBlur={()=>writer.current!.flush()}/><output>{settings[key]} {key==='volume'?'%':key==='pingDurationS'?t.seconds:t.pixels}</output></>,description);
  const trigger=(key:'trigger'|'emoteTrigger')=>{
    const platform=state?.platform??'win';const value=settings[key];
    const keys=['alt','ctrl','shift','win',...(platform==='win'?['capslock']:[]),'mouse4','mouse5',...(key==='emoteTrigger'?['off']:[])];
    return row(t[key],<><select aria-label={t[key]} value={typeof value==='object'?'custom':value} onChange={e=>{if(e.target.value==='custom'){setHint('');setCapture(key);}else void patch({[key]:e.target.value});}}>
      {keys.map(k=><option key={k} value={k}>{triggerLabel(k as TriggerKey,platform,t)}</option>)}<option value="custom">{typeof value==='object'?triggerLabel(value,platform,t):t.custom}</option>
    </select><button className="record-button" onClick={()=>{setHint('');setCapture(key);}}><Icon name="record"/>{copy('录制按键','Record key')}</button></>,copy('按住触发键并拖动，松开后发送。','Hold the trigger, drag to choose, and release to send.'));
  };
  const emoteName=(e:Emote)=>lang==='zh-CN'&&e.nameZh?e.nameZh:e.name;
  const pingSelect=(value:string,change:(v:PingId)=>void,label:string)=><select aria-label={label} value={value} onChange={e=>change(e.target.value as PingId)}>{ALL_PINGS.map(p=><option key={p.id} value={p.id}>{t.pingNames[p.id]}</option>)}</select>;
  const emoteSelect=(value:string,change:(v:string)=>void,label:string)=><select aria-label={label} value={value} onChange={e=>change(e.target.value)}>{state?.emotes.map(e=><option key={e.id} value={e.id}>{emoteName(e)}</option>)}</select>;
  const assignPing=(id:string)=>{const change=dropPatch(settings.wheel,settings.clickPingId,{from:'pool',id:id as PingId},pingSlot);if(change)patch({...change.wheel?{wheel:change.wheel}:{},...change.center?{clickPingId:change.center}:{}});};
  const assignEmote=(id:string)=>{const change=dropPatch(settings.emoteWheel,settings.clickEmoteId,{from:'pool',id},emoteSlot);if(change)patch({...change.wheel?{emoteWheel:change.wheel}:{},...change.center?{clickEmoteId:change.center}:{}});};
  const shortcutParts=[(settings.toggleHotkey.mods&1)?'Ctrl':'',(settings.toggleHotkey.mods&2)?'Alt':'',(settings.toggleHotkey.mods&4)?'Shift':'',(settings.toggleHotkey.mods&8)?(state?.platform==='mac'?'⌘':'Win'):'',vkLabel(settings.toggleHotkey.vk,state?.platform??'win')].filter(Boolean);
  const shortcut=shortcutParts.join(' + ');
  const paused=state?.status.state==='running'&&!state.status.enabled;
  const capturePaused=state?.status.pauseReason==='capture';
  const active=state?.status.state==='running'||state?.status.state==='starting';
  const tabs:{id:Tab;label:string;icon:IconName}[]=[
    {id:'trigger',label:copy('触发','Trigger'),icon:'trigger'},
    {id:'hotkey',label:copy('快捷开关','Shortcut'),icon:'hotkey'},
    {id:'sound',label:t.pings,icon:'sound'},
    {id:'wheel',label:copy('轮盘','Wheel'),icon:'wheel'},
    {id:'emotes',label:copy('表情','Emotes'),icon:'emotes'},
    {id:'app',label:copy('插件','Plugin'),icon:'app'},
  ];
  function changeTab(next:Tab){if(contentRef.current)scrollPositions.current[tab]=contentRef.current.scrollTop;setTab(next);}
  function tabKey(event:React.KeyboardEvent,index:number){
    let next:number;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
    event.preventDefault();changeTab(tabs[next].id);document.getElementById(`tab-${tabs[next].id}`)?.focus();
  }
  function changeModifier(bit:number){const mods=settings.toggleHotkey.mods^bit;if(!(mods&HOTKEY_PRIMARY_MODS)){setModifierHint(true);return;}setModifierHint(false);patch({toggleHotkey:{...settings.toggleHotkey,mods}});}
  const pingItems=ALL_PINGS.map(p=>({id:p.id,label:t.pingNames[p.id],image:__PING_ICONS__[p.icon]}));
  const emoteItems=state?.emotes.map(e=>({id:e.id,label:emoteName(e),image:e.thumbnail}))??[];
  const shownEmotes=state?.emotes.filter(e=>`${emoteName(e)} ${e.name} ${e.id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))??[];
  const previewItem=ALL_PINGS.find(p=>p.id===previewPing)!;
  const pageHeading=(title:string,description:string)=><div className="page-heading"><h2>{title}</h2><p>{description}</p></div>;
  const selectedPingId=pingSlot==='center'?settings.clickPingId:settings.wheel[pingSlot];
  const selectedEmoteId=emoteSlot==='center'?settings.clickEmoteId:settings.emoteWheel[emoteSlot];
  return <div className="app">
    <header className="app-header"><div className="brand"><img className="plugin-icon" src={__PLUGIN_ICON__} alt=""/><div><h1>lolPing Lite <span className="version">{state?.version??'0.3.0'}</span></h1><p className="subtitle">{copy('桌面信号 · DBX 插件','Desktop pings · DBX plugin')}</p></div></div>
      <div className="header-actions"><span className={`runtime-status ${paused?'paused':state?.status.enabled?'active':''}`} role="status"><i className="status-dot"/>{state?t[paused?(capturePaused?'capturePaused':'paused'):state.status.state]:t.loading}</span>
        {state?.status.state==='running'&&<button disabled={busy||capturePaused} onClick={()=>void act('pause',{on:!paused})}><Icon name={paused?'play':'pause'}/>{paused?t.resume:t.pause}</button>}
        <button className={active?'':'primary'} disabled={!state||busy} onClick={()=>void act(active?'stop':'start')}><Icon name={active?'stop':'play'}/>{active?t.stop:t.start}</button>
      </div>
    </header>
    <nav className="tabs" role="tablist" aria-label={copy('设置分类','Settings categories')}>{tabs.map((item,index)=><button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab===item.id} aria-controls="settings-page" tabIndex={tab===item.id?0:-1} onClick={()=>changeTab(item.id)} onKeyDown={e=>tabKey(e,index)}><Icon name={item.icon}/>{item.label}</button>)}</nav>
    <div className="content-scroll" ref={contentRef}><main>
      <div className="notice-stack">
        {paused&&<div className="notice">{capturePaused?t.capturePauseHelp:<>{t.resumeHelp} <kbd>{shortcut}</kbd></>}</div>}
        {state?.status.state==='noAccess'&&<div className="notice"><p>{t.permissionHelp}</p><div className="actions"><button disabled={busy} onClick={()=>void act('permission')}>{t.permission}</button><button disabled={busy} onClick={()=>void act('start')}>{t.retry}</button></div></div>}
        {(error||state?.status.error)&&<div className="notice error" role="alert">{humanError(error||state?.status.error||'')}<button disabled={busy} onClick={()=>{setError('');void load().catch(e=>setError(String(e.message??e)));}}>{copy('重新加载','Reload settings')}</button></div>}
        {capture&&<div className="notice capture" role="status"><div>{capture==='toggleHotkey'?t.captureShortcut:t.capture}{hint&&<p>{t[hint as 'hintUnusable'|'hintNotTrigger'|'hintNeedModifier']}</p>}</div><button onClick={()=>setCapture(null)}><Icon name="close"/>{copy('取消录制','Cancel recording')} · Esc</button></div>}
        {progress!==null&&<div className="notice" role="status">{t.upload} · {progress}%<progress value={progress} max={100}/></div>}
      </div>
      <fieldset disabled={!state||busy||Boolean(capture)}><section id="settings-page" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab==='trigger'&&<>
          {pageHeading(copy('触发','Trigger'),copy('让每一次表达，都从顺手的操作开始。','Set up the gestures that feel right for you.'))}
          <div className="setting-group"><h3>{copy('触发方式','Trigger controls')}</h3><div className="panel">{trigger('trigger')}{slider('dragThresholdPx',copy('按住触发键，拖动超过此距离后展开轮盘。','Hold the trigger and drag beyond this distance to open the wheel.'))}</div></div>
          <div className="setting-group"><h3>{copy('点击行为','Click behavior')}</h3><div className="panel">{toggle('clickPing',copy('轻点即可发送中心信号，无需展开轮盘。','Send the center ping with a click, without opening the wheel.'))}{state?.platform==='win'&&toggle('gameCheck',copy('在全屏游戏中放行普通点击，拖动仍可选择信号。','Pass ordinary clicks through in fullscreen games; dragging still selects pings.'))}</div></div>
          <p className="page-note"><Icon name="trigger"/>{t.intro}</p>
        </>}
        {tab==='hotkey'&&<>
          {pageHeading(copy('快捷开关','Shortcut'),copy('随时暂停，想用时一键回来。','Pause whenever you need, then return with one shortcut.'))}
          <div className="panel shortcut-panel"><div className="section-title"><h3>{t.toggle}</h3><p>{copy('暂停时保留设置，恢复后继续使用原有手势。','Pausing keeps your settings and resumes the same gestures.')}</p></div>
            <div className="key-combination" aria-label={shortcut}>{shortcutParts.map((part,index)=><React.Fragment key={`${index}-${part}`}>{index>0&&<span aria-hidden="true">+</span>}<kbd>{part}</kbd></React.Fragment>)}</div>
            <div className="actions"><button className="primary" onClick={()=>{setHint('');setCapture('toggleHotkey');}}><Icon name="record"/>{copy('录制快捷键','Record shortcut')}</button><span className="muted">{copy('按 Esc 取消，结束后恢复之前的运行状态','Esc cancels; your previous running state is restored')}</span></div>
            <div className="modifier-options" role="group" aria-label={copy('修饰键','Modifier keys')}>{[{bit:1,label:'Ctrl'},{bit:2,label:state?.platform==='mac'?'Option':'Alt'},{bit:4,label:'Shift'},{bit:8,label:state?.platform==='mac'?'Command':'Win'}].map(mod=><label key={mod.bit}><input type="checkbox" checked={Boolean(settings.toggleHotkey.mods&mod.bit)} onChange={()=>changeModifier(mod.bit)}/>{mod.label}</label>)}</div>
            {modifierHint&&<p role="alert" className="error">{t.hintNeedModifier}</p>}
          </div><p className="page-note">{copy('至少包含 Ctrl、Alt 或 Command / Win。避开系统和常用应用的快捷键，以免冲突。','Include Ctrl, Alt or Command / Win. Avoid shortcuts already used by your system or apps.')}</p>
        </>}
        {tab==='sound'&&<>
          {pageHeading(t.pings,copy('调整显示与声音，让信号刚刚好。','Fine-tune how your pings look and sound.'))}
          <div className="sound-layout"><div><div className="setting-group"><h3>{copy('信号显示','Ping appearance')}</h3><div className="panel">{slider('pingSizePx')}{slider('pingDurationS')}{toggle('keepLastPing')}</div></div>
            <div className="setting-group"><h3>{copy('声音','Sound')}</h3><div className="panel">{slider('volume')}{toggle('muted')}{toggle('tickSound')}</div></div></div>
            <div className="panel preview-panel"><div className="section-title"><h3>{copy('信号预览','Ping preview')}</h3><p>{copy('使用真实素材，缩放显示','Real artwork · scaled preview')}</p></div><div className="preview-stage"><img className="preview-art" src={__PING_ICONS__[previewItem.icon]} alt={t.pingNames[previewPing]} style={{width:Math.min(settings.pingSizePx,180),height:Math.min(settings.pingSizePx,180)}}/></div><div className="preview-controls">{pingSelect(previewPing,setPreviewPing,copy('预览信号','Preview ping'))}<button className="primary" onClick={()=>void act('preview',{id:previewPing,wheel:'ping'})}><Icon name="play"/>{copy('试发信号','Try ping')}</button></div><p className="preview-caption">{copy('点击试发后在桌面播放动画和音效。','Try it to play the animation and sound on your desktop.')}</p></div>
          </div>
        </>}
        {tab==='wheel'&&<>
          {pageHeading(copy('轮盘','Wheel'),copy('选择一个方向，再为它分配信号。','Choose a direction, then assign a ping.'))}
          <WheelEditor items={pingItems} wheel={settings.wheel} center={settings.clickPingId} selected={pingSlot} onSelect={setPingSlot} onAssign={assignPing} label={copy('信号素材','Ping collection')} centerLabel={copy('中心','Center')} previewLabel={copy('试发信号','Try ping')} onPreview={()=>void act('preview',{id:selectedPingId,wheel:'ping'})} disabled={!state||busy||Boolean(capture)} lang={zh?'zh':'en'}>
            {slider('wheelSizePx')}{row(t.clickPingId,pingSelect(settings.clickPingId,id=>patch({clickPingId:id}),t.clickPingId))}
          </WheelEditor>
        </>}
        {tab==='emotes'&&<>
          {pageHeading(copy('表情','Emotes'),copy('收藏一点情绪，随手表达。','Keep your favorite reactions close at hand.'))}
          <div className="segmented" role="group" aria-label={copy('表情设置','Emote settings')}><button aria-pressed={emoteTab==='library'} onClick={()=>setEmoteTab('library')}>{copy('素材库','Library')}</button><button aria-pressed={emoteTab==='wheel'} onClick={()=>setEmoteTab('wheel')}>{copy('触发与轮盘','Trigger & wheel')}</button></div>
          {emoteTab==='library'?<>
            <div className="library-toolbar"><label className="search"><Icon name="search"/><input aria-label={copy('搜索表情','Search emotes')} placeholder={copy('搜索表情…','Search emotes…')} value={search} onChange={e=>setSearch(e.target.value)}/></label><button onClick={()=>imageInput.current?.click()}><Icon name="upload"/>{t.addImage}</button></div>
            <div className="emote-grid">{shownEmotes.map(e=><article key={e.id}><button className="emote-preview" title={t.preview} aria-label={`${t.preview} ${emoteName(e)}`} onClick={()=>void act('preview',{id:e.id,wheel:'emote'})}><img src={e.thumbnail} loading="lazy" decoding="async" alt=""/><span>{emoteName(e)}</span></button>{e.custom&&<div className="emote-actions"><button onClick={()=>{soundTarget.current=e.id;soundInput.current?.click();}}><Icon name="sound" size={14}/>{t.sound}</button><button className="danger" onClick={()=>setPendingDelete(e.id)}>{t.remove}</button></div>}{pendingDelete===e.id&&<div className="confirm-actions" role="group" aria-label={copy('确认移除表情','Confirm emote removal')}><p>{copy('移除此自定义表情及其音效？','Remove this custom emote and its sound?')}</p><button className="danger" onClick={()=>{setPendingDelete(null);void act('emote/remove',{id:e.id});}}>{copy('确认移除','Remove emote')}</button><button onClick={()=>setPendingDelete(null)}>{copy('取消','Cancel')}</button></div>}</article>)}</div>
            {!shownEmotes.length&&<div className="empty-state"><Icon name="emotes" size={28}/><p>{search?copy('没有匹配的表情，试试其他关键词。','No matches. Try a different search.'):copy('素材正在加载，或导入一张自己的图片。','Your library is loading. You can also import an image.')}</p></div>}
            <div className="panel pack-panel"><div><h3>{copy('扩展表情包','Extra emote pack')}</h3><p>{state?.extraPackInstalled?t.packInstalled:t.packHint}</p></div><div className="actions"><button disabled={state?.extraPackInstalled} onClick={()=>packInput.current?.click()}><Icon name="upload"/>{t.importPack}</button><button onClick={()=>void act('releases')}><Icon name="download"/>{t.downloadPack}</button></div></div>
            <p className="page-note">{copy('图片支持 PNG / JPEG / GIF / WebP；音效支持 WAV / OGG / MP3，最长 5 秒。','Images: PNG / JPEG / GIF / WebP. Sounds: WAV / OGG / MP3, up to 5 seconds.')}</p>
          </>:<>
            <div className="setting-group"><div className="panel">{trigger('emoteTrigger')}{toggle('emoteClick')}{slider('emoteSizePx')}{toggle('emoteSound')}</div></div>
            <WheelEditor items={emoteItems} wheel={settings.emoteWheel} center={settings.clickEmoteId} selected={emoteSlot} onSelect={setEmoteSlot} onAssign={assignEmote} label={copy('表情素材','Emote collection')} centerLabel={copy('中心','Center')} previewLabel={copy('试发表情','Try emote')} onPreview={()=>void act('preview',{id:selectedEmoteId,wheel:'emote'})} disabled={!state||busy||Boolean(capture)} lang={zh?'zh':'en'}>{row(t.clickEmoteId,emoteSelect(settings.clickEmoteId,id=>patch({clickEmoteId:id}),t.clickEmoteId))}</WheelEditor>
          </>}
        </>}
        {tab==='app'&&<>
          {pageHeading(copy('插件','Plugin'),copy('融入 DBX，保持轻量。','At home in DBX, with a light footprint.'))}
          <div className="setting-group"><h3>{copy('显示','Appearance')}</h3><div className="panel">{row(t.language,<select aria-label={t.language} value={settings.language} onChange={e=>void patch({language:e.target.value as Settings['language']})}><option value="auto">{t.auto}</option><option value="zh-CN">简体中文</option><option value="en">English</option></select>)}{row(copy('外观','Theme'),<span className="muted">{t.auto}</span>,copy('颜色、字体与深浅模式跟随 DBX。','Colors, fonts and light / dark mode follow DBX.'))}</div></div>
          <div className="panel about-panel"><div className="about-logo"><img src={__PLUGIN_ICON__} alt=""/><div><h3>lolPing Lite</h3><span className="muted">{state?.version??'0.3.0'} · io.dbx.lolping.lite</span></div></div><p>{t.lifecycle}</p><p>{copy('信号覆盖层使用 Rust 原生绘制；设置页在 DBX 中打开。','Pings are drawn by a native Rust overlay. Settings open inside DBX.')}</p><div className="source-links"><span>{copy('插件源码','Plugin source')} · https://github.com/Ezreal-byte/dbx-lolping-plugin</span><span>{copy('上游 lolPing','Upstream lolPing')} · https://github.com/darrenprx/lolPing</span></div><p className="muted">{t.attribution}</p></div>
          <div className="setting-group danger-zone"><h3>{copy('重置','Reset')}</h3><div className="panel">{row(t.reset,<button className="danger" onClick={()=>setConfirmReset(true)}>{t.reset}</button>,copy('恢复触发、轮盘和声音等默认设置，保留已导入的素材。','Restore default controls, wheels and sound settings. Imported assets are kept.'))}{confirmReset&&<div className="confirm-actions"><p>{copy('确定恢复默认设置？此操作会立即保存。','Restore default preferences? This will save immediately.')}</p><button className="danger" onClick={()=>{setConfirmReset(false);patch({...DEFAULT_SETTINGS,customEmotes:settings.customEmotes});}}>{copy('确认重置','Reset now')}</button><button onClick={()=>setConfirmReset(false)}>{copy('取消','Cancel')}</button></div>}</div></div>
        </>}
      </section></fieldset>
    </main></div>
    <input hidden ref={imageInput} type="file" accept=".png,.jpg,.jpeg,.gif,.webp" onChange={e=>void importFile(e.target.files?.[0],'image')}/>
    <input hidden ref={packInput} type="file" accept=".zip" onChange={e=>void importFile(e.target.files?.[0],'pack')}/>
    <input hidden ref={soundInput} type="file" accept=".wav,.ogg,.mp3" onChange={e=>void importFile(e.target.files?.[0],'sound')}/>
    <footer className="app-footer"><span className="save-state" role="status"><Icon name={error?'close':'check'} size={15}/>{error?copy('保存或操作失败，请查看提示','An operation failed. See the message above.'):!state?t.loading:saving?t.saving:t.saved}</span><span>{copy('关闭设置页，信号仍可继续使用','Pings keep running when this tab closes')}</span></footer>
  </div>;
}
const root=document.getElementById('root');if(root)createRoot(root).render(<App/>);
