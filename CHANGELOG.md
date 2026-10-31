# Changelog

## [0.7.0] — 2026-10-31

首个版本。包含：

- `video_storyboard`：按镜头切分的宫格图 + 带时间码的文本清单；格号烧进画面，可被引用；
  支持时间窗、格数/图数、`cellRange` 分页、`textOnly` 续读、链接与本地文件。
- `video_probe`：只读容器头（时长、分辨率、帧率、音轨/字幕、缓存状态），不花图片 token。
- `video_zoom`：对某一段时间近距离重看（格少、每格大），支持 `cellId` 直接引用上一张分镜的格。
- `video_locate`：纯文本按台词定位时间码，不读帧、不出图。
- `video_watch`：按播放进度一段段陪看（浏览器 CDP / 系统媒体会话读位置）。
- 命令行：`bin/storyboard.mjs`（含长片按窗口批处理）、`bin/scan-video.mjs`、`bin/asr-check.mjs`。
- `scripts/smoke.mjs`：用假的 `defineTool` 跑一遍 `apply()`，校验注册的五个工具名。
- `scripts/install-dev.mjs`：包名从 `package.json` 读取，用 junction 挂进 profile；
  卸载时不会跟着链接删源码。
