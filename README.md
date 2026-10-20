# Tonut 🍩

**Token + Donut** — 在 Codex 桌面端原头像周围显示细额度圆环。悬停显示剩余额度、距重置时间，以及真实可用重置券的小甜甜圈。

**0.4.2 发布范围：Mac 源码安装版；Windows 测试版。** [下载源码安装包](https://github.com/Caterrr/Tonut/releases/latest)。包内包含两平台安装/卸载入口，无 npm 运行依赖。Windows 的 CI 解析、编译、内核锁和模拟恢复测试不等于安装了 Codex 的 Windows 真机验证。

## 安装条件

- 官方 Codex 桌面端；Mac 安装名可能为 `Codex.app` 或 `ChatGPT.app`，bundle ID 为 `com.openai.codex`，OpenAI 签名团队为 `2DC432GLL2`。
- Node.js24+。Mac 还需要 Xcode Command Line Tools，安装器会从审阅过的源码编译自己的通用辅助程序。安装器不自动下载系统软件。
- Windows10/11、Windows PowerShell5.1 和 Task Scheduler；官方桌面及 CLI 必须有有效 OpenAI 发布者签名，现有脚本策略允许执行本地脚本。源码打包开发命令另需 Python3。

## macOS

下载 `Tonut-0.4.2-source.zip` 并解压，终端进入其中 `Tonut` 文件夹。按实际应用路径运行：

```sh
node scripts/manage-macos.mjs install /Applications/ChatGPT.app
node scripts/manage-macos.mjs status
```

也可运行 `zsh Install.command`，它会检查已有配置及常见应用路径。不需要 `npm install`。如果系统拦截执行、缺少工具或要求新的权限，停止并检查；不要关闭安全保护或修改宿主签名。

文件安装到 `~/Library/Application Support/Tonut`，登录任务仅为 `com.tonut.agent` 和 `com.tonut.startup`。安装/更新不退出当前宿主窗口。首次启用时，正常退出 Codex，再从原图标打开并等待数秒。

更新：解压审阅过的新版本，重新执行同一 `install` 命令。安装器先暂存全部文件、编译与检查，再正常停止 Tonut 并切换；失败自动恢复旧文件、配置和服务。现有 `duration`（10080周／300五小时）和自定义头像选择器会保留。`duration` 优先决定圆环与顶部两行跟随哪个实际窗口；该窗口缺失时使用官方确实返回的另一窗口，不修改保存的偏好。最后一个健康版本位于 `Tonut.previous`。安装期间不要移动源码文件夹。

若更新被系统中断，使用新版本源码运行：

```sh
node scripts/manage-macos.mjs recover
node scripts/manage-macos.mjs status
```

卸载：

```sh
node scripts/manage-macos.mjs uninstall
```

源码已移除时：

```sh
node "$HOME/Library/Application Support/Tonut/scripts/manage-macos.mjs" uninstall
```

卸载只正常停止 Tonut、移除其两个登录任务和安装/上一版本目录，不强退宿主。调试端口属于宿主；方便时正常退出并普通重开宿主即可关闭。

## Windows 测试版

解压后在 PowerShell 进入 `Tonut`。首次安装需提供实际官方桌面及 CLI 路径（请替换占位符）：

```powershell
.\windows\manage.ps1 -Action Install -AppExe 'C:\实际安装目录\Codex.exe' -CodexCli 'C:\实际官方CLI目录\codex.exe'
.\windows\manage.ps1 -Action Status
```

`Install.cmd` 是该入口的封装，接受相同的 `-AppExe`／`-CodexCli` 参数。未知或未签名的可执行文件会拒绝安装；不会绕过 PowerShell 策略。尚未验证你的 Windows 安装包是否满足这些路径和签名条件，不能承诺复制占位命令即可安装。

更新时运行 `windows/manage.ps1 -Action Install`，沿用已有配置；异常中断后运行 `-Action Recover`。卸载用 `-Action Uninstall` 或 `Uninstall.cmd`。

安装目录 `%LOCALAPPDATA%\Tonut`，计划任务 `Tonut`，当前交互用户普通权限。任务同步监督 watchdog，watchdog 以用户会话内核互斥避免重复；supervisor 监督两个 worker。父进程退出时通过管道/IPC 正常停止子进程。卸载按本项目实际进程核验，不把残留 PID 锁文件当成活进程。Store 更新只解析已记录的精确包名称、family和publisher，重新核验官方签名与包内相对路径；无法确认时停止接管并报告，不猜包。

## 数据与界面

- 官方内置 CLI App Server `account/rateLimits/read`；只允许初始化及这一只读方法。优先取 `rateLimitsByLimitId.codex` 的指定窗口，旧格式仅在没有多桶映射时使用 `rateLimits`。
- 按 `windowDurationMins` 识别10080分钟周窗口和300分钟5h窗口，不把 primary/secondary 的位置当成时长。有两种窗口时保留原主窗口展示，并追加一行标注5h（或另一周窗口）的剩余百分比及对应重置倒计时；只返回一种时只显示一种，字段未知不显示为0。官方字段定义见 [App Server](https://learn.chatgpt.com/docs/app-server)。
- 圆环为 `clamp(100-usedPercent,0,100)`；是 Codex 指定周期的限额剩余比例，不是整个 ChatGPT 的剩余 token。下条为距重置秒数／窗口长度，表示时间。
- 重置券数量来自 `rateLimitResetCredits.availableCount`，数量以官方汇总为准，详情缺失不影响计数。真实数量为0时右侧显示“没有！！”，读取未知或失败显示“—”；未知不是零，不推算或兑换。超过8张时最多画8枚并显示其余数量。不显示券的到期时间，也不将券详情传入页面。
- 金黄色圈、棕色巧克力和短矩形彩色糖针均为可编辑 SVG：`assets/tonut-donut.svg`。甜甜圈在原头像 hover 弹层底部靠左展示数量；券行上方留白16px，保持离开立即隐藏。
- 保留原头像位置、细圆环、480ms条／160ms面板进入、移开立即隐藏、主题跟随和减少动态效果。缺失、错误、重置过期或150秒未刷新时显示不可用。

## 机制、风险与诊断

这是社区页面注入工具。后台仅连接 `127.0.0.1:39222`，核验宿主签名、进程、监听所有者以及唯一 `app://-/index.html` 主页面。自动重开只限新启动8秒内、前台、无后续键盘/点击/滚轮输入、单实例普通启动；先写冷却记录，再请求正常退出。退出拒绝、用户操作、另一个实例或身份不明均停止，120秒内不重复尝试。

**CDP 没有本机客户端身份认证。** 同机程序可能利用端口读取或控制宿主页面；进程核验减少误连，并不能消除这个风险。安装意味着接受已说明的登录后台及本机调试方式。宿主包、签名、Dock、安全设置和其他登录项不修改；没有辅助功能或录屏要求。

代码不打开/复制凭据文件、Cookie或聊天数据库，不保存原始账号响应。进程核验只用于确认宿主/Tonut本身。`diagnostics/` 只写固定状态码、时间和恢复状态，每组件日志约16KiB轮换、最多保留两个旧文件；不写聊天、账户响应、券ID、原始命令行或异常文本。健康回执另含自有 PID 和安装随机标识。状态文件和事务回执留在本地，别把整个安装目录公开上传。

`status` 可见：`ready`、`waiting_host`、`host_hidden`、`identity_mismatch`、`target_ambiguous`、`cdp_timeout`、`quota_unavailable` 等。遇到身份不匹配或39222冲突，不要结束不明进程、放宽监听或跳过校验；核对官方应用及安装路径。宿主界面改版或多主窗口时会停止猜测头像；Node路径改变后重新安装。Windows和自动启动恢复仍有 [验证边界](docs/VALIDATION.md)。

## 开发和验证

```sh
npm ci --ignore-scripts
npm test
npm run build:preview
npm run test:browser
```

浏览器测试使用外部 Chrome，必要时设 `CHROME_PATH`；不自动下载浏览器。`npm run demo` 仅监听 `127.0.0.1:43189`，默认周89%、可切换的5h62%和2张券均为模拟数据；按钮可分别检查仅周、仅5h和双窗口。编辑 SVG 后运行 `npm run build:icon`。

`node scripts/package.mjs` 用 Python3 打包明确列出的源码，生成 ZIP、内部清单和 `dist/SHA256SUMS`。不带 Node、宿主、私有证据或已登录数据。需要在自己的已备份 Mac 上核验实际回滚时，明确运行 `node scripts/verify-macos-update.mjs --live`；它短暂重载 Tonut 自有任务，不退出宿主。

[发布验收](docs/RELEASE_CHECKLIST.md) · [更新记录](CHANGELOG.md) · [MIT及上游署名](THIRD_PARTY_NOTICES.md)。
