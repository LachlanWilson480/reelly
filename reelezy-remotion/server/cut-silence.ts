import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

type Segment = { start: number; end: number };

const PADDING = 0.3; // seconds to keep around each silent segment

async function detectSilence(inputPath: string): Promise<Segment[]> {
  const { stderr } = await execFileAsync(FFMPEG_PATH, [
    '-i', inputPath,
    '-af', 'silencedetect=noise=-35dB:d=0.4',
    '-f', 'null',
    '-',
  ]).catch((e) => ({ stderr: e.stderr as string }));

  const silentSegments: Segment[] = [];
  const startRe = /silence_start:\s*([\d.]+)/g;
  const endRe = /silence_end:\s*([\d.]+)/g;

  const starts: number[] = [];
  const ends: number[] = [];

  let m;
  while ((m = startRe.exec(stderr)) !== null) starts.push(parseFloat(m[1]));
  while ((m = endRe.exec(stderr)) !== null) ends.push(parseFloat(m[1]));

  for (let i = 0; i < starts.length; i++) {
    silentSegments.push({ start: starts[i], end: ends[i] ?? 999999 });
  }

  return silentSegments;
}

function invertSegments(silentSegments: Segment[], totalDuration: number): Segment[] {
  // Convert silent segments into the segments we KEEP, with padding
  const keepSegments: Segment[] = [];
  let cursor = 0;

  for (const seg of silentSegments) {
    // Keep audio up to PADDING seconds into the silence
    const keepUntil = Math.min(seg.start + PADDING, seg.end);
    if (keepUntil > cursor + 0.05) {
      keepSegments.push({ start: cursor, end: keepUntil });
    }
    // Resume PADDING seconds before the silence ends
    cursor = Math.max(seg.end - PADDING, keepUntil);
  }

  if (cursor < totalDuration - 0.05) {
    keepSegments.push({ start: cursor, end: totalDuration });
  }

  return keepSegments;
}

async function getDuration(inputPath: string): Promise<number> {
  const { stderr } = await execFileAsync(FFMPEG_PATH, [
    '-i', inputPath,
    '-f', 'null', '-',
  ]).catch((e) => ({ stderr: e.stderr as string }));

  const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  if (!m) return 30;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
}

async function extractSegments(inputPath: string, segments: Segment[], outputPath: string): Promise<void> {
  if (segments.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  const vSelects = segments.map(s => `between(t,${s.start},${s.end})`).join('+');
  const aSelects = segments.map(s => `between(t,${s.start},${s.end})`).join('+');

  await execFileAsync(FFMPEG_PATH, [
    '-i', inputPath,
    '-vf', `select='${vSelects}',setpts=N/FRAME_RATE/TB`,
    '-af', `aselect='${aSelects}',asetpts=N/SR/TB`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export async function cutSilence(inputPath: string): Promise<{ outputPath: string; cleanup: () => void }> {
  const outputPath = path.join(tmpDir, `${randomUUID()}-cut.mp4`);

  console.info(`Detecting silence in: ${path.basename(inputPath)}`);
  const duration = await getDuration(inputPath);
  const silentSegments = await detectSilence(inputPath);
  const keepSegments = invertSegments(silentSegments, duration);

  console.info(`Duration: ${duration.toFixed(1)}s, keeping ${keepSegments.length} segments (removing ${silentSegments.length} silent segments)`);

  await extractSegments(inputPath, keepSegments, outputPath);

  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  return { outputPath, cleanup };
}
