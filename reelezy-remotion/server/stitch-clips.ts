import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const TRANSITION_DURATION = 0.3; // seconds

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
  transition?: string; // transition INTO this clip from previous
};

function buildVideoFilter(clip: ClipInput, outputWidth: number, outputHeight: number): string {
  const filters: string[] = [];

  if (clip.flipH && clip.flipV) filters.push('hflip,vflip');
  else if (clip.flipH) filters.push('hflip');
  else if (clip.flipV) filters.push('vflip');
  if (clip.rotate) filters.push(`rotate=${clip.rotate}*PI/180`);

  if (clip.filter && clip.filter !== 'none') {
    if (clip.filter === 'greyscale') filters.push('hue=s=0');
    else if (clip.filter === 'sepia') filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    else if (clip.filter === 'invert') filters.push('negate');
  }

  if (clip.letterbox) {
    // Landscape clip: blurred background fills portrait frame, clip centred on top
    const preFilters = filters.length > 0 ? filters.join(',') + ',' : '';
    return `${preFilters}split=2[bg][fg];[bg]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},boxblur=20:5[blurred];[fg]scale=${outputWidth}:-2[scaled];[blurred][scaled]overlay=(W-w)/2:(H-h)/2,setpts=PTS-STARTPTS`;
  } else {
    filters.push(`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase`);
    filters.push(`crop=${outputWidth}:${outputHeight}`);
  }

  filters.push('setpts=PTS-STARTPTS');

  return filters.join(',');
}

// Map our transition names to ffmpeg xfade transitions
function getXfadeTransition(transition: string): string {
  switch (transition) {
    case 'fade': return 'fade';
    case 'wipeLeft': return 'wipeleft';
    case 'wipeRight': return 'wiperight';
    case 'slideLeft': return 'slideleft';
    case 'slideRight': return 'slideright';
    case 'zoom': return 'zoomin';
    default: return 'fade'; // fallback
  }
}

async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const FFPROBE = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');
    const { stdout } = await execFileAsync(FFPROBE, [
      '-v', 'quiet', '-print_format', 'json', '-show_format', filePath,
    ]);
    const data = JSON.parse(stdout);
    return parseFloat(data.format?.duration || '5');
  } catch {
    return 5;
  }
}

async function applyTransition(
  clip1Path: string,
  clip2Path: string,
  transitionType: string,
  outputPath: string
): Promise<void> {
  const duration1 = await getVideoDuration(clip1Path);
  const xfade = getXfadeTransition(transitionType);
  const offset = Math.max(0, duration1 - TRANSITION_DURATION);

  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-i', clip1Path,
    '-i', clip2Path,
    '-filter_complex',
    `[0:v][1:v]xfade=transition=${xfade}:duration=${TRANSITION_DURATION}:offset=${offset}[vout];` +
    `[0:a][1:a]acrossfade=d=${TRANSITION_DURATION}[aout]`,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export async function stitchClips(
  clips: ClipInput[],
  musicUrl: string | undefined,
  outputWidth: number,
  outputHeight: number,
  port: number | string,
  crf: number = 18
): Promise<{ httpUrl: string; cleanup: () => void }> {
  const cleanups: (() => void)[] = [];
  const processedPaths: string[] = [];

  // Step 1: process each clip (scale, filters, trim)
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

    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-movflags', '+faststart');
    args.push(outPath);

    console.info(`Processing clip ${i + 1}/${clips.length}`);
    await execFileAsync(FFMPEG_PATH, args);
    processedPaths.push(outPath);
  }

  // Step 2: check if any transitions are needed
  const hasTransitions = clips.slice(1).some(c => c.transition && c.transition !== 'none');

  let stitchedPath: string;

  if (!hasTransitions) {
    // Simple concat — fast path
    const concatListPath = path.join(tmpDir, `${randomUUID()}-list.txt`);
    const concatContent = processedPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);
    cleanups.push(() => { try { fs.unlinkSync(concatListPath); } catch {} });

    stitchedPath = path.join(tmpDir, `${randomUUID()}-stitched.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(stitchedPath); } catch {} });

    await execFileAsync(FFMPEG_PATH, [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', stitchedPath,
    ]);
  } else {
    // Apply transitions between clips one pair at a time
    let currentPath = processedPaths[0];

    for (let i = 1; i < processedPaths.length; i++) {
      const transition = clips[i].transition || 'none';
      const nextPath = processedPaths[i];

      if (transition === 'none') {
        // Concat this clip without transition
        const concatListPath = path.join(tmpDir, `${randomUUID()}-list.txt`);
        fs.writeFileSync(concatListPath, `file '${currentPath}'\nfile '${nextPath}'`);
        cleanups.push(() => { try { fs.unlinkSync(concatListPath); } catch {} });

        const concatPath = path.join(tmpDir, `${randomUUID()}-concat.mp4`);
        cleanups.push(() => { try { fs.unlinkSync(concatPath); } catch {} });

        await execFileAsync(FFMPEG_PATH, [
          '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', concatPath,
        ]);
        currentPath = concatPath;
      } else {
        const transPath = path.join(tmpDir, `${randomUUID()}-trans.mp4`);
        cleanups.push(() => { try { fs.unlinkSync(transPath); } catch {} });

        console.info(`Applying ${transition} transition between clips ${i} and ${i + 1}`);
        await applyTransition(currentPath, nextPath, transition, transPath);
        currentPath = transPath;
      }
    }

    stitchedPath = currentPath;
  }

  // Step 3: mix music if provided
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

  // Step 4: copy to renders dir
  const outputFileName = `${randomUUID()}-final.mp4`;
  const outputPath = path.join(path.resolve('renders'), outputFileName);
  fs.copyFileSync(finalPath, outputPath);

  cleanups.forEach(fn => fn());

  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
  const httpUrl = `${baseUrl}/renders/${outputFileName}`;
  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };

  return { httpUrl, cleanup };
}

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
