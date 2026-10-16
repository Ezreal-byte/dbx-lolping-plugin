# 2026-10-16 验证记录

## 源码与输出

- 原始仓库：`E:\xynanan\lolPing`，提交 `b947aab8d379015687117544191160bd82141954`，未修改。
- 插件仓库：`E:\xynanan\dbx-lolping-plugin`。DBX 宿主源码未修改。
- Windows x64 本地检查包：`dist/io.dbx.lolping.lite-0.1.0-windows-x64.dbxp`，约 **17.48 MiB**。
- 包内文件合计约 **21.69 MiB**，不含首次运行后生成的 WebView 缓存及用户导入资源。
- 离线扩展包：`dist/lolping-extra-emotes-1.zip`，约 **39.67 MiB**，35 个额外表情。
- 本地包与 GitHub CI 构建环境不同；正式发布包的 SHA-256 和大小见 Release 的 `release-candidates.json`。
- 上游全部资源保留原始字节，主包包含 9 个默认表情；无 Electron、房间或网络同步模块。

## 已通过

- TypeScript 类型检查；116 项前端单元测试（包括 SDK 分块 ACK、写入顺序与失败取消）。
- 444 项 C++ helper 测试；11 项 Rust 测试。音频测试实际解码全部上游 WAV/OGG 文件，包含 Opus。
- Windows Rust release 构建和 `.dbxp` 打包；DBX manifest schema、SHA-256 全文件校验、内嵌设置资源和 30 MiB 上限验证。
- 13 项端到端检查，记录在 `dist/smoke-report.json`：握手、默认停止、设置校验与持久化、图片及音效导入、重复与损坏/路径越界导入拒绝、35 个离线表情导入、删除自定义表情、多显示器覆盖层加载、重复启停、捕获暂停、宿主管道断开清理、重启保留配置及强制结束后端后的 helper 退出。
- 在本机两个显示器上创建实际透明 WebView；通过屏幕检查确认主屏信号显示且透明区域可见下方桌面。
- 在 DBX 自带开发宿主中打开实际沙箱工作台，显示图标、读写设置、启动/停止、预览，以及关闭工作台再打开后保留运行状态；检查期间未发现浏览器错误日志。
- GitHub Actions YAML 解析通过。双平台 matrix 使用 Windows x64 与 macOS arm64，并上传构建包、扩展包与报告。
- 设置页已去掉自身侧栏，使用 DBX 主题变量及上游原版图标；在官方开发宿主中检查浅色和深色主题均正常。宿主自身的工作台导航不属于插件页面。

## 未验证事项

- 尚未在正式 DBX 桌面客户端安装、更新或卸载插件。官方开发宿主与独立 RPC 测试不能代替正式宿主安装测试。
- 浏览器自动化未能接管 iframe 内的文件选择器，界面选文件到上传的完整链路待人工确认；二进制上传与资源导入已经通过自动测试。
- 真实键鼠手势、焦点保持、混合 DPI、负坐标、热插拔和系统快捷键仍按 `manual-validation.md` 验收。当前通过的两个屏幕加载检查不等于所有显示器拓扑都已测试。
- 此记录覆盖 Windows 本地验证。macOS 构建和签名由 GitHub Actions 完成，运行结果以仓库 Actions 为准；没有进行 Mac 实机测试。
- Mac 的辅助功能拒绝/授权/重试、升级后授权状态、全屏 Spaces 和 Mission Control 行为需在 Actions 构建通过后实机确认。

当前交付为本地开发版本，不声称已完成商店签名、Apple 公证或上述全部桌面验收。
