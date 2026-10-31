#!/usr/bin/env node
/**
 * fetch-ffmpeg.mjs — 把一份固定的 ffmpeg/ffprobe 放进 `vendor/ffmpeg/bin`。
 *
 * 为什么要有这个脚本：插件想"装完即用"，就不能要求用户先 winget/pip 装 ffmpeg。
 * 但把 190 MB 的二进制提交进 git 也不合适，所以二进制是**按需落盘**的：
 *
 *   node scripts/fetch-ffmpeg.mjs            # 没有才下载（幂等）
 *   node scripts/fetch-ffmpeg.mjs --force    # 重新下载
 *   node scripts/fetch-ffmpeg.mjs --zip D:/ffmpeg.zip   # 离线：用本地 zip
 *
 * 版本是**钉死的**（tag + 文件名 + sha256），不是 "latest"：滚动 tag 的同一个 URL
 * 今天和下周不是同一份字节，靠它校验等于没校验。
 *
 * 用的是 BtbN 的 **LGPL** 静态构建（不含 GPL 组件，可随 MIT 插件一起分发，
 * 条件见 vendor/ffmpeg/LICENSE.txt）。如果你在意 GPL 的 x264 等编码器，这份没有；
 * 本插件只做解码 + 滤镜，用不到编码器。
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** 钉死的那一份。改这里 = 换版本，必须同时改 sha256。 */
export const PINNED = Object.freeze({
  release: 'autobuild-2026-10-30-13-01',
  asset: 'ffmpeg-n8.1.3-27-g8dca1586f4-win64-lgpl-8.1.zip',
  sha256: 'bf346925ea085c262d15a5ceacd521ccbde52f4e3fc6a97f1bf273685fc1a539',
  bytes: 167_700_000,
  url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-30-13-01/'
    + 'ffmpeg-n8.1.3-27-g8dca1586f4-win64-lgpl-8.1.zip',
  license: 'LGPL-2.1-or-later (static build by BtbN/FFmpeg-Builds)',
});

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VENDOR_BIN = join(ROOT, 'vendor', 'ffmpeg', 'bin');
const WANTED = process.platform === 'win32' ? ['ffmpeg.exe', 'ffprobe.exe'] : ['ffmpeg', 'ffprobe'];

function log(msg) { process.stdout.write(`[fetch-ffmpeg] ${msg}\n`); }

function sha256File(path) {
  const hash = createHash('sha256');
  return new Promise((resolve, reject) => {
    import('node:fs').then(({ createReadStream }) => {
      createReadStream(path).on('data', (c) => hash.update(c))
        .on('end', () => resolve(hash.digest('hex')))
        .on('error', reject);
    }, reject);
  });
}

async function download(url, dest) {
  log(`downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'dsh-video-storyboard' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get('content-length') || 0);
  let seen = 0;
  let last = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (c) => {
    seen += c.length;
    const now = Date.now();
    if (now - last > 5000) {
      last = now;
      const pct = total ? ` (${Math.round((seen / total) * 100)}%)` : '';
      log(`  ${(seen / 1048576).toFixed(1)} MB${pct}`);
    }
  });
  await pipeline(body, createWriteStream(dest));
  return seen;
}

/** 用 bsdtar 解 zip：Windows 10+ 自带 tar.exe，能直接读 zip；再不行退回 PowerShell。 */
function unzip(zip, dest) {
  const tar = spawnSync('tar', ['-xf', zip, '-C', dest], { stdio: 'inherit' });
  if (tar.status === 0) return;
  if (process.platform === 'win32') {
    const ps = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`,
    ], { stdio: 'inherit' });
    if (ps.status === 0) return;
  }
  throw new Error('could not extract the zip (tried tar, then PowerShell Expand-Archive)');
}

async function findIn(dir, wanted, depth = 3) {
  const hits = {};
  const walk = async (cur, level) => {
    if (level > depth) return;
    for (const entry of await readdir(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) await walk(full, level + 1);
      else if (wanted.includes(entry.name) && !hits[entry.name]) hits[entry.name] = full;
    }
  };
  await walk(dir, 0);
  return hits;
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const zipArg = argv.indexOf('--zip');
  const localZip = zipArg >= 0 ? argv[zipArg + 1] : null;

  if (process.platform !== 'win32') {
    log('this vendoring step is Windows-only. On macOS/Linux install ffmpeg with your package manager');
    log('(e.g. `brew install ffmpeg` / `apt install ffmpeg`); the plugin will find it on PATH.');
    process.exitCode = 1;
    return;
  }

  const present = WANTED.every((name) => existsSync(join(VENDOR_BIN, name)));
  if (present && !force) {
    log(`already vendored: ${VENDOR_BIN}`);
    return;
  }

  const work = await mkdtemp(join(tmpdir(), 'dsh-ffmpeg-'));
  const zip = localZip ?? join(work, 'ffmpeg.zip');
  try {
    if (localZip) {
      if (!existsSync(localZip)) throw new Error(`no such file: ${localZip}`);
      log(`using local zip ${localZip}`);
    } else {
      const bytes = await download(PINNED.url, zip);
      log(`downloaded ${(bytes / 1048576).toFixed(1)} MB`);
      const digest = await sha256File(zip);
      if (digest !== PINNED.sha256) {
        throw new Error(`sha256 mismatch: expected ${PINNED.sha256}, got ${digest}. `
          + 'Refusing to vendor an unverified binary.');
      }
      log('sha256 verified');
    }

    const unpack = join(work, 'x');
    await mkdir(unpack, { recursive: true });
    unzip(zip, unpack);
    const found = await findIn(unpack, WANTED);
    const missing = WANTED.filter((n) => !found[n]);
    if (missing.length) throw new Error(`zip did not contain: ${missing.join(', ')}`);

    await mkdir(VENDOR_BIN, { recursive: true });
    for (const name of WANTED) {
      await copyFile(found[name], join(VENDOR_BIN, name));
      log(`installed ${join(VENDOR_BIN, name)}`);
    }

    // 许可证与出处：分发二进制必须带上这两个，否则 LGPL 合规就缺一块。
    const license = await findIn(unpack, ['LICENSE.txt'], 2);
    if (license['LICENSE.txt']) {
      await copyFile(license['LICENSE.txt'], join(ROOT, 'vendor', 'ffmpeg', 'LICENSE.txt'));
      log('copied LICENSE.txt');
    }
    await writeFile(join(ROOT, 'vendor', 'ffmpeg', 'PROVENANCE.json'), JSON.stringify({
      fetchedAt: new Date().toISOString(),
      ...PINNED,
      files: WANTED,
      note: 'Vendored by scripts/fetch-ffmpeg.mjs. Verify with `node scripts/fetch-ffmpeg.mjs --force`.',
    }, null, 2) + '\n');
    log('wrote PROVENANCE.json');

    for (const name of WANTED) {
      const bin = join(VENDOR_BIN, name);
      // 先试"抓输出"；某些受限环境里子进程的管道 stdio 会被拒绝（EPERM），
      // 那就退回继承 stdio，至少让版本号打在屏幕上，而不是报一个空 exit null。
      let r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
      let line = (r.stdout || '').split('\n')[0];
      if (!line) {
        r = spawnSync(bin, ['-version'], { stdio: 'inherit' });
        line = r.status === 0 ? '(ok — version printed above)' : `exit ${r.status ?? r.error?.code ?? 'unknown'}`;
      }
      log(`${name}: ${line}`);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  process.stderr.write(`[fetch-ffmpeg] ${e.message}\n`);
  process.exitCode = 1;
});
