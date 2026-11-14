# csp-migrate · 米格瑞特桌宠

银发、蓝眼、航海法杖，还有一小片海风。基于用户提供的米格瑞特（Migrate）设定制作的 Windows 透明桌面伙伴。

角色设定为 **15 岁的航海少女**，活泼、好奇、机灵，偶尔俏皮，做题时认真可靠。初期版本的默认角色设定会在启动时更新；自行编辑过的角色设定会保留。

<img src="docs/pet.png" alt="米格瑞特桌宠" width="250"> <img src="docs/interactions.png" alt="互动面板" width="340">

## 直接使用

从 [Releases](https://github.com/0103abc/csp-migrate/releases) 下载 `Migrate-1.0.0-win-x64.zip`，**完整解压**后运行 `Migrate.exe`。无需安装 Node.js；请保留 exe 同目录下的运行文件。

首次出现于主屏幕工作区右下角，自动避开任务栏。支持 Windows 10/11 x64。

| 操作 | 作用 |
| --- | --- |
| `Ctrl+Alt+M` | 全局显示 / 隐藏，设置中可修改 |
| 拖动角色 | 移动位置并记住位置 |
| 单击 / 双击 | 挥手 / 打开对话 |
| 右键角色 | 托盘式菜单、所有动作与退出 |
| 底部 `↻` / `✧` | 转身 / 潮汐魔法 |
| 底部 `♫` | 打开《白鸟过河滩》播放器 |
| 底部 `题` | 打开 QOJ 上 CSP-S 2026《迁徙》题面 |
| 底部 `⚙` | API 与桌面偏好 |
| 底部 `−` | 隐藏，程序仍留在系统托盘 |
| 托盘图标 | 双击切换显隐；右键显示、设置、动作、回右下角与退出 |

使用八种绘制姿态配合呼吸、摆动、跳跃、行走与说话动画。转身会显示单独绘制的背面，散步和拖动会显示侧面。支持自动小动作、70%–150% 大小、置顶及可选开机启动。

「设置 → 桌面偏好 → 界面与对话语言」可选 **简体中文** 或 **繁體中文（香港）**，默认简体中文。保存后界面、气泡、系统托盘文字及后续 AI 回复跟随所选语言。繁体转换使用随应用打包的 OpenCC 香港地区词典，离线完成。转身使用正面 → 侧面 → 背面的连续渐变过渡，快速重复点击会等待当前转身结束，不再压扁图像或瞬间跳面。

## 离线互动与题面

「互动」页提供 **17 种动作、30 组共 300 句原创台词**。分组包括清晨启航、午间停靠、黄昏归航、夜色灯塔、周末漫游、专注陪伴、轻轻打气、靠岸休息、茶歇小事、海岸来信、星图、海鸟、魔法、拖动、落地、听歌、做题等。同组以打乱的列表轮换，抽完一组前不会重复，也避免跨轮连续重复。闲暇时按本机时间选择适合的分组。全部在本地完成，不调用 API。

动作包括挥手、连续转身、开心、点头、摇头、轻跃、伸展、害羞、摇摆、漂浮、海鸟特效、潮汐魔法、回身看海、探头、打盹及向左/右散步。它们使用已绘制姿态与程序动画组合。

默认待机站稳，仅有很轻的纵向呼吸，不会持续左右摇晃。主要手动动作是 5–8.5 秒的分段演出，使用姿态渐变、准备、展开、停顿与收势；自动动作默认约 90 秒一次，可改为 45 秒、3 分钟、5 分钟或完全关闭。摇摆只作为手动动作提供。

「互动」页另有四段 **24–29 秒的生活小剧场**：一起吃饭、去她的灯塔小屋做客、请你吃草莓蛋糕、请你吃焦糖布丁。使用另外绘制的八张人物姿态、海边/客厅背景、连续分镜与前景动画；可暂停、继续、重播或结束。切换到其他页时自动暂停。场景与台词全部在本地播放，不调用 API。

<img src="docs/meal-scene.png" alt="与米格瑞特一起吃饭的小剧场" width="380">

题面入口位于桌宠底部「题」、互动页和右键菜单，打开 [QOJ #24562 · CSP-S 2026《迁徙》](https://qoj.ac/problem/24562/statement/zh_cn)；选择繁體中文（香港）时打开该题的 `yue_hk` 版本。不提交代码、不代为登录。

## 设置 DeepSeek

1. 点击 `⚙`，在 **API Key** 中填入自己的密钥。
2. 默认地址为 `https://api.deepseek.com`，默认模型为 `deepseek-flash`。可手动修改地址与模型。
3. 点击 **保存并测试连接**，成功后切到「对话」。测试会发起一次真实 API 调用。

支持 OpenAI 兼容的 Chat Completions 流式接口、中文增量回复、停止回复、多轮上下文与自定义角色设定。`Enter` 发送，`Shift+Enter` 换行。

密钥只在 Electron 主进程处理，通过 Windows DPAPI（Electron safeStorage）加密后保存。界面不会读取保存的密钥，也不会收到密文。设置位于 `%APPDATA%/csp-migrate/settings.json`（开发与打包后的应用名保持一致）。密钥无法随配置迁移到其他 Windows 账户；请重新填写。聊天记录只保存在当前进程内存中；退出或清空后移除。对话会发送至你在设置中填写的 API 服务。应用不执行模型返回的电脑指令。

## 《白鸟过河滩》

音符按钮打开听歌页，使用 Bilibili 原作内嵌播放器（[ilem / 洛天依原作](https://www.bilibili.com/video/BV1wT4y1k7Pw/)），另有浏览器打开按钮。在线视频可能受地区、平台、登录与浏览器自动播放策略影响；必要时在播放器内点击播放。

也可选择本机 MP3、WAV、OGG、FLAC、M4A 音频，提供播放、暂停、进度、音量与循环。音频仅由用户选择后在本机读取，不上传、不写入仓库，重启后需重新选择。仓库与发行包不附带歌曲文件。隐藏桌宠或关闭面板不会终止正在播放的音乐，可回到听歌页暂停；退出程序结束播放。

## 本地开发

安装 Node.js 22.12+（建议当前 LTS，含 npm）与 Git：

```sh
npm ci
npm start
```

若所用 npm 默认禁用依赖安装脚本，Electron 首次需要下载运行时：

```sh
node node_modules/electron/install.js
```

```sh
npm test       # 核心测试，离线，不需要 API Key
npm run test:ui # Windows 桌面集成测试：本机 mock API + 测试密钥 + 测试音频
npm run build  # 生成 dist/Migrate-win32-x64/Migrate.exe
npm run check:secrets # 检查 Git 跟踪文件与历史中的密钥模式
```

构建使用 Electron 45.3.2 / Chromium。若已经下载官方 Electron zip，可设置 `ELECTRON_ZIP_DIR` 为 zip 所在目录，构建时重复利用；文件名需为 `electron-v45.3.2-win32-x64.zip`。制作发行 zip 时压缩 `dist/Migrate-win32-x64` 内的全部内容。

开发时可执行 `git config core.hooksPath .githooks` 启用推送前的密钥检查。`.env`、个人设置、依赖、构建结果与私钥文件已加入忽略规则。不要把真实密钥写入源码、测试、README 或截图。密钥检查用于增加保护，不能替代妥善管理凭据。

## 项目结构与素材

- `src/main.cjs`：窗口、托盘、快捷键、拖动、多屏、配置、密钥和 API。
- `src/core.cjs`：接口参数、SSE 解析、历史边界与窗口位置。
- `src/preload.cjs`：明确限定的 IPC 接口；渲染器隔离且禁用 Node.js。
- `src/pet.*` / `src/panel.*`：桌宠与对话 / 听歌 / 设置面板。
- `assets/`：八姿态透明 PNG、图集、头像与图标；生成说明见 [assets/README.md](assets/README.md)。
- `test/`：核心测试与 Windows Electron 端到端测试。

代码采用 MIT 许可证；角色原设定及第三方音乐的权利归各自权利人。桌宠动画是八姿态与程序动画组合，并非 Live2D 或 3D 骨骼模型。

接口与窗口实现参考：[DeepSeek 官方文档](https://api-docs.deepseek.com/)、[Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[globalShortcut](https://www.electronjs.org/docs/latest/api/global-shortcut)、[safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)。
