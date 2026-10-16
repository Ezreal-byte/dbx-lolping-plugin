// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { update, upload, type Host } from '../../src/renderer/settings/api';

afterEach(() => { delete window.dbxPlugin; });
test('serializes settings writes and recovers after a rejected write', async () => {
  let release!: () => void;
  const first = new Promise<void>(resolve => { release = resolve; });
  const invoke = vi.fn().mockImplementationOnce(() => first.then(() => { throw Error('disk full'); }))
    .mockResolvedValueOnce({ volume: 50 });
  window.dbxPlugin = { invoke } as unknown as Host;
  const a = update({ volume: 10 }).catch(e => e.message);
  const b = update({ volume: 50 });
  await Promise.resolve(); expect(invoke).toHaveBeenCalledTimes(1);
  release(); expect(await a).toBe('disk full'); expect(await b).toEqual({ volume: 50 });
  expect(invoke).toHaveBeenLastCalledWith('lolping/settings', { volume: 50 });
});

function fakeFile(size: number) {
  return { size, name: 'sample.png', slice: (start: number, end: number) => ({
    arrayBuffer: async () => new Uint8Array(Math.min(size, end) - start).buffer,
  }) } as File;
}

test('uploads ordered framed chunks and waits for ACK before committing', async () => {
  const listeners = new Set<Parameters<Host['onEvent']>[0]>();
  let received = 0;
  const invoke = vi.fn(async (method: string) => {
    if (method.endsWith('/begin')) return { id: '1' };
    expect(received).toBe(600_000); return { ok: true };
  });
  const sendBinary = vi.fn(async (channel: string, bytes: ArrayBuffer) => {
    expect(channel).toBe('upload/1'); expect(new DataView(bytes).getBigUint64(0)).toBe(BigInt(received));
    received += bytes.byteLength - 8;
    queueMicrotask(() => { for (const l of listeners) l({ method: 'lolping/upload', params: { id: '1', received } }); });
  });
  window.dbxPlugin = { ready: Promise.resolve(), locale: 'en', invoke, sendBinary, onEvent: l => { listeners.add(l); return () => { listeners.delete(l); }; } };
  const progress = vi.fn(); await upload(fakeFile(600_000), 'image', progress);
  expect(sendBinary).toHaveBeenCalledTimes(2); expect(progress).toHaveBeenLastCalledWith(100);
  expect(invoke).toHaveBeenLastCalledWith('lolping/upload/commit', { id: '1' }); expect(listeners.size).toBe(0);
});

test('cancels failed binary transfers without committing', async () => {
  const invoke = vi.fn(async () => ({ id: '2' })); const unsubscribe = vi.fn();
  window.dbxPlugin = { invoke, sendBinary: async () => { throw Error('closed'); }, onEvent: () => unsubscribe } as unknown as Host;
  await expect(upload(fakeFile(12), 'image', () => {})).rejects.toThrow('closed');
  expect(invoke).toHaveBeenLastCalledWith('lolping/upload/cancel', { id: '2' }); expect(unsubscribe).toHaveBeenCalled();
});
