import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

export type CustomCaption = { text: string; start: number; end: number; x: number; y: number };
export type CustomCaptionStyle = { fontFamily?: string; size?: number; color?: string; borderColor?: string; backgroundColor?: string };

const FONT_DIR = '/usr/share/fonts/truetype/liberation';
const FONTS: Record<string, string> = {
  'Sans': 'LiberationSans-Regular.ttf',
  'Sans Bold': 'LiberationSans-Bold.ttf',
  'Serif': 'LiberationSerif-Regular.ttf',
  'Serif Bold': 'LiberationSerif-Bold.ttf',
  'Mono': 'LiberationMono-Regular.ttf',
  'Mono Bold': 'LiberationMono-Bold.ttf',
  'Narrow': 'LiberationSansNarrow-Regular.ttf',
  'Narrow Bold': 'LiberationSansNarrow-Bold.ttf',
};

// Draws the captions the user placed on the timeline. Each one shows between its start and end time,
// centred on its x and y spot (a share of the frame), over everything else already in the video.
export async function burnCustomCaptions(
  inputPath: string,
  items: CustomCaption[],
  style: CustomCaptionStyle,
  outputWidth: number,
  outputHeight: number,
): Promise<{ outputPath: string; cleanup: () => void }> {
  const outputPath = path.join(path.resolve('renders'), `${randomUUID()}-custom-captions.mp4`);
  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  if (items.length === 0) { fs.copyFileSync(inputPath, outputPath); return { outputPath, cleanup }; }

  // Sizes are designed for a 1080 wide video, so scale them with the output size
  const sizeScale = Math.max(0.5, Math.min(outputWidth, outputHeight) / 1080);
  const baseSize = Math.min(200, Math.max(16, style.size || 60));
  const fontSize = Math.max(18, Math.round(baseSize * sizeScale));
  const borderW = Math.max(1, Math.round(baseSize * 0.07 * sizeScale));
  const fontColor = /^#[0-9a-fA-F]{6}$/.test(style.color || '') ? style.color! : '#FFFFFF';
  const borderColor = /^#[0-9a-fA-F]{6}$/.test(style.borderColor || '') ? style.borderColor! : '#000000';
  const boxPart = /^#[0-9a-fA-F]{6}$/.test(style.backgroundColor || '') ? `:box=1:boxcolor=0x${style.backgroundColor!.slice(1)}@0.85:boxborderw=${Math.round(baseSize * 0.22 * sizeScale)}` : '';
  const fontFile = path.join(FONT_DIR, FONTS[style.fontFamily || ''] || FONTS['Sans Bold']);
  const fontPart = fs.existsSync(fontFile) ? `:fontfile='${fontFile}'` : '';

  const maxChars = Math.max(8, Math.floor((outputWidth * 0.86) / (fontSize * 0.6)));
  const wrap = (text: string) => {
    const lines: string[] = [];
    let cur = '';
    for (const w of text.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 6);
  };
  const esc = (t: string) => t
    .replace(/\\/g, '')
    .replace(/'/g, '’')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const lineH = Math.round(fontSize * 1.2);

  const filters = items.flatMap((c) => {
    const lines = wrap(c.text);
    const x = clamp01(c.x).toFixed(4);
    const y = clamp01(c.y).toFixed(4);
    const enable = `between(t,${Math.max(0, c.start).toFixed(3)},${Math.max(c.start, c.end).toFixed(3)})`;
    return lines.map((line, li) => {
      const offset = Math.round((li - (lines.length - 1) / 2) * lineH);
      return `drawtext=expansion=none:text='${esc(line)}':enable='${enable}':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${borderW}:bordercolor=${borderColor}:x='max(12,min(w-text_w-12,w*${x}-text_w/2))':y='max(12,min(h-text_h-12,h*${y}+(${offset})-text_h/2))'${boxPart}${fontPart}`;
    });
  });

  // Batches of 50 keep the command short enough for the operating system
  const is4K = Math.max(outputWidth, outputHeight) >= 3840;
  const BATCH = 50;
  let current = inputPath;
  const temps: string[] = [];
  for (let i = 0; i < filters.length; i += BATCH) {
    const last = i + BATCH >= filters.length;
    const out = last ? outputPath : path.join(path.resolve('renders'), `${randomUUID()}-custom-batch.mp4`);
    if (!last) temps.push(out);
    await execFileAsync(FFMPEG_PATH, [
      '-y', '-i', current,
      '-vf', filters.slice(i, i + BATCH).join(','),
      '-c:v', 'libx264', '-preset', is4K ? 'veryfast' : 'fast', '-crf', is4K ? '22' : '18',
      ...(is4K ? ['-maxrate', '16M', '-bufsize', '32M'] : []),
      '-c:a', 'copy', '-movflags', '+faststart',
      out,
    ]);
    if (current !== inputPath) { try { fs.unlinkSync(current); } catch {} }
    current = out;
  }
  for (const t of temps) { try { fs.unlinkSync(t); } catch {} }
  return { outputPath, cleanup };
}
