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
  // The 'appearance' look: skin smoothing and low light lift (0 to 100 each) and a colour look
  appearance?: { touchUp?: number; light?: number; look?: string };
  transition?: string; // transition INTO this clip from previous
  // The part of the picture to keep, as shares of the width and height (0 to 1). The kept part is fitted
  // inside the frame without stretching.
  crop?: { x: number; y: number; w: number; h: number };
  // Where the clip sits in the frame after being moved or zoomed on the preview: x and y move its middle by that
  // share of the frame's width and height, s zooms it (1 is the whole picture fitted inside the frame).
  place?: { x: number; y: number; s: number };
};

// A position the person set by dragging or zooming the clip. Kept within sensible limits.
export function cleanPlace(p: unknown): { x: number; y: number; s: number } | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const o = p as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const x = Math.min(1, Math.max(-1, n(o.x, 0))), y = Math.min(1, Math.max(-1, n(o.y, 0))), s = Math.min(5, Math.max(0.2, n(o.s, 1)));
  if (Math.abs(x) < 0.002 && Math.abs(y) < 0.002 && Math.abs(s - 1) < 0.002) return undefined;
  return { x, y, s };
}

// The size a video shows at (phones often store it sideways with a note to turn it)
export async function getDisplaySize(filePath: string): Promise<{ w: number; h: number } | null> {
  try {
    const FFPROBE = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');
    const { stdout } = await execFileAsync(FFPROBE, ['-v', 'quiet', '-print_format', 'json', '-select_streams', 'v:0', '-show_streams', filePath]);
    const st = JSON.parse(stdout).streams?.[0];
    if (!st?.width || !st?.height) return null;
    const rot = Math.abs(Number(st.tags?.rotate ?? st.side_data_list?.find((d: { rotation?: number }) => d.rotation !== undefined)?.rotation ?? 0)) % 180;
    return rot === 90 ? { w: st.height, h: st.width } : { w: st.width, h: st.height };
  } catch {
    return null;
  }
}

// Scale, cut and pad a clip so it sits where the person put it: the frame shows exactly what the preview showed,
// with black wherever the clip does not reach. Worked out in pixels, so the clip can hang off the edges.
export function placeFilters(src: { w: number; h: number }, crop: { x: number; y: number; w: number; h: number } | undefined, place: { x: number; y: number; s: number }, W: number, H: number): string[] {
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  const cw = src.w * (crop?.w ?? 1), ch = src.h * (crop?.h ?? 1);
  const fit = Math.min(W / cw, H / ch) * place.s;
  const vw = even(cw * fit), vh = even(ch * fit);
  const X = Math.round(W / 2 + place.x * W - vw / 2), Y = Math.round(H / 2 + place.y * H - vh / 2);
  const x0 = Math.max(0, -X), y0 = Math.max(0, -Y);
  const w = Math.min(vw, W - X) - x0, h = Math.min(vh, H - Y) - y0;
  if (w < 2 || h < 2) {
    // Moved right off the frame: all black
    return ['scale=2:2', `pad=${W}:${H}:0:0:black`, 'drawbox=x=0:y=0:w=2:h=2:color=black:t=fill'];
  }
  const cwE = Math.floor(w / 2) * 2, chE = Math.floor(h / 2) * 2;
  return [`scale=${vw}:${vh}`, `crop=${cwE}:${chE}:${x0}:${y0}`, `pad=${W}:${H}:${Math.max(0, X)}:${Math.max(0, Y)}:black`];
}

// A crop box the person drew, kept inside the picture. A box that keeps everything counts as no crop.
export function cleanCrop(c: unknown): { x: number; y: number; w: number; h: number } | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const o = c as Record<string, unknown>;
  let x = n(o.x), y = n(o.y), w = n(o.w), h = n(o.h);
  if ([x, y, w, h].some(Number.isNaN)) return undefined;
  x = Math.min(0.95, Math.max(0, x)); y = Math.min(0.95, Math.max(0, y));
  w = Math.min(1 - x, Math.max(0.05, w)); h = Math.min(1 - y, Math.max(0.05, h));
  if (x < 0.002 && y < 0.002 && w > 0.996 && h > 0.996) return undefined;
  return { x, y, w, h };
}

function buildVideoFilter(clip: ClipInput, outputWidth: number, outputHeight: number, size?: { w: number; h: number } | null): string {
  const filters: string[] = [];
  const crop = cleanCrop(clip.crop);
  // Cropping comes first, on the picture as it was filmed, so it matches what the preview showed
  if (crop) filters.push(`crop=trunc(iw*${crop.w.toFixed(4)}/2)*2:trunc(ih*${crop.h.toFixed(4)}/2)*2:trunc(iw*${crop.x.toFixed(4)}):trunc(ih*${crop.y.toFixed(4)})`);

  if (clip.flipH && clip.flipV) filters.push('hflip,vflip');
  else if (clip.flipH) filters.push('hflip');
  else if (clip.flipV) filters.push('vflip');
  if (clip.rotate) filters.push(`rotate=${clip.rotate}*PI/180`);

  if (clip.filter && clip.filter !== 'none') {
    if (clip.filter === 'greyscale') filters.push('hue=s=0');
    else if (clip.filter === 'sepia') filters.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
    else if (clip.filter === 'invert') filters.push('negate');
  }

  const place = cleanPlace(clip.place);
  if (place && size && !clip.rotate) {
    filters.push(...placeFilters(size, crop, place, outputWidth, outputHeight));
  } else if (crop) {
    // The kept part fills as much of the frame as it can without stretching, with black around it if needed
    filters.push(`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`);
    filters.push(`pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black`);
  } else if (clip.letterbox) {
    // Landscape clip: fit inside portrait frame with black bars
    filters.push(`scale='if(gt(iw,${outputWidth}),${outputWidth},iw)':'if(gt(ih,${outputHeight}),${outputHeight},ih)':force_original_aspect_ratio=decrease`);
    filters.push(`pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black`);
  } else {
    // Portrait clip: fitted inside the frame, the same as the preview shows it. A clip taller than the frame
    // (a screen recording, say) gets black bars at the sides instead of failing the render.
    filters.push(`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`);
    filters.push(`pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black`);
  }

  // Appearance: look first, then the low light lift, then the smoothing last so it works on the finished colours.
  // These run after the clip is scaled to the output size, so a 4K source does not make them slow.
  const apFilters: string[] = [];
  const ap = clip.appearance;
  if (ap) {
    const looks: Record<string, string> = {
      warm: 'colorchannelmixer=rr=1.07:gg=1.01:bb=0.92,eq=saturation=1.08',
      cool: 'colorchannelmixer=rr=0.93:gg=1.0:bb=1.08,eq=saturation=1.04',
      vivid: 'eq=saturation=1.35:contrast=1.08',
      soft: 'eq=contrast=0.92:saturation=0.92:brightness=0.02',
      bw: 'hue=s=0,eq=contrast=1.1',
    };
    if (ap.look && looks[ap.look]) apFilters.push(looks[ap.look]);
    const light = Math.min(100, Math.max(0, Number(ap.light) || 0)) / 100;
    if (light > 0) apFilters.push(`eq=brightness=${(0.1 * light).toFixed(3)}:gamma=${(1 + 0.35 * light).toFixed(3)}:contrast=${(1 + 0.06 * light).toFixed(3)}`);
    const touch = Math.min(100, Math.max(0, Number(ap.touchUp) || 0)) / 100;
    // smartblur only softens flat areas like skin and leaves edges (eyes, hair, lips) sharp
    if (touch > 0) apFilters.push(`smartblur=lr=${(1 + 2.5 * touch).toFixed(2)}:ls=${(0.3 + 0.7 * touch).toFixed(2)}:lt=${Math.round(8 + 22 * touch)}`);
  }
  filters.push(...apFilters);

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
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);
}

export function musicPlacement(start: number | undefined): string {
  const s = typeof start === 'number' && Number.isFinite(start) ? start : 0;
  if (s > 0.01) { const ms = Math.round(s * 1000); return `adelay=${ms}|${ms},`; }
  if (s < -0.01) return `atrim=start=${(-s).toFixed(3)},asetpts=PTS-STARTPTS,`;
  return '';
}

export async function stitchClips(
  clips: ClipInput[],
  musicUrl: string | undefined,
  outputWidth: number,
  outputHeight: number,
  port: number | string,
  crf: number = 28,
  voiceover?: { takes?: { url: string; start: number; duration: number; volume?: number }[]; originalVolume?: number; musicVolume?: number; musicStart?: number }
): Promise<{ httpUrl: string; cleanup: () => void; clipSpans: { start: number; end: number }[] }> {
  // Where the music sits: pushed later into the video, or with the start of the song skipped
  const musicPlace = musicPlacement(voiceover?.musicStart);
  const cleanups: (() => void)[] = [];
  const processedPaths: string[] = [];

  // Step 1: process each clip (scale, filters, trim)
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const outPath = path.join(tmpDir, `${randomUUID()}-clip${i}.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(outPath); } catch {} });

    // A clip moved or zoomed on the preview needs its real size to be placed exactly
    const size = cleanPlace(clip.place) ? await getDisplaySize(clip.localPath) : null;
    const vf = buildVideoFilter(clip, outputWidth, outputHeight, size);
    const trimStart = clip.trimStart ?? 0;
    const speed = Math.min(8, Math.max(0.25, clip.speed ?? 1));
    const volume = clip.volume ?? 1;

    // A clip with no sound (a photo, or a phone recording whose sound failed) gets silence, so joining the clips
    // never drops the sound of the clips after it
    const withSound = await hasAudio(clip.localPath);
    const args: string[] = ['-y'];
    if (trimStart > 0) args.push('-ss', String(trimStart));
    if (clip.trimLength) args.push('-t', String(clip.trimLength));
    args.push('-i', clip.localPath);
    if (!withSound) args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v:0', '-map', '1:a:0', '-shortest');
    args.push('-vf', speed !== 1 ? `${vf},setpts=PTS/${speed}` : vf);

    const audioFilters: string[] = [];
    if (speed !== 1) {
      // atempo only accepts 0.5 to 2, so chain it. Sound at extreme speeds is silent, as it would only be noise.
      let rest = speed;
      while (rest > 2) { audioFilters.push('atempo=2'); rest /= 2; }
      while (rest < 0.5) { audioFilters.push('atempo=0.5'); rest *= 2; }
      audioFilters.push(`atempo=${rest.toFixed(4)}`);
      if (speed > 2 || speed < 0.5) audioFilters.push('volume=0');
    }
    if (volume !== 1) audioFilters.push(`volume=${volume}`);
    if (audioFilters.length > 0) args.push('-af', audioFilters.join(','));

    // 4K is much heavier: encode a little faster and cap the bitrate so the file stays a size we can upload
    const is4K = Math.max(outputWidth, outputHeight) >= 3840;
    args.push('-c:v', 'libx264', '-preset', is4K ? 'veryfast' : 'fast', '-crf', String(crf), '-pix_fmt', 'yuv420p');
    if (is4K) args.push('-maxrate', '16M', '-bufsize', '32M');
    args.push('-c:a', 'aac', '-ar', '48000', '-ac', '2');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-movflags', '+faststart');
    args.push(outPath);

    console.info(`Processing clip ${i + 1}/${clips.length}`);
    await execFileAsync(FFMPEG_PATH, args);
    processedPaths.push(outPath);
  }

  // Where each clip sits in the joined video (captions use this to keep each clip's words with that clip)
  const clipSpans: { start: number; end: number }[] = [];
  {
    let at = 0;
    for (const pth of processedPaths) {
      const d = await mediaDuration(pth);
      clipSpans.push({ start: at, end: at + d });
      at += d;
    }
  }

  // Step 2: check if any transitions are needed
  const hasTransitions = clips.slice(1).some(c => c.transition && c.transition !== 'none');

  let stitchedPath: string;

  if (!hasTransitions) {
    // Simple concat - fast path
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

  // Step 3: mix voiceover and/or music if provided
  let finalPath = stitchedPath;
  if (voiceover?.takes && voiceover.takes.length > 0) {
    const takes = voiceover.takes;
    const mixedPath = path.join(tmpDir, `${randomUUID()}-voiceover.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(mixedPath); } catch {} });

    const args = ['-y', '-i', stitchedPath];
    let next = 1;
    let musicIdx = -1;
    if (musicUrl) { args.push('-i', musicUrl); musicIdx = next++; }
    const takeIdx: number[] = [];
    for (const t of takes) { args.push('-i', t.url); takeIdx.push(next++); }

    // Original clip sound sits low under the voiceover (or is removed completely if the user chose that),
    // music sits lower again, the voiceover stays at full volume.
    const parts: string[] = [`[0:a]volume=${Math.min(1, Math.max(0, voiceover.originalVolume ?? 0.35)).toFixed(2)}[orig]`];
    const labels = ['[orig]'];
    if (musicIdx > 0) { parts.push(`[${musicIdx}:a]${musicPlace}volume=${Math.min(1, Math.max(0, voiceover.musicVolume ?? 0.3)).toFixed(2)}[mus]`); labels.push('[mus]'); }

    // Each take is placed where the user recorded it. A take recorded later replaces an
    // earlier one wherever they overlap, so the earlier take is silenced for that stretch.
    const endOf = (t: { start: number; duration: number }) => (t.duration > 0 ? t.start + t.duration : Infinity);
    takes.forEach((t, i) => {
      const ms = Math.max(0, Math.round(t.start * 1000));
      const silenced: string[] = [];
      for (const later of takes.slice(i + 1)) {
        const a = Math.max(t.start, later.start);
        const b = Math.min(endOf(t), endOf(later));
        if (b > a) silenced.push(`volume=0:enable='between(t,${a.toFixed(3)},${Number.isFinite(b) ? b.toFixed(3) : '1000000'})'`);
      }
      // apad keeps every take running to the end so amix does not change the levels when one finishes
      const gain = Math.min(1, Math.max(0, t.volume ?? 1)).toFixed(2);
      parts.push(`[${takeIdx[i]}:a]adelay=${ms}|${ms},volume=${gain},${silenced.length ? silenced.join(',') + ',' : ''}apad[vo${i}]`);
      labels.push(`[vo${i}]`);
    });
    // amix divides each input by the input count, so multiply back up and guard against clipping
    parts.push(`${labels.join('')}amix=inputs=${labels.length}:duration=first:dropout_transition=0,volume=${labels.length},alimiter=limit=0.95[aout]`);

    args.push(
      '-filter_complex', parts.join(';'),
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      mixedPath,
    );
    await execFileAsync(FFMPEG_PATH, args);
    finalPath = mixedPath;
  } else if (musicUrl) {
    const mixedPath = path.join(tmpDir, `${randomUUID()}-mixed.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(mixedPath); } catch {} });

    await execFileAsync(FFMPEG_PATH, [
      '-y',
      '-i', stitchedPath,
      '-i', musicUrl,
      '-filter_complex', `[0:a]volume=${Math.min(1, Math.max(0, voiceover?.originalVolume ?? 1)).toFixed(2)}[a0];[1:a]${musicPlace}volume=${Math.min(1, Math.max(0, voiceover?.musicVolume ?? 0.35)).toFixed(2)}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95[aout]`,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      mixedPath,
    ]);

    finalPath = mixedPath;
  } else if (typeof voiceover?.originalVolume === 'number' && voiceover.originalVolume < 0.999) {
    // No voiceover and no music: the Master volume still applies (Off removes the clips' sound completely)
    const mixedPath = path.join(tmpDir, `${randomUUID()}-level.mp4`);
    cleanups.push(() => { try { fs.unlinkSync(mixedPath); } catch {} });
    await execFileAsync(FFMPEG_PATH, [
      '-y',
      '-i', stitchedPath,
      '-af', `volume=${Math.min(1, Math.max(0, voiceover.originalVolume)).toFixed(2)}`,
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

  return { httpUrl, cleanup, clipSpans };
}

// Whether a file has a sound track
async function hasAudio(filePath: string): Promise<boolean> {
  try {
    const FFPROBE = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');
    const { stdout } = await execFileAsync(FFPROBE, ['-v', 'quiet', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath]);
    return String(stdout).trim().length > 0;
  } catch {
    return true;
  }
}

// How long a file plays, in seconds
async function mediaDuration(filePath: string): Promise<number> {
  try {
    const FFPROBE = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');
    const { stdout } = await execFileAsync(FFPROBE, ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath]);
    const d = parseFloat(String(stdout).trim());
    return Number.isFinite(d) ? d : 0;
  } catch {
    return 0;
  }
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
