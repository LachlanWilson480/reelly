import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { alignToText } from './align-script';

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

  // Made easier to hear for the speech-to-text: one channel, rumble and hiss cut, quiet speech lifted over music
  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-i', videoPath,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-af', 'highpass=f=80,lowpass=f=8000,dynaudnorm=f=150:g=15',
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    audioPath,
  ]);

  return {
    audioPath,
    cleanup: () => { try { fs.unlinkSync(audioPath); } catch {} },
  };
}

// hint: the script and names that should be in it, which helps the speech-to-text hear and spell them right
export async function transcribeVideo(videoPath: string, hint?: string): Promise<WordTimestamp[]> {
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
    if (hint && hint.trim()) formData.append('prompt', hint.trim().slice(0, 800));

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
    const heard: WordTimestamp[] = (data.words || []).map((w: { word: string; start: number; end: number }) => ({
      word: String(w.word || '').trim(),
      start: w.start,
      end: w.end,
    })).filter((w: WordTimestamp) => w.word);
    // Its word list sometimes leaves out words that are in its full text, so put those back in
    const words = typeof data.text === 'string' && data.text.trim() ? alignToText(heard, data.text, 0.6) : heard;

    console.info(`Transcribed ${heard.length} words (${words.length} after filling gaps)`);
    return words;
  } finally {
    cleanup();
  }
}
