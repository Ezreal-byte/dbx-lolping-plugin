import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './wheel-editor.css';

export type WheelSelection = number | 'center';
export interface WheelEditorItem { id: string; label: string; image: string }
export interface WheelEditorProps {
  items: WheelEditorItem[];
  wheel: string[];
  center: string;
  selected: WheelSelection;
  onSelect: (slot: WheelSelection) => void;
  onAssign: (id: string) => void;
  label: string;
  centerLabel: string;
  previewLabel: string;
  onPreview: () => void;
  disabled?: boolean;
  lang?: 'zh' | 'en';
  children?: ReactNode;
}

const DIRECTIONS = {
  zh: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};
const FULL_DIRECTIONS = {
  zh: DIRECTIONS.zh,
  en: ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'],
};
const ORIGIN = 180;
const INNER = 59;
const OUTER = 153;
function point(radius: number, degrees: number) {
  const radians = degrees * Math.PI / 180;
  return { x: ORIGIN + Math.cos(radians) * radius, y: ORIGIN + Math.sin(radians) * radius };
}
function sectorPath(slot: number) {
  const angle = -90 + slot * 45;
  const start = angle - 21.8;
  const end = angle + 21.8;
  const a = point(OUTER, start), b = point(OUTER, end);
  const c = point(INNER, end), d = point(INNER, start);
  return `M ${a.x} ${a.y} A ${OUTER} ${OUTER} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${INNER} ${INNER} 0 0 0 ${d.x} ${d.y} Z`;
}

/** A settings-only editor: selection, assignment and desktop preview are separate actions. */
export function WheelEditor({ items, wheel, center, selected, onSelect, onAssign, label, centerLabel, previewLabel, onPreview, disabled = false, lang = 'zh', children }: WheelEditorProps) {
  const titleId = useId();
  const helpId = useId();
  const slotRefs = useRef(new Map<WheelSelection, SVGGElement>());
  const zh = lang === 'zh';
  const selectedId = selected === 'center' ? center : wheel[selected];
  const selectedItem = items.find(item => item.id === selectedId);
  const centerItem = items.find(item => item.id === center);
  const direction = (slot: WheelSelection) => slot === 'center' ? centerLabel : FULL_DIRECTIONS[lang][slot];
  const remember = (slot: WheelSelection) => (node: SVGGElement | null) => {
    if (node) slotRefs.current.set(slot, node);
    else slotRefs.current.delete(slot);
  };
  const select = (slot: WheelSelection) => {
    if (disabled) return;
    onSelect(slot);
    slotRefs.current.get(slot)?.focus();
  };
  const keyDown = (event: KeyboardEvent<SVGGElement>, slot: WheelSelection) => {
    if (disabled) return;
    let target: WheelSelection;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': target = slot === 'center' ? 0 : (slot + 1) % 8; break;
      case 'ArrowLeft': case 'ArrowUp': target = slot === 'center' ? 7 : (slot + 7) % 8; break;
      case 'Home': target = 'center'; break;
      case 'Enter': case ' ': target = slot; break;
      default: return;
    }
    event.preventDefault();
    select(target);
  };

  return <div className="lp-wheel-editor" data-disabled={disabled || undefined}>
    <div className="lp-wheel-top">
      <div className="lp-wheel-canvas">
        <div className="lp-wheel-canvas-caption">{zh ? '缩放预览' : 'Scaled preview'}</div>
        <svg className="lp-wheel-svg" viewBox="0 0 360 360" role="group" aria-labelledby={titleId} aria-describedby={helpId}>
          <title id={titleId}>{label}</title>
          <desc id={helpId}>{zh ? '点击方向后选择素材。方向键切换方向，Home 选择中心。' : 'Choose a direction, then an item. Use arrow keys to change direction and Home for the center.'}</desc>
          <circle className="lp-wheel-outline" cx={ORIGIN} cy={ORIGIN} r={OUTER + 5} />
          {Array.from({ length: 8 }, (_, slot) => {
            const item = items.find(candidate => candidate.id === wheel[slot]);
            const icon = point(109, -90 + slot * 45);
            const caption = point(139, -90 + slot * 45);
            const active = selected === slot;
            return <g key={slot} ref={remember(slot)} className={`lp-wheel-sector${active ? ' is-selected' : ''}`} role="button" tabIndex={!disabled && active ? 0 : -1} aria-disabled={disabled} aria-pressed={active} aria-label={`${direction(slot)} · ${item?.label ?? (zh ? '未分配' : 'Unassigned')}`} onClick={() => select(slot)} onKeyDown={event => keyDown(event, slot)}>
              <path d={sectorPath(slot)} />
              {item?.image && <image href={item.image} x={icon.x - 19} y={icon.y - 19} width="38" height="38" preserveAspectRatio="xMidYMid meet" />}
              <text x={caption.x} y={caption.y} textAnchor="middle" dominantBaseline="middle">{DIRECTIONS[lang][slot]}</text>
            </g>;
          })}
          <g ref={remember('center')} className={`lp-wheel-center${selected === 'center' ? ' is-selected' : ''}`} role="button" tabIndex={!disabled && selected === 'center' ? 0 : -1} aria-disabled={disabled} aria-pressed={selected === 'center'} aria-label={`${centerLabel} · ${centerItem?.label ?? (zh ? '未分配' : 'Unassigned')}`} onClick={() => select('center')} onKeyDown={event => keyDown(event, 'center')}>
            <circle cx={ORIGIN} cy={ORIGIN} r={INNER - 4} />
            {centerItem?.image && <image href={centerItem.image} x={ORIGIN - 19} y={ORIGIN - 32} width="38" height="38" preserveAspectRatio="xMidYMid meet" />}
            <text x={ORIGIN} y={ORIGIN + 26} textAnchor="middle">{centerLabel}</text>
          </g>
        </svg>
      </div>
      <div className="lp-wheel-controls">
        <div className="lp-wheel-editing"><span>{zh ? '正在编辑' : 'Editing'}</span><strong>{direction(selected)}</strong></div>
        <div className="lp-wheel-current" aria-live="polite">
          <span className="lp-wheel-current-image">{selectedItem?.image && <img src={selectedItem.image} alt="" />}</span>
          <div><strong>{selectedItem?.label ?? (zh ? '未分配' : 'Unassigned')}</strong><p>{zh ? '从下方素材池更换' : 'Choose an item below to replace'}</p></div>
        </div>
        <button type="button" className="lp-wheel-preview" disabled={disabled || !selectedItem} onClick={onPreview}>{previewLabel}</button>
        {children && <div className="lp-wheel-parameters">{children}</div>}
      </div>
    </div>
    <div className="lp-wheel-materials">
      <div className="lp-wheel-materials-header"><h3>{label} <span>{items.length.toString().padStart(2, '0')}</span></h3><p>{zh ? '点击方向，再选择素材；已有素材会交换位置' : 'Choose a direction, then an item. Existing items swap places.'}</p></div>
      <div className="lp-wheel-pool" role="group" aria-label={zh ? '选择素材分配到当前方向' : 'Assign an item to the selected direction'}>
        {items.map(item => {
          const slot = wheel.indexOf(item.id);
          const current = selectedId === item.id;
          return <button key={item.id} type="button" className={`lp-wheel-tile${current ? ' is-selected' : ''}`} aria-pressed={current} aria-label={`${zh ? '分配' : 'Assign'} ${item.label}`} title={item.label} disabled={disabled} onClick={() => onAssign(item.id)}>
            {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" />}
            <span className="lp-wheel-tile-name">{item.label}</span>
            <span className="lp-wheel-tile-position">{slot >= 0 ? DIRECTIONS[lang][slot] : zh ? '未分配' : 'Available'}</span>
          </button>;
        })}
      </div>
      {!items.length && <p className="lp-wheel-empty">{zh ? '导入素材后即可分配到轮盘。' : 'Import an item to add it to the wheel.'}</p>}
    </div>
  </div>;
}
