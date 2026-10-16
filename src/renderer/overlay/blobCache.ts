/** Compressed animation bytes only. Live images keep their own Blob URL until they finish. */
export class BlobCache {
  private entries = new Map<string, { promise: Promise<Blob>; bytes: number; used: number }>();
  constructor(private fetchBlob: (key: string) => Promise<Blob>, private limit = 16 * 1024 * 1024,
    private ttl = 120_000, private now = () => Date.now()) {}
  get bytes(): number { return [...this.entries.values()].reduce((n, e) => n + e.bytes, 0); }
  get(key: string): Promise<Blob> {
    this.trim();
    const cached = this.entries.get(key);
    if (cached) { cached.used = this.now(); this.entries.delete(key); this.entries.set(key, cached); return cached.promise; }
    const entry = { promise: Promise.resolve(null as unknown as Blob), bytes: 0, used: this.now() };
    entry.promise = this.fetchBlob(key).then(blob => {
      if (this.entries.get(key) === entry) {
        if(blob.size>this.limit)this.entries.delete(key);
        else { entry.bytes = blob.size; this.trim(); }
      }
      return blob;
    }, error => { if (this.entries.get(key) === entry) this.entries.delete(key); throw error; });
    this.entries.set(key, entry);
    this.trim();
    return entry.promise;
  }
  trim(): void {
    for (const [key, e] of this.entries) if (this.now() - e.used >= this.ttl) this.entries.delete(key);
    while (this.bytes > this.limit || this.entries.size > 16) this.entries.delete(this.entries.keys().next().value!);
  }
  clear(): void { this.entries.clear(); }
}
