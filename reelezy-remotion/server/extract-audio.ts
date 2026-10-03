import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

export async function extractAudio(videoUrl: string): Promise<{ buffer: Buffer; cleanup: () => void }> {
  const id = randomUUID();
  const inputPath = path.join(tmpDir, `${id}-input.mov`);
  const outputPath = path.join(tmpDir, `${id}-audio.mp3`);

  // Download the video
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(inputPath, Buffer.from(buffer));

  // Extract audio with ffmpeg
  await execFileAsync(FFMPEG_PATH, [
    '-y',
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-q:a', '2',
    outputPath,
  ]);

  fs.unlinkSync(inputPath);

  const audioBuffer = fs.readFileSync(outputPath);
  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };

  return { buffer: audioBuffer, cleanup };
}
