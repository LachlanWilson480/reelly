import ffmpeg from 'fluent-ffmpeg';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;
ffmpeg.setFfmpegPath(FFMPEG_PATH);

const tmpDir = path.resolve('tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

function getRotation(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) { resolve(0); return; }
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const rotation = videoStream?.tags?.rotate
        ? parseInt(videoStream.tags.rotate, 10)
        : (videoStream?.side_data_list?.[0] as { rotation?: number } | undefined)?.rotation ?? 0;
      resolve(Math.abs(rotation));
    });
  });
}

function convertToMp4(inputPath: string, outputPath: string, rotation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputOptions = [
      '-c:v libx264',
      '-preset fast',
      '-crf 23',
      '-c:a aac',
      '-movflags +faststart',
      '-pix_fmt yuv420p',
    ];

    // Only apply transpose if rotation metadata won't be auto-handled
    // Use -noautorotate + manual transpose to ensure correct orientation
    const inputOptions = ['-noautorotate'];

    let vf = 'null';
    if (rotation === 90) vf = 'transpose=1';
    else if (rotation === 180) vf = 'transpose=2,transpose=2';
    else if (rotation === 270) vf = 'transpose=2';

    outputOptions.push(`-vf ${vf}`);

    ffmpeg(inputPath)
      .inputOptions(inputOptions)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', (cmd) => console.info('ffmpeg cmd:', cmd))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function needsConversion(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mov') || lower.endsWith('.avi') || lower.endsWith('.wmv') || lower.endsWith('.mkv');
}

export async function ensureMp4(url: string, port: number | string = 3000): Promise<{ localPath: string; cleanup: () => void }> {
  if (!needsConversion(url)) {
    return { localPath: url, cleanup: () => {} };
  }

  const id = randomUUID();
  const downloadPath = path.join(tmpDir, `${id}-input.mov`);
  const outputFileName = `${id}-output.mp4`;
  const outputPath = path.join(tmpDir, outputFileName);

  console.info(`Converting clip to mp4: ${url.split('?')[0]}`);

  await downloadFile(url, downloadPath);
  const rotation = await getRotation(downloadPath);
  console.info(`Detected rotation: ${rotation}°`);
  await convertToMp4(downloadPath, outputPath, rotation);

  fs.unlinkSync(downloadPath);

  const localPath = `http://localhost:${port}/tmp/${outputFileName}`;

  const cleanup = () => {
    try { fs.unlinkSync(outputPath); } catch {}
  };

  return { localPath, cleanup };
}
