import { expect, test, vi } from 'vitest';
import { BlobCache } from '../../src/renderer/overlay/blobCache';
test('deduplicates pending fetches, evicts least recently used data and expires idle entries',async()=>{
  let now=0;const fetch=vi.fn(async()=>new Blob(['12345']));const cache=new BlobCache(fetch,10,120,()=>now);
  const first=cache.get('a');expect(cache.get('a')).toBe(first);await first;
  now++;await cache.get('b');now++;await cache.get('a');await cache.get('c');
  expect(cache.bytes).toBe(10);expect(fetch).toHaveBeenCalledTimes(3);
  await cache.get('b');expect(fetch).toHaveBeenCalledTimes(4);
  now+=121;cache.trim();expect(cache.bytes).toBe(0);
});
test('oversized blobs remain playable but are not retained and failed fetches can retry',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(Error('missing')).mockResolvedValue(new Blob(['123456']));const cache=new BlobCache(fetch,5);
  await expect(cache.get('a')).rejects.toThrow('missing');expect((await cache.get('a')).size).toBe(6);expect(cache.bytes).toBe(0);
  await cache.get('a');expect(fetch).toHaveBeenCalledTimes(3);
});
test('a late fetch cannot repopulate an invalidated cache',async()=>{
  let finish!:(b:Blob)=>void;const cache=new BlobCache(()=>new Promise(r=>{finish=r;}));
  const pending=cache.get('a');cache.clear();finish(new Blob(['still playable']));
  expect((await pending).size).toBe(14);expect(cache.bytes).toBe(0);
});
