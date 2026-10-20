# Tonut 🍩

在 Codex 桌面端原头像周围显示细额度圆环，悬停或聚焦显示剩余百分比和距重置时间。圆环与额度条跟随宿主强调色，时间条为灰色；进入条动画 480ms、面板160ms，移开立即隐藏。尊重系统减少动态效果设置。

**Tonut = Token + Donut。** 独立的 Codex 头像额度圆环项目。源码与安装说明：[Caterrr/Tonut](https://github.com/Caterrr/Tonut)。

## 工作方式与边界

这是社区页面注入工具，不是官方插件、MCP 插件或独立悬浮窗。参考 [jaykinhoo9/codex-usage-badge](https://github.com/jaykinhoo9/codex-usage-badge) 的部署方式：登录后台观察新启动的官方 Codex 应用，在安全条件满足时请求正常退出，并带 `--remote-debugging-address=127.0.0.1 --remote-debugging-port=39222` 重开；另一个后台连接主页面，注入本项目 SVG，断线/重载后恢复。

端口只监听本机，但它没有身份认证：其他本机程序可能通过该端口操控应用页面。安装意味着接受登录后台和本机调试端口。宿主应用包、签名、Dock、开机安全设置不做修改。无需辅助功能或录屏权限；若系统要求新的权限，先停止并检查原因。

取数来自安装应用自带官方 CLI 的 App Server `account/rateLimits/read`，通过 CLI 自身管理的现有登录状态读取。代码不打开、复制或上传 `auth.json`、Keychain、Cookie、聊天数据库或凭据。只将百分比、窗口长度与重置时间传入页面，不保存账号响应。没有网络遥测或自动下载更新。

默认选 `rateLimitsByLimitId.codex` 中10080分钟周窗口；旧格式仅在没有多桶映射时使用 `rateLimits`。`100-usedPercent` 是该 Codex 周期剩余额度，**不是整个 ChatGPT 的剩余 token**。可在安装目录 `config.json` 将 `duration` 改为300以显示5小时窗口，再重新加载本项目后台。不会根据套餐名猜窗口；缺失/过期/150秒未刷新时显示不可用。第二条为 `距重置秒数 / (窗口分钟数 × 60)`，表示时间比例。

## macOS 安装

依赖：可运行 Node.js24 的 macOS、官方 Codex 桌面端、Node.js24+、Xcode Command Line Tools（用于编译自己的启动辅助程序）。支持 Intel 和 Apple Silicon；没有 npm 运行依赖，无需 `npm install`。官方安装名可能为 `Codex.app` 或 `ChatGPT.app`，以 bundle ID `com.openai.codex` 核对。

下载或克隆 [Caterrr/Tonut](https://github.com/Caterrr/Tonut)，进入项目根目录后运行：

```sh
node scripts/manage-macos.mjs install /Applications/ChatGPT.app
node scripts/manage-macos.mjs status
```

也可在终端运行 `zsh Install.command`，它会寻找上述两个常见应用路径。GitHub 网页上传不保留可执行位，使用这里的 `node` 或 `zsh` 命令即可，无需调整系统安全设置。安装器只编译并 ad-hoc 签名自己的通用二进制，不签名宿主，不提供 Gatekeeper 绕过操作。

安装文件在 `~/Library/Application Support/Tonut`，登录任务为：

- `~/Library/LaunchAgents/com.tonut.agent.plist`
- `~/Library/LaunchAgents/com.tonut.startup.plist`

安装不会退出当前已运行的工作窗口。**请正常退出 Codex 后再从原图标打开**，并等待数秒；首次普通启动可能出现一次正常重开以启用端口。此后额度连接自动恢复。脚本不会强退或接管长时间运行的窗口。

自动重开必须同时满足：仅一个目标实例、参数可确认且为无参数普通启动、启动完成且在前台、启动不超过8秒、启动后没有键盘/点击/滚轮操作、端口未占用、距上次尝试超过120秒。退出被拒、出现其他实例、期间用户操作或状态不明均停止；已拒绝实例不反复尝试。辅助程序只读取输入活动计数/时间，不记录键值、文本、鼠标位置或截图。

更新：在独立 Tonut 仓库获取审阅过的新源码后重新运行同一安装命令；先编译检查成功再替换后台文件。不会自动下载或执行远程更新。

卸载：

```sh
node scripts/manage-macos.mjs uninstall
```

若已移除源码，可运行：

```sh
node "$HOME/Library/Application Support/Tonut/scripts/manage-macos.mjs" uninstall
```

卸载移除本项目两个后台和自己的文件、清理自己的页面元素。随后正常退出并普通重开 Codex，关闭仍由宿主持有的调试端口。其他插件、任务和仓库文件不受影响。

## Windows（实验代码，尚无实机验证）

提供与 macOS 相同的保守启动控制器、Windows 原生活动/进程观察和登录后台。需要 Windows10/11、Node.js24+、Windows PowerShell5.1、Task Scheduler 和带有效 OpenAI 发布者签名的官方桌面/CLI。需要系统现有脚本策略允许执行本地脚本；本项目不绕过或更改策略。如果受组织策略阻止，请停止并由管理员审阅，不要禁用安全设置。

安装入口为 `windows/manage.ps1 -Action Install -AppExe ... -CodexCli ...`；两个参数必须是实际安装的官方可执行文件绝对路径，不读取凭据。由于尚未在 Windows 上执行，**此版本暂不提供复制即用的 Windows 安装承诺**。`Install.cmd` 是该入口的封装，需先完成实机审阅。源文件的语法/安全静态检查和跨平台控制器单元测试通过，不等于 Windows 安装或 UI 实测。

安装目录 `%LOCALAPPDATA%\Tonut`，登录计划任务 `Tonut`，以当前交互用户、普通权限运行。WScript 隐藏启动 supervisor，避免登录出现控制台；自有进程使用锁避免重复。停止/卸载通过 `stop.request` 协作完成，不强退宿主或辅助进程。后台未正常停止时卸载会中止，保留文件供检查。

更新重新运行安装入口。卸载入口 `windows/manage.ps1 -Action Uninstall` 或 `Uninstall.cmd`；随后正常重开宿主以关闭端口。Store 更新导致可执行文件路径变化时需审阅并重新安装，当前不会猜测或自动接管新的包路径。Windows DOM/主题变量也需实机确认；选择器不匹配时不显示。

## 模拟、验证和源码打包

```sh
npm test
npm run build:preview
npm run demo
```

模拟服务器仅监听 `127.0.0.1:43189`，或打开生成的 `preview.html`。模拟值89%，与真实账号无关。浏览器验证需要外部 `playwright-core` 和 Chrome；设 `PLAYWRIGHT_MODULE` 为模块位置、`CHROME_PATH` 为浏览器位置后运行 `npm run test:browser`。测试不会下载浏览器。

```sh
node scripts/package.mjs
```

在 macOS 生成 `dist/Tonut-0.3.0-source.zip` 和 SHA256SUMS，仅复制明确列出的公开源码。源码包需要上面列出的 Node 和编译工具，不包含 Node、宿主应用或账号数据。没有上传实机截图、账号快照或调试日志。详细验证范围见 [VALIDATION](docs/VALIDATION.md)。

## 故障排查

- **重新打开后没圆环**：先运行 status。已运行的窗口不会被安装器接管；正常退出重开并在刚启动时暂停操作。活动/后台启动会安全跳过，可能需要下次普通启动。不要反复强退。
- **端口39222冲突**：查看 `lsof -nP -iTCP:39222 -sTCP:LISTEN`。不要结束不明进程或把端口暴露到网络。启动观察记录在安装目录 `macos/startup/state.json`，只含本地事件/PID，不要公开上传。
- **有圆环但灰色**：在官方使用情况中确认账号/指定周期可用；本项目不代替官方登录，不把缺失值显示为100%。额度每60秒刷新。
- **应用更新后消失**：当前只接受唯一 `app://-/index.html` 主页面和导航栏中精确的中/英文资料菜单头像结构；改版时先复核 DOM。多窗口不猜目标。
- **Node移动/删除**：登录任务使用安装时的绝对 Node 路径；重新安装以更新。
- **编译或签名失败**：保留源码，检查 Xcode 工具；不要关闭 Gatekeeper、SIP 或重签名宿主。
- **脚本策略/新权限提示**：停止并检查；这里没有要求启用辅助功能、录屏或放宽脚本策略。

MIT；上游启动辅助代码的原版权和完整许可保留于 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
