import type { CSSProperties } from 'react';

export type IconName = 'trigger' | 'hotkey' | 'sound' | 'wheel' | 'emotes' | 'app'
  | 'check' | 'close' | 'download' | 'pause' | 'play' | 'record' | 'search' | 'stop' | 'upload';

declare const __UI_ICONS__: Record<IconName, string>;

/** Licensed Fluent assets, embedded at build time for the DBX sandboxed frame. */
export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  const source = typeof __UI_ICONS__ === 'undefined' ? undefined : __UI_ICONS__[name];
  const mask = source ? `url("${source}")` : 'none';
  const style: CSSProperties = {
    display: 'inline-block', flexShrink: 0, width: size, height: size,
    verticalAlign: 'middle', backgroundColor: 'currentColor',
    maskImage: mask, WebkitMaskImage: mask,
    maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center', WebkitMaskPosition: 'center',
    maskSize: 'contain', WebkitMaskSize: 'contain',
  };
  return <span className={`ui-icon ${className}`.trim()} data-icon={name} aria-hidden="true" style={style} />;
}
