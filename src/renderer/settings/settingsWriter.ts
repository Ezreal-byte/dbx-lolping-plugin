import type { Settings } from '../../shared/settings';

/** One in-flight write, latest-value coalescing, and optimistic edits preserved across old replies. */
export class SettingsWriter {
  private pending: Partial<Settings> = {};
  private flight: Partial<Settings> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private save: (p: Partial<Settings>) => Promise<Settings>, private apply: (s: Settings) => void,
    private failed: (e: unknown) => void, private saving: (on: boolean) => void) {}
  overlay(s: Settings): Settings { return { ...s, ...this.flight, ...this.pending }; }
  set(p: Partial<Settings>, deferred = false): void {
    Object.assign(this.pending, p);
    this.saving(true);
    clearTimeout(this.timer);
    if (deferred) this.timer = setTimeout(() => this.flush(), 200);
    else this.flush();
  }
  flush(): void {
    clearTimeout(this.timer); this.timer = undefined;
    if (this.flight || !Object.keys(this.pending).length) return;
    const patch = this.pending; this.pending = {}; this.flight = patch;
    void this.save(patch).then(s => {
      this.flight = null; this.apply(this.overlay(s));
    }, e => { this.flight = null; this.failed(e); }).finally(() => {
      if (Object.keys(this.pending).length) this.flush();
      else this.saving(false);
    });
  }
}
