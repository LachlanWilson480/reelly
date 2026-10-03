import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH || `${process.env.HOME}/bin/ffmpeg`;
const FFPROBE_PATH = FFMPEG_PATH.replace('ffmpeg', 'ffprobe');

export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath,
    ]);
    const data = JSON.parse(stdout);
    return parseFloat(data.format?.duration || '0');
  } catch {
    return 0;
  }
}
