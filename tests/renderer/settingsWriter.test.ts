import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SettingsWriter } from '../../src/renderer/settings/settingsWriter';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('a slider burst persists only its final value and flushes immediately at pointer-up', async()=>{
  const save=vi.fn(async p=>({...DEFAULT_SETTINGS,...p})), apply=vi.fn(), saving=vi.fn();
  const writer=new SettingsWriter(save,apply,vi.fn(),saving);
  for(let volume=0;volume<=100;volume++)writer.set({volume},true);
  expect(save).not.toHaveBeenCalled();
  writer.flush();await settle();
  expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith({volume:100});
  expect(apply.mock.lastCall?.[0].volume).toBe(100);expect(saving).toHaveBeenLastCalledWith(false);
  await vi.advanceTimersByTimeAsync(500);expect(save).toHaveBeenCalledTimes(1);
});
test('continuous changes save after settling, with no old response overwriting a newer edit', async()=>{
  let finish!:(s:typeof DEFAULT_SETTINGS)=>void;
  const save=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockImplementation(async p=>({...DEFAULT_SETTINGS,...p}));
  const apply=vi.fn();const writer=new SettingsWriter(save,apply,vi.fn(),vi.fn());
  writer.set({volume:10});writer.set({volume:80},true);writer.set({muted:true},true);
  expect(writer.overlay(DEFAULT_SETTINGS)).toMatchObject({volume:80,muted:true});
  finish({...DEFAULT_SETTINGS,volume:10});await settle();
  expect(apply.mock.calls[0][0]).toMatchObject({volume:80,muted:true});
  expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[1][0]).toEqual({volume:80,muted:true});
  await settle();
});
test('failed writes do not strand later edits or leave saving stuck', async()=>{
  const save=vi.fn().mockRejectedValueOnce(Error('disk full')).mockImplementation(async p=>({...DEFAULT_SETTINGS,...p}));
  const failed=vi.fn(),saving=vi.fn();const writer=new SettingsWriter(save,vi.fn(),failed,saving);
  writer.set({volume:10});writer.set({volume:50});await settle();await settle();
  expect(failed).toHaveBeenCalledTimes(1);expect(save).toHaveBeenLastCalledWith({volume:50});expect(saving).toHaveBeenLastCalledWith(false);
});
test('keyboard edits settle after 200ms and an explicit lifecycle flush does not duplicate a write', async()=>{
  const save=vi.fn(async p=>({...DEFAULT_SETTINGS,...p}));const writer=new SettingsWriter(save,vi.fn(),vi.fn(),vi.fn());
  writer.set({volume:35},true);await vi.advanceTimersByTimeAsync(199);expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(save).toHaveBeenCalledTimes(1);writer.flush();await settle();expect(save).toHaveBeenCalledTimes(1);
});
