// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WheelEditor, type WheelSelection } from '../../src/renderer/settings/WheelEditor';

const items = Array.from({ length: 12 }, (_, index) => ({ id: `ping-${index}`, label: `Ping ${index}`, image: `data:image/png;base64,${index}` }));
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.body.innerHTML = '<div id="test-root"></div>';
  root = createRoot(document.getElementById('test-root')!);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

test('selecting directions and assigning a material never sends a preview', async () => {
  const assign = vi.fn(); const preview = vi.fn(); const select = vi.fn();
  function Editor() {
    const [selected, setSelected] = useState<WheelSelection>(0);
    return createElement(WheelEditor, {
      items, wheel: items.slice(0, 8).map(item => item.id), center: 'ping-8', selected,
      onSelect: slot => { select(slot); setSelected(slot); }, onAssign: assign,
      label: 'Ping library', centerLabel: 'Center', previewLabel: 'Preview ping', onPreview: preview, lang: 'en',
    });
  }
  await act(async () => root.render(createElement(Editor)));
  const svg = document.querySelector('svg')!;
  const groups = [...svg.querySelectorAll<SVGGElement>('g[role="button"]')];
  expect(groups).toHaveLength(9);
  expect(groups.filter(group => group.getAttribute('tabindex') === '0')).toHaveLength(1);
  await act(async () => groups[6].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(select).toHaveBeenLastCalledWith(6);
  expect(groups[6].getAttribute('aria-pressed')).toBe('true');
  expect(assign).not.toHaveBeenCalled(); expect(preview).not.toHaveBeenCalled();
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Assign Ping 11"]')!.click());
  expect(assign).toHaveBeenLastCalledWith('ping-11'); expect(preview).not.toHaveBeenCalled();
  await act(async () => document.querySelector<HTMLButtonElement>('.lp-wheel-preview')!.click());
  expect(preview).toHaveBeenCalledTimes(1);
  await act(async () => svg.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(select).toHaveBeenCalledTimes(1);
});

test('keyboard navigation reaches all eight directions and the independent center', async () => {
  const select = vi.fn();
  function Editor() {
    const [selected, setSelected] = useState<WheelSelection>('center');
    return createElement(WheelEditor, {
      items, wheel: items.slice(0, 8).map(item => item.id), center: 'ping-8', selected,
      onSelect: slot => { select(slot); setSelected(slot); }, onAssign: vi.fn(),
      label: '信号素材', centerLabel: '中心信号', previewLabel: '试发信号', onPreview: vi.fn(),
    });
  }
  await act(async () => root.render(createElement(Editor)));
  for (let slot = 0; slot < 8; slot++) {
    const active = document.querySelector<SVGGElement>('g[tabindex="0"]')!;
    await act(async () => active.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    expect(select).toHaveBeenLastCalledWith(slot);
  }
  await act(async () => document.querySelector<SVGGElement>('g[tabindex="0"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
  expect(select).toHaveBeenLastCalledWith('center');
  expect(document.querySelector('g[tabindex="0"]')!.getAttribute('aria-label')).toBe('中心信号 · Ping 8');
});

test('disabled editor does not select, assign, or preview', async () => {
  const select = vi.fn(), assign = vi.fn(), preview = vi.fn();
  await act(async () => root.render(createElement(WheelEditor, {
    items, wheel: items.slice(0, 8).map(item => item.id), center: 'ping-8', selected: 0,
    onSelect: select, onAssign: assign, onPreview: preview, disabled: true,
    label: 'Ping library', centerLabel: 'Center', previewLabel: 'Preview ping',
  })));
  const sector = document.querySelector<SVGGElement>('g[role="button"]')!;
  await act(async () => {
    sector.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    sector.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    document.querySelector<HTMLButtonElement>('.lp-wheel-tile')!.click();
    document.querySelector<HTMLButtonElement>('.lp-wheel-preview')!.click();
  });
  expect(select).not.toHaveBeenCalled(); expect(assign).not.toHaveBeenCalled(); expect(preview).not.toHaveBeenCalled();
  expect(document.querySelector('g[tabindex="0"]')).toBeNull();
});
