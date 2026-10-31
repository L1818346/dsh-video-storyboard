# 视频分镜 · dsh-video-storyboard

> 让纯文本模型真正「看过」一段视频：**一张可寻址的分镜图** + **一份带时间码的文本清单**。
> 模型可以引用「第 5 格」、可以按时间码定位一句话，也可以对某几秒要求近看——
> 而不是被动接受一段别人写好的摘要。

**本仓库不含 ffmpeg / ffprobe**：这两个二进制约 250 MB，需要你自备或跑脚本取回。

---

## 五个工具

| 工具 | 干什么 | 何时用 |
|---|---|---|
| `video_probe` | 只读容器头：时长、分辨率、帧率、音轨/字幕、缓存状态 | 第一次接触一部片子先调它，不花图片 token |
| `video_storyboard` | 出宫格图 + 文本清单（主体） | 概览全片或某个时间窗 |
| `video_zoom` | 只看某一段，格少、每格大 | 清单里某段看不清，再放大 |
| `video_locate` | 纯文本：一句话 → 时间码 | 知道说了什么、不知道在第几分钟 |
| `video_watch` | 按播放进度一段段陪看 | 跟着用户正在看的片子往下读 |

## 安装

```bash
git clone git@github.com:L1818346/dsh-video-storyboard.git
cd dsh-video-storyboard

node scripts/fetch-ffmpeg.mjs     # 必须：按钉死的版本 + sha256 取 ffmpeg/ffprobe（约 160 MB，幂等）
pip install --user -U yt-dlp      # 可选：只有贴 B 站 / YouTube 链接才需要
node scripts/install-dev.mjs      # 挂进 desktop profile 并注册 bundle
```

然后**重启 DSH Desktop**。第一次调用若报 `ffprobe not found`，说明第 3 步没做或离线失败。

| 依赖 | 必须吗 | 说明 |
|---|---|---|
| ffmpeg + ffprobe | **必须** | 也可以装系统 ffmpeg（`winget install Gyan.FFmpeg`），或设 `DSH_FFMPEG_PATH` |
| yt-dlp | 可选 | 本地文件照常能用，贴链接不行 |
| ASR 服务 | 可选 | 能出图，但清单里没有台词 |

解析优先级：`DSH_FFMPEG_PATH` 等显式变量 > `vendor/ffmpeg/bin` > `~/.dsh/tools/ffmpeg` > `PATH`。

## 快速开始

```js
video_probe({ input: "D:/videos/lesson.mp4" })                  // 先知道多长、按什么粒度读
video_storyboard({ input: "D:/videos/lesson.mp4" })             // 全片概览
video_zoom({ input: "D:/videos/lesson.mp4", from: 72, to: 95 }) // 回到第 72–95 秒近看
video_locate({ input: "D:/videos/lesson.mp4", query: "第一次提到熵" })
```

链接也可以直接传（需要 yt-dlp；登录态走 cookies 文件）：

```js
video_storyboard({ input: "https://www.bilibili.com/video/BV1xx411c7mD" })
```

`video_watch` 需要一只带调试端口、已登录的浏览器；先在浏览器里登录一次即可。

## 长片怎么读

文本清单也有预算：一部两小时的片子全量清单可能超出单次工具结果上限。三件事堵住这个口子：

```js
// 4 张图 + 第一页文本
video_storyboard({ input, cells: 16, sheets: 4 })
// 翻页读文本：不重出图、不重解帧
video_storyboard({ input, cells: 16, sheets: 4, cellRange: [14, 42], textOnly: true })
```

命令行批处理（长片按窗口切）：

```bash
node bin/storyboard.mjs film.mp4 --batch 300 --out film.png
# → film-w01.png … film-w24.png，外加 film-timeline.md
```

## 配置与缓存

| 内容 | 位置 |
|---|---|
| 调试浏览器端口 | `~/.dsh/browser.json`（兼容 `~/.dsh/video.json`），与浏览器插件共用 |
| 媒体缓存 | `%LOCALAPPDATA%\dsh-video-storyboard\cache`（可用环境变量覆盖） |
| 转写 / 定位缓存 | 同上（按源文件缓存，重复调用直接命中） |

## 边界

- 分镜是**有损压缩**：时间轴全覆盖，但不保证每个镜头都被看到；要细节请 `video_zoom`。
- 格数由画面运动决定，不按时长决定；静态单镜头不会给 16 张一样的图。
- 不自动播放、不刷观看时长、不代做作业或考试——`video_watch` 只读播放位置，没有任何写回。
- 链接的清晰度取决于登录态；匿名时 1080P 可能根本不在格式列表里。

## 文档

- [docs/USAGE.zh.md](docs/USAGE.zh.md) — 每个参数、六种工作流、故障排查
- [docs/SETUP.zh.md](docs/SETUP.zh.md) — 装 yt-dlp、导出 cookies、五步验证
- [docs/CONFIG.zh.md](docs/CONFIG.zh.md) — ASR / OCR / 缓存配置
- [docs/WATCH.zh.md](docs/WATCH.zh.md) — 陪看模式
- [docs/INSTALL.zh.md](docs/INSTALL.zh.md) — 安装与 ffmpeg 获取

## 许可

MIT。源自 [SAOS-3624/dsh-video-storyboard](https://github.com/SAOS-3624/dsh-video-storyboard)；
版权、第三方说明见 [LICENSE](LICENSE)、[CREDITS.md](CREDITS.md)、[NOTICE](NOTICE)。
