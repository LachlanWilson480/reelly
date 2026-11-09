import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolveFontFile, measureText, wrapText, underlineBox } from './text-style';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

export type CustomCaption = { text: string; start: number; end: number; x: number; y: number; w?: number; font?: string; size?: number; color?: string; bg?: string | null; bold?: boolean; italic?: boolean; underline?: boolean };
export type CustomCaptionStyle = { fontFamily?: string; size?: number; color?: string; borderColor?: string; backgroundColor?: string; bold?: boolean; italic?: boolean; underline?: boolean };

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
  const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  // Each caption can override the shared look with its own font, size, colour and background
  const look = (it: CustomCaption) => {
    const baseSize = Math.min(200, Math.max(16, it.size || style.size || 60));
    const fontSize = Math.max(18, Math.round(baseSize * sizeScale));
    const borderW = Math.max(1, Math.round(baseSize * 0.07 * sizeScale));
    const fontColor = isHex(it.color) ? it.color : isHex(style.color) ? style.color : '#FFFFFF';
    const borderColor = isHex(style.borderColor) ? style.borderColor : '#000000';
    const bg = it.bg === null ? undefined : isHex(it.bg) ? it.bg : isHex(style.backgroundColor) ? style.backgroundColor : undefined;
    const boxPart = bg ? `:box=1:boxcolor=0x${bg.slice(1)}@0.85:boxborderw=${Math.round(baseSize * 0.22 * sizeScale)}` : '';
    const flags = { bold: it.bold ?? style.bold, italic: it.italic ?? style.italic };
    const fontFile = resolveFontFile(it.font || style.fontFamily || 'Sans Bold', flags);
    const fontPart = fontFile ? `:fontfile='${fontFile}'` : '';
    const underline = (it.underline ?? style.underline) === true;
    return { fontSize, borderW, fontColor, borderColor, boxPart, fontPart, fontFile, underline };
  };

  const esc = (t: string) => t
    .replace(/\\/g, '')
    .replace(/'/g, '’')
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  const filters = items.flatMap((c) => {
    const { fontSize, borderW, fontColor, borderColor, boxPart, fontPart, fontFile, underline } = look(c);
    const lineH = Math.round(fontSize * 1.2);
    // The caption box is as wide as the person drew it (a share of the frame), and the words wrap inside it
    const boxShare = Math.min(0.98, Math.max(0.2, typeof c.w === 'number' && Number.isFinite(c.w) ? c.w : 0.88));
    const lines = wrapText(fontFile, c.text, fontSize, outputWidth * boxShare * 0.96, 6);
    const x = clamp01(c.x).toFixed(4);
    const y = clamp01(c.y).toFixed(4);
    const enable = `between(t,${Math.max(0, c.start).toFixed(3)},${Math.max(c.start, c.end).toFixed(3)})`;
    return lines.flatMap((line, li) => {
      const offset = Math.round((li - (lines.length - 1) / 2) * lineH);
      const m = underline ? measureText(fontFile, line, fontSize) : null;
      if (m) {
        // Underlined: place the text ourselves so the line under it sits in exactly the right spot
        const left = Math.min(Math.max(12, outputWidth * Number(x) - m.width / 2), Math.max(12, outputWidth - m.width - 12));
        const top = Math.min(Math.max(12, outputHeight * Number(y) + offset - m.inkHeight / 2), Math.max(12, outputHeight - m.inkHeight - 12));
        return [
          `drawtext=expansion=none:text='${esc(line)}':enable='${enable}':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${borderW}:bordercolor=${borderColor}:x=${left.toFixed(1)}:y=${top.toFixed(1)}${boxPart}${fontPart}`,
          underlineBox(m, fontSize, left, top, fontColor, enable),
        ];
      }
      return [`drawtext=expansion=none:text='${esc(line)}':enable='${enable}':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${borderW}:bordercolor=${borderColor}:x='max(12,min(w-text_w-12,w*${x}-text_w/2))':y='max(12,min(h-text_h-12,h*${y}+(${offset})-text_h/2))'${boxPart}${fontPart}`];
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
