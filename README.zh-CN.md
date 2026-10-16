# lolPing Lite · DBX 插件

全桌面信号和本地表情。设置界面嵌入 DBX，Rust 直接绘制原生透明覆盖层，C++ helper 处理键鼠手势。覆盖层不再使用 WebView，也没有浏览器子进程、Electron、房间、局域网发现、中继、遥测或自动下载。

插件 ID：**`io.dbx.lolping.lite`**。本项目基于 [darrenprx/lolPing](https://github.com/darrenprx/lolPing)，固定上游提交为 [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954)。感谢 Darren 和上游贡献者提供输入引擎、轮盘、动画和测试。插件图标使用上游 `enemy_missing.png` 黄色问号素材，归 Riot Games 所有。

## 安装和使用

0.2.1 将覆盖层迁移为 Rust 原生绘制，修复 Windows 灰色外框，并改进轮盘字体。设置页仍由 DBX 承载，新增扩展表情包下载入口。Windows 单屏常用场景采样约 39–52 MiB（插件进程树，不含 DBX 宿主和设置页）；详见 [验证记录](docs/validation-0.2.1.md)。原有设置、自定义素材和离线扩展包继续兼容，保留「暂停 / 恢复」与录制按键后恢复此前状态的行为。

1. 在 DBX 插件中心的设置中启用开发包安装，选择对应平台的 `.dbxp`。当前输出是未签名的本地开发包；商店分发需由仓库运营方签名。
2. 打开「桌面信号」工作台，点击「启动」。默认按住 Alt（Mac 为 Option）并拖动选择信号；Ctrl 对应表情；Ctrl+Alt+P 暂停/恢复。
3. 关闭工作台标签页不会停止已启动功能。「停止」会关闭覆盖层并释放全部输入监听；退出 DBX 时一起结束。下次启动 DBX 后需在插件里再次启动。
4. 主包带默认轮盘的 8 个表情及点击表情。需要其余 35 个时，点击“导入扩展表情包”旁的“去 GitHub 下载”，在 Release 的 Assets 中下载 `lolping-extra-emotes-1.zip`，再回到设置中导入；导入过程可离线完成。
5. 支持导入 PNG/JPEG/GIF/WebP 自定义表情，最多 24 个；静态输入不超过 8 MiB，动画不超过 5 MiB / 1024 像素。每个自定义表情可配 WAV/OGG/MP3 音效，不超过 1 MiB / 5 秒。

macOS 第一次启动需要辅助功能授权。点击设置中的授权按钮，在系统设置中允许 lolPing Lite / DBX，然后重试。Mac 包中的原生组件采用独立 app bundle；本地默认 ad-hoc 签名，更新后可能需要重新授权。没有 Apple Developer 证书时不声称已公证。

## 开发

Windows x64 需要 Node.js 22、Rust、Visual Studio C++ Build Tools 和 CMake。macOS Apple Silicon 需要 Xcode Command Line Tools、Node.js 22、Rust 和 CMake。插件覆盖层不再依赖 WebView2 或 WKWebView；DBX 设置页使用宿主已有的界面容器。

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:helper
npm run test:backend
npm run build
npm run package
npm run test:smoke
npm run dev
```

`npm run dev` 将设置页和真实 Sidecar 接到本机 `http://127.0.0.1:4178`，仅用于开发，不能代替 DBX 实际安装验证。`scripts/smoke.mjs --no-desktop` 可跳过桌面覆盖层和全局输入检查。CI 为 Windows x64 / macOS arm64 构建；Mac 辅助功能、全屏空间等仍须实机验收。

`npm run dev:dbx -- ../dbx` 使用相邻 DBX 源码仓库的官方开发宿主（需先构建其开发宿主 UI），检查实际 iframe 沙箱、权限、事件和二进制桥接。设置 HTML 已内嵌脚本、样式和信号图标。

## GitHub Actions 双平台构建

`.github/workflows/build.yml` 在 push、pull_request 和手动 workflow_dispatch 时分别构建 Windows x64 与 macOS Apple Silicon。先检查 runner 架构，再运行 TypeScript、C++ 和 Rust 测试、release 构建、包校验及无需输入授权的 RPC 冒烟测试。

在 Actions 对应运行的 Artifacts 下载 `lolping-lite-windows-x64` 或 `lolping-lite-darwin-arm64`，内含平台 `.dbxp`、SHA-256/大小元数据、离线扩展表情包和验证报告，保留 30 天。Mac 包会先完成 ad-hoc 签名；开发包未经过 DBX 商店签名或 Apple 公证。CI 不自动发布 Release，也不安装到用户 DBX。

构建产物从本仓库 Actions 的 Artifacts 或 [Releases](https://github.com/Ezreal-byte/dbx-lolping-plugin/releases) 下载。Windows 本地验证和内存采样见 `docs/validation-0.2.1.md`；实际发布包的大小和哈希以 Release 的 `release-candidates.json` 与平台 `.artifact.json` 为准。

## 架构与接口

- `backend/`：DBX SDK 的 framed JSON-RPC、持久化、资源路径校验、原生音频、上传和资源包校验。
- `backend/src/render/`：Rust 原生轮盘、信号动画、WebP/GIF 流式解码。tiny-skia 绘制矢量图形，图片使用定点混合；Windows 通过 UpdateLayeredWindow 显示，macOS 使用 CoreGraphics / CALayer。覆盖层只分配当前画面范围的缓冲，空闲时释放；两个后台解码线程各提前缓存有限帧。
- `src/renderer/`：DBX 承载的 React 设置页。
- `native/hook-helper/`：上游 Win32 全局钩子 / macOS CGEventTap。标准输入关闭后 helper 退出；主动停止先发 shutdown，再执行有界终止。
- `resources/`：固定版本上游资源，包含素材 SHA-256。主包仅复制 9 个表情，其余生成独立离线包。

RPC 方法以 `lolping/` 为前缀：`state`、`start`、`stop`、`pause`（`on` 布尔值）、`settings`（补丁）、`preview`、`suspend`（捕获按键时有 20 秒自动恢复租期）、`permission`、`diagnostics`、`emote/remove`、`upload/begin`、`upload/cancel`、`upload/commit`。`lolping/settings` 事件只携带 `{settings}`；素材变化另发 `lolping/library`。状态中的 `pauseReason` 区分手动、快捷键和录制按键暂停。

上传通过 `upload/<id>` 二进制通道，每块最多 512 KiB，前 8 字节为大端 u64 偏移。必须等待 `lolping/upload` 事件确认再发下一块。扩展包带 `pack.json`，要求匹配版本、已知资源清单、大小和 SHA-256，拒绝路径越界、符号链接、重复及额外文件。配置和资源位于 `DBX_PLUGIN_DATA_DIR`，不会修改安装包目录。

## 验收边界

自动测试不能证明所有应用中的键鼠穿透与视觉效果。发布前按 `docs/manual-validation.md` 完成真实 Windows 和 Mac 验收。独占全屏游戏、安全桌面和更高权限窗口不保证可覆盖。当前不支持 Linux 和 Intel Mac。

上游仓库：<https://github.com/darrenprx/lolPing>；固定提交 `b947aab8d379015687117544191160bd82141954`。原始代码遵循 MIT；游戏素材属于 Riot Games，不适用 MIT。见 LICENSE 和 THIRD_PARTY_NOTICES.md。
