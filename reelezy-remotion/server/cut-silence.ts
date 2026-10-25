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

const PADDING = 0.5; // seconds to keep around each long silent stretch
const MIN_LONG_SILENCE = 1.5; // only silences this long are cut out of the middle of a clip
const EDGE_PAD = 0.3; // seconds kept after the last sound / movement and before the first, so button presses never show

async function detectSilence(inputPath: string, duration: number): Promise<{ segments: Segment[]; hasAudio: boolean }> {
  const { stderr } = await execFileAsync(FFMPEG_PATH, [
    '-i', inputPath,
    '-af', 'silencedetect=noise=-28dB:d=0.3',
    '-f', 'null',
    '-',
  ]).catch((e) => ({ stderr: (e.stderr as string) || '' }));

  const hasAudio = /Stream #\d+:\d+.*Audio:/.test(stderr);
  const starts: number[] = [];
  const ends: number[] = [];
  const startRe = /silence_start:\s*(-?[\d.]+)/g;
  const endRe = /silence_end:\s*([\d.]+)/g;
  let m;
  while ((m = startRe.exec(stderr)) !== null) starts.push(Math.max(0, parseFloat(m[1])));
  while ((m = endRe.exec(stderr)) !== null) ends.push(parseFloat(m[1]));

  const segments: Segment[] = starts.map((st, i) => ({ start: st, end: ends[i] ?? duration }));
  return { segments, hasAudio };
}

// First and last moment anything moves on screen (for clips with no sound)
async function detectMotion(inputPath: string): Promise<{ first: number; last: number } | null> {
  const { stderr } = await execFileAsync(FFMPEG_PATH, [
    '-i', inputPath,
    '-an',
    '-vf', "fps=10,scale=160:-2,select='gt(scene,0.004)',showinfo",
    '-f', 'null',
    '-',
  ], { maxBuffer: 64 * 1024 * 1024 }).catch((e) => ({ stderr: (e.stderr as string) || '' }));
  const times: number[] = [];
  const re = /pts_time:\s*([\d.]+)/g;
  let m;
  while ((m = re.exec(stderr)) !== null) times.push(parseFloat(m[1]));
  if (times.length === 0) return null;
  return { first: times[0], last: times[times.length - 1] };
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

async function extractSegments(inputPath: string, segments: Segment[], outputPath: string, hasAudio = true): Promise<void> {
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
  const { segments: silent, hasAudio } = await detectSilence(inputPath, duration);

  // A clip that is silent from start to finish has no sound to work from
  const noSound = !hasAudio || (silent.length === 1 && silent[0].start < 0.1 && silent[0].end >= duration - 0.1);

  let keepSegments: Segment[];
  let headStart = 0;
  let tailEnd = duration;

  if (!noSound) {
    // Cut the long silences out of the middle, then start/stop 0.3s from the first/last sound
    keepSegments = invertSegments(silent.filter((s) => s.end - s.start >= MIN_LONG_SILENCE), duration);
    const first = silent[0];
    const last = silent[silent.length - 1];
    if (first && first.start < 0.1) headStart = Math.max(0, first.end - EDGE_PAD);
    if (last && last.end >= duration - 0.1) tailEnd = Math.min(duration, last.start + EDGE_PAD);
  } else {
    keepSegments = [{ start: 0, end: duration }];
    const motion = await detectMotion(inputPath);
    if (motion) {
      if (motion.first > 0.4) headStart = Math.max(0, motion.first - EDGE_PAD);
      if (motion.last < duration - 0.4) tailEnd = Math.min(duration, motion.last + EDGE_PAD);
    }
  }

  if (tailEnd - headStart < 0.8) { headStart = 0; tailEnd = duration; }
  keepSegments = keepSegments
    .map((s) => ({ start: Math.max(s.start, headStart), end: Math.min(s.end, tailEnd) }))
    .filter((s) => s.end - s.start > 0.05);
  if (keepSegments.length === 0) keepSegments = [{ start: 0, end: duration }];

  console.info(`Duration: ${duration.toFixed(1)}s, keeping ${keepSegments.length} segments (${noSound ? 'no sound, used movement' : 'used sound'}; from ${headStart.toFixed(1)}s to ${tailEnd.toFixed(1)}s)`);

  await extractSegments(inputPath, keepSegments, outputPath, hasAudio);

  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  return { outputPath, cleanup };
}
