import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;
const tmpDir = path.resolve('tmp');

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

async function extractMp3(videoPath: string): Promise<{ audioPath: string; cleanup: () => void }> {
  const audioPath = path.join(tmpDir, `${randomUUID()}-audio.mp3`);

  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-i', videoPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    audioPath,
  ]);

  return {
    audioPath,
    cleanup: () => { try { fs.unlinkSync(audioPath); } catch {} },
  };
}

export async function transcribeVideo(videoPath: string): Promise<WordTimestamp[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const { audioPath, cleanup } = await extractMp3(videoPath);

  try {
    const audioBuffer = fs.readFileSync(audioPath);
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    const formData = new FormData();
    formData.append('file', blob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API error: ${err}`);
    }

    const data = await res.json();
    const words: WordTimestamp[] = (data.words || []).map((w: { word: string; start: number; end: number }) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    console.info(`Transcribed ${words.length} words`);
    return words;
  } finally {
    cleanup();
  }
}
