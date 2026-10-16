import defaults from '../../resources/default-settings.json';
import type { CustomEmote } from './emotes';
import type { Hotkey } from './keys';
import type { PingId } from './pings';
import type { LanguagePref } from './i18n';
export type NamedTrigger = 'alt' | 'ctrl' | 'shift' | 'win' | 'capslock' | 'mouse4' | 'mouse5';
export type TriggerKey = NamedTrigger | { vk: number };
export interface Settings {
  version: number;
  trigger: TriggerKey;
  emoteTrigger: TriggerKey | 'off';
  dragThresholdPx: number;
  clickPing: boolean;
  gameCheck: boolean;
  clickPingId: PingId;
  wheelSizePx: number;
  wheel: PingId[];
  toggleHotkey: Hotkey;
  pingSizePx: number;
  pingDurationS: number;
  keepLastPing: boolean;
  volume: number;
  muted: boolean;
  tickSound: boolean;
  language: LanguagePref;
  emoteClick: boolean;
  emoteWheel: string[];
  clickEmoteId: string;
  emoteSizePx: number;
  emoteSound: boolean;
  customEmotes: CustomEmote[];
}
export const DEFAULT_SETTINGS = defaults as Settings;
export const LIMITS = {
  dragThresholdPx: { min: 2, max: 40, step: 1 },
  wheelSizePx: { min: 300, max: 900, step: 10 },
  pingSizePx: { min: 60, max: 220, step: 1 },
  pingDurationS: { min: 1, max: 8, step: 0.1 },
  volume: { min: 0, max: 100, step: 1 },
  emoteSizePx: { min: 80, max: 300, step: 1 },
} as const;
export type OverlaySettings = Settings;
