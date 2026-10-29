import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const PAUSE_THRESHOLD = 0.4;
const MIN_FONT_SIZE = 36;

type WordTimestamp = { word: string; start: number; end: number };
type LayerPos = { enabled?: boolean; x?: number; y?: number };
type CaptionLayers = { onScreen?: LayerPos; speech?: LayerPos; textLayer?: 'onScreen' | 'speech' };
type TextSegment = { text: string; start: number; end: number };
type CaptionStyle = {
  layers?: CaptionLayers;
  preset: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: 'top' | 'center' | 'bottom';
  borderColor?: string;
  backgroundColor?: string;
};

type PresetConfig = {
  fontSize: number;
  fontColor: string;
  borderColor: string;
  borderWidth: number;
  wordsPerGroup: number;
  yPosition: string;
  uppercase: boolean;
  boxColor?: string;
  box?: number;
};

const PRESETS: Record<string, PresetConfig> = {
  word_by_word: {
    fontSize: 80,
    fontColor: 'white',
    borderColor: 'black',
    borderWidth: 4,
    wordsPerGroup: 1,
    yPosition: 'h*0.55',
    uppercase: true,
  },
  bold_center: {
    fontSize: 64,
    fontColor: 'white',
    borderColor: 'black',
    borderWidth: 3,
    wordsPerGroup: 3,
    yPosition: 'h*0.82',
    uppercase: true,
  },
  coral_pop: {
    fontSize: 60,
    fontColor: '#D85A30',
    borderColor: 'black',
    borderWidth: 3,
    wordsPerGroup: 3,
    yPosition: 'h*0.82',
    uppercase: true,
  },
  minimal_bottom: {
    fontSize: 44,
    fontColor: 'white',
    borderColor: 'black',
    borderWidth: 1,
    boxColor: '0x00000080',
    box: 1,
    wordsPerGroup: 5,
    yPosition: 'h*0.78',
    uppercase: false,
  },
  typewriter: {
    fontSize: 46,
    fontColor: 'white',
    borderColor: 'black',
    borderWidth: 1,
    boxColor: '0x00000080',
    box: 1,
    wordsPerGroup: 4,
    yPosition: 'h*0.78',
    uppercase: false,
  },
};

function groupWords(words: WordTimestamp[], wordsPerGroup: number): { text: string; start: number; end: number }[] {
  if (words.length === 0) return [];
  const groups: { text: string; start: number; end: number }[] = [];
  let currentGroup: WordTimestamp[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    const groupFull = currentGroup.length >= wordsPerGroup;
    if (gap > PAUSE_THRESHOLD || groupFull) {
      groups.push({
        text: currentGroup.map(w => w.word).join(' '),
        start: currentGroup[0].start,
        end: currentGroup[currentGroup.length - 1].end,
      });
      currentGroup = [words[i]];
    } else {
      currentGroup.push(words[i]);
    }
  }

  if (currentGroup.length > 0) {
    groups.push({
      text: currentGroup.map(w => w.word).join(' '),
      start: currentGroup[0].start,
      end: currentGroup[currentGroup.length - 1].end,
    });
  }

  return groups;
}

export async function burnCaptions(
  inputPath: string,
  words: WordTimestamp[],
  captionStyle: CaptionStyle,
  outputWidth: number,
  outputHeight: number,
  textSegments: TextSegment[] = [],
): Promise<{ outputPath: string; cleanup: () => void }> {
  const outputPath = path.join(path.resolve('renders'), `${randomUUID()}-captioned.mp4`);

  const presetKey = captionStyle.preset || 'word_by_word';
  const preset = PRESETS[presetKey] || PRESETS.word_by_word;

  // Caption sizes are designed for a 1080 wide video, so scale them with the output size
  const sizeScale = Math.max(0.5, Math.min(outputWidth, outputHeight) / 1080);
  const is4K = Math.max(outputWidth, outputHeight) >= 3840;
  const fontSize = Math.round(Math.max(MIN_FONT_SIZE, captionStyle.fontSize || preset.fontSize) * sizeScale);
  const borderW = Math.max(1, Math.round(preset.borderWidth * sizeScale));
  const fontColor = captionStyle.color || preset.fontColor;
  const borderColor = captionStyle.borderColor || preset.borderColor;
  const uppercase = preset.uppercase;
  // A background colour chosen by the user wins over the preset's own box
  const customBox = /^#[0-9a-fA-F]{6}$/.test(captionStyle.backgroundColor || '') ? `:box=1:boxcolor=0x${captionStyle.backgroundColor!.slice(1)}@0.85:boxborderw=${Math.round(14 * sizeScale)}` : '';

  // Map position override
  const positionOverride = captionStyle.position;
  const yPosition = positionOverride === 'top' ? 'h*0.08'
    : positionOverride === 'center' ? 'h*0.55'
    : positionOverride === 'bottom' ? 'h*0.78'
    : preset.yPosition;

  // Map font family to system font file paths (Linux/Railway - fonts-liberation)
  const fontMap: Record<string, string> = {
    'Sans': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    'Sans Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'Serif': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    'Serif Bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    'Mono': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    'Mono Bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
    'Narrow': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Regular.ttf',
    'Narrow Bold': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf',
    'Montserrat ExtraBold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'Impact': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf',
    'Anton': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf',
    'Bebas Neue': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf',
    'Oswald': '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Regular.ttf',
    'Roboto Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'Open Sans Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'Lato Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  };
  const fontFilePath = captionStyle.fontFamily ? fontMap[captionStyle.fontFamily] : null;
  const fontFilePart = fontFilePath && require('node:fs').existsSync(fontFilePath)
    ? `:fontfile='${fontFilePath}'`
    : '';

  const layers = captionStyle.layers;
  const speechOn = layers?.speech?.enabled !== false;
  const textLayerKey = layers?.textLayer === 'speech' ? 'speech' : 'onScreen';
  const textOn = layers?.[textLayerKey]?.enabled !== false;
  const groups = speechOn ? groupWords(words, preset.wordsPerGroup) : [];
  const texts = textOn ? textSegments : [];

  // Where a layer sits: centre of the text at (x, y) as a share of the frame, kept inside the picture
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
  const xExpr = (pos?: LayerPos) => {
    const x = num(pos?.x);
    return x === null ? '(w-text_w)/2' : `max(12,min(w-text_w-12,w*${x.toFixed(4)}-text_w/2))`;
  };
  const yCenter = (pos: LayerPos | undefined, fallback: string) => {
    const y = num(pos?.y);
    return y === null ? fallback : `h*${y.toFixed(4)}`;
  };

  if (groups.length === 0 && texts.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return { outputPath, cleanup: () => { try { fs.unlinkSync(outputPath); } catch {} } };
  }

  const drawtextFilters = groups.map((group, i) => {
    const nextGroup = groups[i + 1];
    const text = (uppercase ? group.text.toUpperCase() : group.text)
      .replace(/'/g, "\u2019")
      .replace(/:/g, "\\:")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");

    const boxPart = customBox || (preset.box ? `:box=1:boxcolor=${preset.boxColor}:boxborderw=${Math.round(10 * sizeScale)}` : '');
    const adjStart = Math.max(0, group.start);
    const adjEnd = nextGroup ? Math.min(group.end, nextGroup.start) : group.end;

    const speechY = num(layers?.speech?.y) === null ? yPosition : `max(12,min(h-text_h-12,${yCenter(layers?.speech, '0')}-text_h/2))`;
    return `drawtext=text='${text}':enable='between(t,${adjStart},${adjEnd})':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${borderW}:bordercolor=${borderColor}:x='${xExpr(layers?.speech)}':y='${speechY}'${boxPart}${fontFilePart}:line_spacing=8`;
  });

  // Layer 1: on-screen text, shown as whole phrases above the speech captions
  const textPos = layers?.[textLayerKey];
  const textFont = Math.round(fontSize * 0.85);
  const lineH = Math.round(textFont * 1.22);
  const maxChars = Math.max(8, Math.floor((outputWidth * 0.86) / (textFont * (uppercase ? 0.68 : 0.56))));
  const wrap = (phrase: string) => {
    const lines: string[] = [];
    let cur = '';
    for (const w of phrase.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 5);
  };
  const baseCenterY = num(textPos?.y) === null ? `(${yPosition}-h*0.16)` : yCenter(textPos, '0');
  const textFilters = texts.flatMap((seg) => {
    const lines = wrap(uppercase ? seg.text.toUpperCase() : seg.text);
    return lines.map((line, li) => {
      const safe = line.replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
      const offset = Math.round((li - (lines.length - 1) / 2) * lineH);
      const boxPart = customBox || (preset.box ? `:box=1:boxcolor=${preset.boxColor}:boxborderw=${Math.round(10 * sizeScale)}` : '');
      return `drawtext=text='${safe}':enable='between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)})':fontsize=${textFont}:fontcolor=${fontColor}:borderw=${borderW}:bordercolor=${borderColor}:x='${xExpr(textPos)}':y='max(12,min(h-text_h-12,${baseCenterY}+(${offset})-text_h/2))'${boxPart}${fontFilePart}`;
    });
  });
  drawtextFilters.push(...textFilters);

  // Split into batches of 50 to avoid OS argument length limits
  const BATCH_SIZE = 50;
  const batches: string[][] = [];
  for (let i = 0; i < drawtextFilters.length; i += BATCH_SIZE) {
    batches.push(drawtextFilters.slice(i, i + BATCH_SIZE));
  }

  let currentInput = inputPath;
  const tempPaths: string[] = [];

  for (let b = 0; b < batches.length; b++) {
    const isLast = b === batches.length - 1;
    const batchOutput = isLast ? outputPath : path.join(path.resolve('renders'), `${randomUUID()}-caption-batch-${b}.mp4`);
    if (!isLast) tempPaths.push(batchOutput);

    await execFileAsync(FFMPEG_PATH, [
      '-y',
      '-i', currentInput,
      '-vf', batches[b].join(','),
      '-c:v', 'libx264',
      '-preset', is4K ? 'veryfast' : 'fast',
      '-crf', is4K ? '22' : '18',
      ...(is4K ? ['-maxrate', '16M', '-bufsize', '32M'] : []),
      '-c:a', 'copy',
      '-movflags', '+faststart',
      batchOutput,
    ]);

    if (b > 0 && currentInput !== inputPath) {
      try { fs.unlinkSync(currentInput); } catch {}
    }
    currentInput = batchOutput;
  }

  // Clean up temp batch files
  for (const p of tempPaths) { try { fs.unlinkSync(p); } catch {} }

  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  return { outputPath, cleanup };
}
