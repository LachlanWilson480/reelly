import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { getVideoDuration } from './get-duration';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

export type OverlayInput = {
  url: string;
  kind: 'image' | 'video';
  x: number; // centre, 0 to 1 across the frame
  y: number; // centre, 0 to 1 down the frame
  size: number; // width as a share of the frame, 0.05 to 1
  start: number; // seconds
  end: number | null; // seconds, null = to the end
};

function download(url: string, dest: string, hops = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) {
        res.resume();
        download(res.headers.location, dest, hops + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Overlay download failed: ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    }).on('error', reject);
  });
}

// Lays an image or a (silent, looping) video over the finished video for the chosen seconds.
export async function applyOverlay(
  inputPath: string,
  overlay: OverlayInput,
  outputWidth: number,
  outputHeight: number,
): Promise<{ outputPath: string; cleanup: () => void }> {
  const outputPath = path.join(path.resolve('renders'), `${randomUUID()}-overlay.mp4`);
  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };

  const urlPath = (() => { try { return new URL(overlay.url).pathname; } catch { return ''; } })();
  const ext = (path.extname(urlPath) || (overlay.kind === 'video' ? '.mp4' : '.png')).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6) || (overlay.kind === 'video' ? '.mp4' : '.png');
  const assetPath = path.join(path.resolve('tmp'), `${randomUUID()}-overlay${ext}`);
  fs.mkdirSync(path.resolve('tmp'), { recursive: true });

  try {
    await download(overlay.url, assetPath);
    const duration = await getVideoDuration(inputPath);
    const width = Math.max(16, Math.round((outputWidth * overlay.size) / 2) * 2);
    const start = Math.max(0, overlay.start);
    const end = overlay.end === null ? duration + 1 : Math.max(start, overlay.end);
    const is4K = Math.max(outputWidth, outputHeight) >= 3840;
    const source = overlay.kind === 'video' ? ['-stream_loop', '-1', '-i', assetPath] : ['-loop', '1', '-i', assetPath];
    const filter =
      `[1:v]format=rgba,scale=${width}:-2,setpts=PTS-STARTPTS+${start.toFixed(3)}/TB[ov];` +
      `[0:v][ov]overlay=x='${outputWidth}*${overlay.x.toFixed(4)}-w/2':y='${outputHeight}*${overlay.y.toFixed(4)}-h/2':enable='between(t,${start.toFixed(3)},${end.toFixed(3)})':eof_action=pass:format=auto[v]`;
    await execFileAsync(FFMPEG_PATH, [
      '-y', '-i', inputPath, ...source,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '0:a?',
      '-c:v', 'libx264', '-preset', is4K ? 'veryfast' : 'fast', '-crf', is4K ? '22' : '18',
      ...(is4K ? ['-maxrate', '16M', '-bufsize', '32M'] : []),
      '-c:a', 'copy', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-t', duration.toFixed(3),
      outputPath,
    ]);
    return { outputPath, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  } finally {
    try { fs.unlinkSync(assetPath); } catch {}
  }
}
