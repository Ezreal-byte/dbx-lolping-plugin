export type Lang = 'en' | 'zh-CN';
export type LanguagePref = 'auto' | Lang;
export const resolveLang = (pref: LanguagePref, locale: string): Lang => pref === 'auto' ? (/^zh/i.test(locale) ? 'zh-CN' : 'en') : pref;
const en = {
  title: 'Desktop pings', subtitle: 'A little expression, anywhere on your desktop.',
  start: 'Start', stop: 'Stop', stopped: 'Stopped', running: 'Running', paused: 'Paused', starting: 'Starting…', failed: 'Could not start', noAccess: 'Accessibility permission needed',
  pause: 'Pause', resume: 'Resume', capturePaused: 'Paused while recording a key', capturePauseHelp: 'Finish or cancel key recording to return to the previous running / paused state.',
  resumeHelp: 'Pings are paused. Click Resume or use', stoppedHelp: 'Input listeners are released. Click Start to enable desktop pings.', saving: 'Saving…', saved: 'Changes saved automatically',
  intro: 'Hold the trigger and drag to choose a ping. Release to place it. Ordinary input passes through.',
  lifecycle: 'Closing this tab keeps pings running. Stop releases all input listeners. Quitting DBX stops the plugin.',
  triggers: 'Controls', pings: 'Pings & sound', emotes: 'Local emotes', preferences: 'Preferences',
  trigger: 'Ping trigger', emoteTrigger: 'Emote trigger', off: 'Off', custom: 'Custom key…', mouse4: 'Mouse 4', mouse5: 'Mouse 5',
  toggle: 'Pause / resume shortcut', capture: 'Press a key (Esc cancels)', captureShortcut: 'Press Ctrl / Alt / Command plus a key',
  hintUnusable: 'This key cannot be used.', hintNotTrigger: 'Choose a different key.', hintNeedModifier: 'Add Ctrl, Alt or Command.',
  clickPing: 'Trigger + click places a ping', emoteClick: 'Trigger + click places an emote', gameCheck: 'Let fullscreen games keep their clicks',
  dragThresholdPx: 'Drag threshold', wheelSizePx: 'Wheel size', pingSizePx: 'Ping size', pingDurationS: 'Ping duration', emoteSizePx: 'Emote size', volume: 'Volume',
  muted: 'Mute all sounds', tickSound: 'Wheel selection sound', emoteSound: 'Play emote sounds', keepLastPing: 'Keep the last ping until the next one',
  wheel: 'Ping wheel', clickPingId: 'Click ping', emoteWheel: 'Emote wheel', clickEmoteId: 'Click emote', preview: 'Preview',
  slots: ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'],
  addImage: 'Import image', importPack: 'Import extra emote pack', packInstalled: 'Extra pack installed · 44 built-in emotes',
  packHint: '9 emotes included. Import the optional offline pack for the other 35. PNG, JPEG, GIF and WebP custom images are supported.',
  remove: 'Remove', sound: 'Import sound', upload: 'Importing', done: 'Imported', retry: 'Try again',
  permission: 'Open Accessibility settings', permissionHelp: 'Allow the plugin / DBX in macOS Accessibility, then try again. An update may require granting access again.',
  language: 'Language', auto: 'Follow DBX', reset: 'Reset preferences', hostRequired: 'Open this page from the DBX Plugin Center.',
  loading: 'Loading…', error: 'The operation failed', seconds: 's', pixels: 'px',
  attribution: 'Based on lolPing. Code: MIT. League icons, animations and sounds © Riot Games; not covered by the MIT license. Not endorsed by Riot Games.',
  errors: {
    imageTooLarge: 'Image must be at most 8 MiB and within the supported dimensions.', imageType: 'Use a valid PNG, JPEG, GIF or WebP image.',
    animationTooLarge: 'Animations must be at most 5 MiB and 1024 pixels per side.', duplicateEmote: 'This image is already in your library.', emoteLimit: 'Up to 24 custom emotes are supported.',
    soundTooLarge: 'Sounds must be at most 1 MiB.', soundTooLong: 'Sounds must be at most 5 seconds.', soundType: 'Use a valid WAV, OGG or MP3 sound.',
    invalidPack: 'This is not a valid emote pack.', incompatiblePack: 'This pack is for a different version.', packChecksum: 'The pack is damaged or its contents have changed.',
    packTooLarge: 'The pack exceeds the size limit.', invalidPackEntries: 'The pack has missing or unexpected files.', unsafePackPath: 'The pack contains an unsafe file path.',
    packNeedsRemoval: 'The installed pack is damaged. Remove its data directory before importing again.', helperExited: 'The input helper stopped. Try starting again.',
    missingEmote: 'This emote is unavailable.', uploadTooLarge: 'This file exceeds the size limit.', audio: 'The sound could not be played. Check the audio output device.',
  },
  pingNames: { danger: 'Danger', push: 'Push', omw: 'On my way', allin: 'All in', assist: 'Assist me', needvision: 'Need vision', missing: 'Enemy missing', enemyvision: 'Enemy vision', generic: 'Generic', bait: 'Bait', visioncleared: 'Vision cleared', missingflip: 'Upside-down missing' },
};
export type Strings = typeof en;
const zh: Strings = {
  title: '桌面信号', subtitle: '随时在桌面表达一个信号。', start: '启动', stop: '停止', stopped: '已停止', running: '运行中', paused: '已暂停', starting: '正在启动…', failed: '启动失败', noAccess: '需要辅助功能授权',
  pause: '暂停', resume: '恢复', capturePaused: '录制按键期间暂时暂停', capturePauseHelp: '完成或取消按键录制后，会回到之前的运行或暂停状态。',
  resumeHelp: '当前不会触发信号，点击“恢复”或按', stoppedHelp: '输入监听已释放。点击“启动”后即可使用桌面信号。', saving: '正在保存…', saved: '更改会自动保存',
  intro: '按住触发键并拖动选择信号，松开后显示。普通键鼠操作会继续传给下方应用。', lifecycle: '关闭此标签页后仍继续运行；停止会释放输入监听；退出 DBX 后停止。',
  triggers: '操作控制', pings: '信号与声音', emotes: '本地表情', preferences: '偏好设置', trigger: '信号触发键', emoteTrigger: '表情触发键', off: '关闭', custom: '自定义按键…', mouse4: '鼠标侧键 4', mouse5: '鼠标侧键 5',
  toggle: '暂停 / 恢复快捷键', capture: '请按一个键，Esc 取消', captureShortcut: '请按 Ctrl / Alt / Command 与其他键的组合', hintUnusable: '该键无法使用。', hintNotTrigger: '请选择其他按键。', hintNeedModifier: '请加入 Ctrl、Alt 或 Command。',
  clickPing: '触发键 + 单击显示信号', emoteClick: '触发键 + 单击显示表情', gameCheck: '全屏游戏保留普通点击操作', dragThresholdPx: '拖动阈值', wheelSizePx: '轮盘大小', pingSizePx: '信号大小', pingDurationS: '信号持续时间', emoteSizePx: '表情大小', volume: '音量',
  muted: '静音', tickSound: '轮盘选择音效', emoteSound: '播放表情音效', keepLastPing: '保留最后一个信号，直到下次打信号', wheel: '信号轮盘', clickPingId: '单击信号', emoteWheel: '表情轮盘', clickEmoteId: '单击表情', preview: '预览',
  slots: ['上', '右上', '右', '右下', '下', '左下', '左', '左上'], addImage: '导入图片', importPack: '导入扩展表情包', packInstalled: '扩展包已安装 · 44 个内置表情',
  packHint: '已内置 9 个表情，其他 35 个可通过离线扩展包导入。支持自定义 PNG、JPEG、GIF 和 WebP 图片。', remove: '移除', sound: '导入音效', upload: '正在导入', done: '导入完成', retry: '重试',
  permission: '打开辅助功能设置', permissionHelp: '请在 macOS 辅助功能中允许本插件 / DBX，然后重试。更新后可能需要重新授权。', language: '语言', auto: '跟随 DBX', reset: '重置偏好设置', hostRequired: '请从 DBX 插件中心打开此页面。', loading: '加载中…', error: '操作失败', seconds: '秒', pixels: '像素',
  attribution: '基于 lolPing。代码采用 MIT 许可；英雄联盟图标、动画与音效归 Riot Games 所有，不在 MIT 许可范围内。本插件未经 Riot Games 背书。',
  errors: {
    imageTooLarge: '图片不能超过 8 MiB，且需满足尺寸限制。', imageType: '请选择有效的 PNG、JPEG、GIF 或 WebP 图片。', animationTooLarge: '动画不能超过 5 MiB，单边不能超过 1024 像素。', duplicateEmote: '此图片已在表情库中。', emoteLimit: '最多可添加 24 个自定义表情。',
    soundTooLarge: '音效不能超过 1 MiB。', soundTooLong: '音效不能超过 5 秒。', soundType: '请选择有效的 WAV、OGG 或 MP3 音效。', invalidPack: '这不是有效的表情扩展包。', incompatiblePack: '扩展包版本不匹配。', packChecksum: '扩展包损坏或内容已被修改。', packTooLarge: '扩展包超出大小限制。', invalidPackEntries: '扩展包文件缺失或包含额外文件。', unsafePackPath: '扩展包包含不安全的文件路径。', packNeedsRemoval: '已安装的扩展包损坏，请清理扩展包数据目录后重新导入。', helperExited: '输入监听进程已退出，请重新启动。', missingEmote: '此表情不可用。', uploadTooLarge: '文件超出大小限制。', audio: '无法播放声音，请检查音频输出设备。',
  },
  pingNames: { danger: '危险', push: '推进', omw: '正在路上', allin: '全力进攻', assist: '协助我', needvision: '需要视野', missing: '敌人消失', enemyvision: '敌方视野', generic: '普通信号', bait: '诱饵', visioncleared: '视野已清除', missingflip: '倒置问号' },
};
export const strings = (lang: Lang): Strings => lang === 'zh-CN' ? zh : en;
