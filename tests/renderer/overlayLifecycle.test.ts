// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
test('reports idle only when every visual is gone, retains kept pings, and acknowledges the current epoch',async()=>{
  vi.useFakeTimers();vi.resetModules();
  document.body.innerHTML='<div id="pings"></div><svg id="wheel"></svg>';
  const postMessage=vi.fn();window.ipc={postMessage};
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 0;});
  await import('../../src/renderer/overlay/main');
  const messages=()=>postMessage.mock.calls.map(c=>JSON.parse(c[0]));
  window.receive('settings',{...DEFAULT_SETTINGS,keepLastPing:false,_epoch:1} as never);
  expect(messages().at(-1)).toEqual({type:'idle',epoch:1});postMessage.mockClear();
  window.receive('wheelOpen',{x:500,y:500,_epoch:2});await Promise.resolve();
  expect(messages().some(m=>m.type==='idle')).toBe(false);
  window.receive('wheelRelease',{x:500,y:400,_epoch:3});await Promise.resolve();
  expect(document.querySelectorAll('.ping')).toHaveLength(1);
  expect(messages().some(m=>m.type==='idle')).toBe(false);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(messages().at(-1)).toEqual({type:'idle',epoch:3});
  window.receive('settings',{...DEFAULT_SETTINGS,keepLastPing:true,_epoch:4} as never);
  window.receive('click',{x:500,y:500,_epoch:5});postMessage.mockClear();
  await vi.advanceTimersByTimeAsync(60_000);expect(document.querySelectorAll('.ping')).toHaveLength(1);expect(messages().some(m=>m.type==='idle')).toBe(false);
  window.receive('clear',{_epoch:6});await Promise.resolve();expect(document.querySelectorAll('.ping')).toHaveLength(0);expect(messages().at(-1)).toEqual({type:'idle',epoch:6});
  window.receive('preview',{id:'danger',wheel:'ping',x:500,y:500,_epoch:7});
  expect(messages().some(m=>m.type==='frame'&&m.epoch===7)).toBe(true);
  window.receive('clear',{_epoch:8});await Promise.resolve();expect(messages().at(-1)).toEqual({type:'idle',epoch:8});
});
