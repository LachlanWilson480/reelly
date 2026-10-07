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
type CaptionStyle = {
  preset: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: 'top' | 'center' | 'bottom';
  borderColor?: string;
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
    yPosition: '(h-text_h)/2',
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
    yPosition: 'h*0.85',
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
    yPosition: 'h*0.85',
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
): Promise<{ outputPath: string; cleanup: () => void }> {
  const outputPath = path.join(path.resolve('renders'), `${randomUUID()}-captioned.mp4`);

  const presetKey = captionStyle.preset || 'word_by_word';
  const preset = PRESETS[presetKey] || PRESETS.word_by_word;

  const fontSize = Math.max(MIN_FONT_SIZE, captionStyle.fontSize || preset.fontSize);
  const fontColor = captionStyle.color || preset.fontColor;
  const borderColor = captionStyle.borderColor || preset.borderColor;
  const uppercase = preset.uppercase;

  // Map position override
  const positionOverride = captionStyle.position;
  const yPosition = positionOverride === 'top' ? 'h*0.08'
    : positionOverride === 'center' ? '(h-text_h)/2'
    : positionOverride === 'bottom' ? 'h*0.85'
    : preset.yPosition;

  // Map font family to system font file paths (Linux/Railway)
  const fontMap: Record<string, string> = {
    'Impact': '/usr/share/fonts/truetype/msttcorefonts/Impact.ttf',
    'Arial': '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
    'Arial Black': '/usr/share/fonts/truetype/msttcorefonts/Arial_Black.ttf',
    'Helvetica': '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
    'Georgia': '/usr/share/fonts/truetype/msttcorefonts/Georgia.ttf',
  };
  const fontFilePath = captionStyle.fontFamily ? fontMap[captionStyle.fontFamily] : null;
  const fontFilePart = fontFilePath && require('node:fs').existsSync(fontFilePath)
    ? `:fontfile='${fontFilePath}'`
    : '';

  const groups = groupWords(words, preset.wordsPerGroup);

  if (groups.length === 0) {
    fs.copyFileSync(inputPath, outputPath);
    return { outputPath, cleanup: () => { try { fs.unlinkSync(outputPath); } catch {} } };
  }

  const drawtextFilters = groups.map((group) => {
    const text = (uppercase ? group.text.toUpperCase() : group.text)
      .replace(/'/g, "\u2019")
      .replace(/:/g, "\\:")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]");

    const boxPart = preset.box ? `:box=1:boxcolor=${preset.boxColor}:boxborderw=10` : '';
    const adjStart = Math.max(0, group.start - 0.1);
    const adjEnd = group.end - 0.05;

    return `drawtext=text='${text}':enable='between(t,${adjStart},${adjEnd})':fontsize=${fontSize}:fontcolor=${fontColor}:borderw=${preset.borderWidth}:bordercolor=${borderColor}:x=(w-text_w)/2:y=${yPosition}${boxPart}${fontFilePart}:line_spacing=8`;
  });

  const filterComplex = drawtextFilters.join(',');

  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-i', inputPath,
    '-vf', filterComplex,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    outputPath,
  ]);

  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  return { outputPath, cleanup };
}
