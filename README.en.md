# dsh-video-storyboard

> Give a text-only model a way to actually **look at** a video: one addressable contact sheet
> plus a time-coded text index. The model can cite "cell 5", locate a phrase, and ask for a
> close-up — instead of trusting somebody else's summary.
>
> **ffmpeg / ffprobe are not bundled** (~250 MB). Install them yourself or run the fetch script.

---

## The five tools

| Tool | What it does | When |
|---|---|---|
| `video_probe` | container metadata only: duration, resolution, fps, audio/subtitle tracks, cache state | call first; costs no image tokens |
| `video_storyboard` | contact sheet + text index (main tool) | overview of a film or a window |
| `video_zoom` | re-read a short window, fewer/larger cells | a cell is too small to read |
| `video_locate` | text only: phrase → timestamp | you know what was said, not when |
| `video_watch` | batch-by-batch watch-along at the user's playhead | follow what they are watching |

## Install

```bash
git clone git@github.com:L1818346/dsh-video-storyboard.git
cd dsh-video-storyboard

node scripts/fetch-ffmpeg.mjs     # required: pinned version + sha256 (~160 MB, idempotent)
pip install --user -U yt-dlp      # optional: only for Bilibili/YouTube links
node scripts/install-dev.mjs      # junction into the desktop profile + register the bundle
```

Then **restart DSH Desktop**. `ffprobe not found` on the first call means step 3 did not run.

| Dependency | Required | Notes |
|---|---|---|
| ffmpeg + ffprobe | **yes** | or install system ffmpeg (`winget install Gyan.FFmpeg`) / set `DSH_FFMPEG_PATH` |
| yt-dlp | optional | local files work without it; links do not |
| ASR service | optional | you get pictures, but no transcript |

Resolution order: explicit env vars > `vendor/ffmpeg/bin` > `~/.dsh/tools/ffmpeg` > `PATH`.

## Quick start

```js
video_probe({ input: "D:/videos/lesson.mp4" })                  // how long is it?
video_storyboard({ input: "D:/videos/lesson.mp4" })             // whole film
video_zoom({ input: "D:/videos/lesson.mp4", from: 72, to: 95 }) // close-up on 72–95 s
video_locate({ input: "D:/videos/lesson.mp4", query: "entropy" })
```

Links work directly (needs yt-dlp; cookies for login-gated sources):

```js
video_storyboard({ input: "https://www.bilibili.com/video/BV1xx411c7mD" })
```

`video_watch` needs a browser started with the debug port and signed in; sign in there once.

## Long films

The text index has a budget too. Page through it instead of dumping everything:

```js
video_storyboard({ input, cells: 16, sheets: 4 })                                   // 4 images + page 1
video_storyboard({ input, cells: 16, sheets: 4, cellRange: [14, 42], textOnly: true })
```

CLI batch mode:

```bash
node bin/storyboard.mjs film.mp4 --batch 300 --out film.png
# → film-w01.png ... film-w24.png plus film-timeline.md
```

## Configuration and cache

| What | Where |
|---|---|
| debug browser port | `~/.dsh/browser.json` (legacy `~/.dsh/video.json`), shared with the browser plugin |
| media cache | `%LOCALAPPDATA%\dsh-video-storyboard\cache` (overridable by env) |
| transcript / locate cache | same place, keyed by source file |

## Boundaries

- A storyboard is lossy: the timeline is fully covered, not every shot is shown. Ask `video_zoom`.
- Cell count follows visual motion, not duration; a static shot does not get 16 identical cells.
- No autoplay, no watch-time farming, no homework. `video_watch` only reads the playhead.
- Link resolution depends on sign-in state; without cookies a 1080p tier may not even be listed.

## Docs

- [docs/USAGE.md](docs/USAGE.md) — parameters, workflows, troubleshooting
- [docs/SETUP.md](docs/SETUP.md) — yt-dlp, cookies, five-step verification
- [docs/WATCH.zh.md](docs/WATCH.zh.md) — watch-along mode (Chinese)
- [docs/INSTALL.zh.md](docs/INSTALL.zh.md) — install and ffmpeg acquisition (Chinese)

## License

MIT. Upstream: [SAOS-3624/dsh-video-storyboard](https://github.com/SAOS-3624/dsh-video-storyboard).
See [LICENSE](LICENSE), [CREDITS.md](CREDITS.md), [NOTICE](NOTICE).
