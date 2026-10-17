# lolPing Lite 0.3.0

**设置页全新改版，六类横向导航，视觉风格跟随 DBX。**

- **设置更好找**：按「触发、快捷开关、信号与声音、轮盘、表情、插件」分类，集中展示运行状态、启动／暂停／恢复以及保存反馈；窄窗口自动调整布局。
- **与 DBX 更协调**：使用宿主的颜色、字体、圆角和深浅色，中性色按钮替代金色按钮。黄色问号产品图标与原有游戏素材继续保留。
- **直接编辑轮盘**：点击方向，再点击素材完成分配；素材已在外圈其他方向时交换槽位，中心信号单独设置。分配与试发分开，修改配置不会自动打出信号。
- **表情管理更清楚**：支持搜索与缩略图，保留图片／声音导入、自定义素材删除、离线扩展包导入和 GitHub 下载入口。
- **适合插件的设置**：只提供 DBX 插件现有能力，不显示独立版的开机启动、托盘等选项。中英文、自动保存、按键录制及录制后的暂停状态恢复继续可用。

本次同时补充修复 Windows 覆盖窗口在显示、置顶或改变大小后残留的圆角裁剪，避免屏幕角落的信号被截掉。覆盖层继续使用 Rust 原生绘制，保留 0.2.2 的屏幕边缘显示修复；C++ 全局输入监听、光标位置、拖动阈值和方向判断不变。原有配置、导入素材和扩展表情包继续兼容。关闭设置页仍可继续打信号；停止或退出 DBX 时释放监听和覆盖层。

设置页仍在 **DBX 已有界面容器** 中运行，覆盖层不使用 WebView；本次不新增内存降幅声明。README 中的 39–52 MiB 是此前 0.2.1 的插件进程树采样，不包含 DBX 和设置页。

## 下载与更新

| 平台 | 文件 |
| --- | --- |
| Windows x64 | `io.dbx.lolping.lite-0.3.0-windows-x64.dbxp` |
| macOS Apple Silicon | `io.dbx.lolping.lite-0.3.0-darwin-arm64.dbxp` |
| 可选的其余 35 个表情 | `lolping-extra-emotes-1.zip` |

先停止插件，再通过 DBX 开发包安装入口导入对应 `.dbxp`，然后重新启动。Release 提供供商店审核的未签名开发包，正式商店包由 dbx-store 审核签名。macOS 原生程序采用 ad-hoc 签名，未公证。扩展 ZIP 在设置页直接导入，无需解压；此前已导入的扩展包无需重新下载。

发布使用同一源码提交的 Windows x64 / macOS arm64 CI 产物，大小与 SHA-256 记录在 `release-candidates.json` 和各平台 `.artifact.json`。CI 覆盖 TypeScript、C++、Rust、打包校验和无桌面协议／资源检查；它不替代 macOS 辅助功能、全屏空间与真实桌面手感验收。

本地 Windows 验证通过 TypeScript 检查、106 项前端测试、444 项 C++ 检查、25 项常规 Rust 测试及 17 项实际桌面 smoke 检查。单独运行的原生桌面回归覆盖四边四角、随后在屏幕中间打开轮盘和空闲唤醒，17 个场景的实际像素均匹配。设置页在 DBX SDK 的真实 iframe 沙箱中完成启停、暂停／恢复、录制取消、轮盘分配和试发；检查了六个 TAB、深色中文、浅色英文和窄窗口。详见 [验证记录](https://github.com/Ezreal-byte/dbx-lolping-plugin/blob/v0.3.0/docs/validation-0.3.0.md)。

## English

Version 0.3.0 redesigns the DBX-hosted settings page with six horizontal categories, host theme colors and neutral buttons. Visual ping/emote wheel editors let you choose a direction and assign a resource; occupied resources swap slots, and preview stays a separate action. Emote search, local image/audio imports, offline pack import/download, Chinese/English text and automatic saving remain available. Only plugin features are shown, without standalone autostart or tray controls.

The overlay remains natively rendered in Rust. Windows now clears a remaining corner-clipping region after overlay windows are shown, raised or resized; the earlier 0.2.2 screen-edge fix remains in place. Global input gestures and existing settings/assets stay compatible. This release makes no new memory-reduction claim. Download the `.dbxp` matching Windows x64 or macOS Apple Silicon; the optional emote ZIP is unchanged. Release packages are unsigned DBX Store candidates; macOS executables have ad-hoc signatures and are not notarized. Platform CI does not replace macOS hardware acceptance.

## 来源与授权

基于 [darrenprx/lolPing](https://github.com/darrenprx/lolPing)，固定上游提交 `b947aab8d379015687117544191160bd82141954`。感谢 Darren 和上游贡献者。代码保留 MIT 声明；游戏图标、动画和音效归 Riot Games 所有，不属于 MIT 授权范围。导航使用 Fluent System Icons（MIT），覆盖层 Inter 字体使用 SIL OFL 1.1；详见 `THIRD_PARTY_NOTICES.md`。
