import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

type ClipInput = {
  localPath: string;
  trimStart?: number;
  trimLength?: number;
  volume?: number;
  speed?: number;
  fit?: string;
  letterbox?: boolean;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  filter?: string;
};

function buildVideoFilter(clip: ClipInput, outputWidth: number, outputHeight: number): string {
  const filters: string[] = [];

  // Rotation/flip
  if (clip.flipH && clip.flipV) filters.push('hflip,vflip');
  else if (clip.flipH) filters.push('hflip');
  else if (clip.flipV) filters.push('vflip');
  if (clip.rotate) filters.push(`rotate=${clip.rotate}*PI/180`);

  // Color filter
  if (clip.filter && clip.filter !== 'none') {
    if (clip.filter === 'greyscale') filters.push('hue=s=0');
    else if (clip.filter === 'sepia') filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    else if (clip.filter === 'invert') filters.push('negate');
  }

  // Scale to output size
  if (clip.letterbox) {
    filters.push(`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease`);
    filters.push(`pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black`);
  } else {
    filters.push(`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase`);
    filters.push(`crop=${outputWidth}:${outputHeight}`);
  }

  filters.push('setpts=PTS-STARTPTS');
  filters.push(`fps=30`);

  return filters.join(',');
}

export async function stitchClips(
  clips: ClipInput[],
  musicUrl: string | undefined,
  outputWidth: number,
  outputHeight: number,
  port: number | string
): Promise<{ httpUrl: string; cleanup: () => void }> {
  const cleanups: (() => void)[] = [];
  const processedPaths: string[] = [];

  // Step 1: process each clip individually (trim, speed, scale, filters)
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const outPath = path.join(tmpDir, `${randomUUID()}-clip${i}.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(outPath); } catch {} });

    const vf = buildVideoFilter(clip, outputWidth, outputHeight);
    const trimStart = clip.trimStart ?? 0;
    const speed = clip.speed ?? 1;
    const volume = clip.volume ?? 1;

    const args: string[] = ['-y'];

    if (trimStart > 0) args.push('-ss', String(trimStart));
    if (clip.trimLength) args.push('-t', String(clip.trimLength));

    args.push('-i', clip.localPath);
    args.push('-vf', vf);

    const audioFilters: string[] = [];
    if (speed !== 1) audioFilters.push(`atempo=${Math.min(Math.max(speed, 0.5), 2.0)}`);
    if (volume !== 1) audioFilters.push(`volume=${volume}`);
    if (audioFilters.length > 0) args.push('-af', audioFilters.join(','));

    if (speed !== 1) args.push('-filter:v', `setpts=${1/speed}*PTS`);

    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
    args.push('-c:a', 'aac');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-movflags', '+faststart');
    args.push(outPath);

    console.info(`Processing clip ${i + 1}/${clips.length}`);
    await execFileAsync(FFMPEG_PATH, args);
    processedPaths.push(outPath);
  }

  // Step 2: write concat list file
  const concatListPath = path.join(tmpDir, `${randomUUID()}-list.txt`);
  const concatContent = processedPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);
  cleanups.push(() => { try { fs.unlinkSync(concatListPath); } catch {} });

  // Step 3: concatenate all processed clips
  const stitchedPath = path.join(tmpDir, `${randomUUID()}-stitched.mp4`);
  cleanups.push(() => { try { fs.unlinkSync(stitchedPath); } catch {} });

  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    stitchedPath,
  ]);

  // Step 4: mix in music if provided
  let finalPath = stitchedPath;
  if (musicUrl) {
    const mixedPath = path.join(tmpDir, `${randomUUID()}-mixed.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(mixedPath); } catch {} });

    await execFileAsync(FFMPEG_PATH, [
      '-y',
      '-i', stitchedPath,
      '-i', musicUrl,
      '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.6[aout]',
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      mixedPath,
    ]);

    finalPath = mixedPath;
  }

  // Step 5: copy final output to renders dir (served directly, not via tmp)
  const outputFileName = `${randomUUID()}-final.mp4`;
  const outputPath = path.join(path.resolve('renders'), outputFileName);
  fs.copyFileSync(finalPath, outputPath);

  // Clean up all tmp files
  cleanups.forEach(fn => fn());

  const httpUrl = `http://localhost:${port}/renders/${outputFileName}`;
  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };

  return { httpUrl, cleanup };
}

// Cleanup old renders (older than 24h) to prevent disk filling up
export function cleanOldRenders(rendersDir: string) {
  const files = fs.readdirSync(rendersDir);
  const now = Date.now();
  for (const file of files) {
    const filePath = path.join(rendersDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
      fs.unlinkSync(filePath);
      console.info(`Cleaned old render: ${file}`);
    }
  }
}
