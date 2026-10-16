# lolPing Lite · DBX 插件

全桌面信号和本地表情。设置界面嵌入 DBX，Rust 原生进程使用系统 WebView 渲染覆盖层，C++ helper 处理键鼠手势。不携带 Electron，也没有房间、局域网发现、中继、遥测或自动下载。

插件 ID：**`io.dbx.lolping.lite`**。本项目基于 [darrenprx/lolPing](https://github.com/darrenprx/lolPing)，固定上游提交为 [`b947aab8d379015687117544191160bd82141954`](https://github.com/darrenprx/lolPing/tree/b947aab8d379015687117544191160bd82141954)。感谢 Darren 和上游贡献者提供输入引擎、轮盘、动画、测试及原版应用图标。

## 安装和使用

1. 在 DBX 插件中心的设置中启用开发包安装，选择对应平台的 `.dbxp`。当前输出是未签名的本地开发包；商店分发需由仓库运营方签名。
2. 打开「桌面信号」工作台，点击「启动」。默认按住 Alt（Mac 为 Option）并拖动选择信号；Ctrl 对应表情；Ctrl+Alt+P 暂停/恢复。
3. 关闭工作台标签页不会停止已启动功能。「停止」会关闭覆盖层并释放全部输入监听；退出 DBX 时一起结束。下次启动 DBX 后需在插件里再次启动。
4. 主包带默认轮盘的 8 个表情及点击表情。需要其余 35 个时，在设置中导入 `lolping-extra-emotes-1.zip`，不需要联网。
5. 支持导入 PNG/JPEG/GIF/WebP 自定义表情，最多 24 个；静态输入不超过 8 MiB，动画不超过 5 MiB / 1024 像素。每个自定义表情可配 WAV/OGG/MP3 音效，不超过 1 MiB / 5 秒。

macOS 第一次启动需要辅助功能授权。点击设置中的授权按钮，在系统设置中允许 lolPing Lite / DBX，然后重试。Mac 包中的原生组件采用独立 app bundle；本地默认 ad-hoc 签名，更新后可能需要重新授权。没有 Apple Developer 证书时不声称已公证。

## 开发

Windows x64 需要 Node.js 22、Rust、Visual Studio C++ Build Tools 和 CMake。macOS Apple Silicon 需要 Xcode Command Line Tools、Node.js 22、Rust 和 CMake。覆盖层依赖系统 WebView2/WKWebView；Windows 缺少 WebView2 时需要安装微软 WebView2 Runtime。

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

构建产物从本仓库 Actions 的 Artifacts 或 [Releases](https://github.com/Ezreal-byte/dbx-lolping-plugin/releases) 下载。Windows 本地验证记录见 `docs/validation-2026-10-16.md`；实际发布包的大小和哈希以 Release 的 `release-candidates.json` 与平台 `.artifact.json` 为准。

## 架构与接口

- `backend/`：DBX SDK 的 framed JSON-RPC、持久化、受限素材协议、原生音频、上传和资源包校验。UI 主线程运行 Tao/Wry，SDK 和文件处理运行在工作线程。
- `src/renderer/`：React 设置页、TypeScript/SVG 轮盘、DOM/CSS 信号动画及 WebP 表情。
- `native/hook-helper/`：上游 Win32 全局钩子 / macOS CGEventTap。标准输入关闭后 helper 退出；主动停止先发 shutdown，再执行有界终止。
- `resources/`：固定版本上游资源，包含素材 SHA-256。主包仅复制 9 个表情，其余生成独立离线包。

RPC 方法以 `lolping/` 为前缀：`state`、`start`、`stop`、`settings`（补丁）、`preview`、`suspend`（捕获按键时有 20 秒自动恢复租期）、`permission`、`diagnostics`、`emote/remove`、`upload/begin`、`upload/cancel`、`upload/commit`。

上传通过 `upload/<id>` 二进制通道，每块最多 512 KiB，前 8 字节为大端 u64 偏移。必须等待 `lolping/upload` 事件确认再发下一块。扩展包带 `pack.json`，要求匹配版本、已知资源清单、大小和 SHA-256，拒绝路径越界、符号链接、重复及额外文件。配置和资源位于 `DBX_PLUGIN_DATA_DIR`，不会修改安装包目录。

## 验收边界

自动测试不能证明所有应用中的键鼠穿透与视觉效果。发布前按 `docs/manual-validation.md` 完成真实 Windows 和 Mac 验收。独占全屏游戏、安全桌面和更高权限窗口不保证可覆盖。当前不支持 Linux 和 Intel Mac。

上游仓库：<https://github.com/darrenprx/lolPing>；固定提交 `b947aab8d379015687117544191160bd82141954`。原始代码遵循 MIT；游戏素材属于 Riot Games，不适用 MIT。见 LICENSE 和 THIRD_PARTY_NOTICES.md。
