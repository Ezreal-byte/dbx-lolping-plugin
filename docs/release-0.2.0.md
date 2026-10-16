# lolPing Lite 0.2.0

覆盖层改用 Rust 原生绘制，移除 Wry、WebView2/WKWebView 与覆盖层网页脚本。设置页继续使用 DBX 的工作台。

- 保留信号与表情轮盘、点击信号、动画、音效、自定义图片/声音、离线扩展包和全部现有设置。
- 覆盖层按当前画面范围分配缓冲，空闲时释放；表情使用后台流式解码与有限帧队列。
- 光圈复用预绘制图像，稳定尺寸图片使用受限缓存；音频解码和设备初始化移到后台线程。
- 保持原有 C++ 手势判定，保留手动/快捷键暂停与录制按键后的状态恢复。
- 兼容 0.1.x 配置和 `lolping-extra-emotes-1.zip`，无需重新导入素材。

Windows x64：`io.dbx.lolping.lite-0.2.0-windows-x64.dbxp`。

macOS Apple Silicon：`io.dbx.lolping.lite-0.2.0-darwin-arm64.dbxp`。

开发包通过 DBX 的开发包安装入口导入。macOS 包为 ad-hoc 签名；辅助功能授权、全屏空间、多屏缩放和主观手感仍需实机确认。

上游：[darrenprx/lolPing](https://github.com/darrenprx/lolPing)，固定提交 `b947aab8d379015687117544191160bd82141954`。感谢 Darren 和上游贡献者；保留 MIT 代码声明与 Riot 素材归属说明。
