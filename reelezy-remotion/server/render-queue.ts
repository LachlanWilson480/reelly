import { randomUUID } from "node:crypto";
import { ensureMp4 } from "./convert-clip";
import { cutSilence } from "./cut-silence";
import { stitchClips } from "./stitch-clips";
import { uploadRenderToSupabase } from "./upload-to-supabase";
import { getVideoDuration } from "./get-duration";
import { transcribeVideo } from "./transcribe";
import { burnCaptions } from "./burn-captions";

type ClipInput = {
  src: string;
  trimStart?: number;
  trimLength?: number;
  durationInSeconds: number;
  volume?: number;
  speed?: number;
  fit?: string;
  letterbox?: boolean;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  filter?: string;
  transition?: string;
};

type CaptionStyle = {
  preset: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: 'top' | 'center' | 'bottom';
};

type JobData = {
  clips: ClipInput[];
  musicSrc?: string;
  outputWidth: number;
  outputHeight: number;
  cutDeadSpace?: boolean;
  captionStyle?: CaptionStyle | null;
  watermark?: boolean;
  userId?: string;
  renderId?: string;
};

type JobState =
  | { status: "queued"; data: JobData; cancel: () => void }
  | { status: "in-progress"; progress: number; data: JobData; cancel: () => void }
  | { status: "completed"; videoUrl: string; durationSeconds: number; data: JobData }
  | { status: "failed"; error: string; data: JobData };

export const makeRenderQueue = ({
  port,
  rendersDir: _rendersDir,
}: {
  port: number;
  serveUrl: string;
  rendersDir: string;
}) => {
  const jobs = new Map<string, JobState>();
  let queue: Promise<unknown> = Promise.resolve();

  const setProgress = (jobId: string, progress: number, data: JobData, cancel: () => void) => {
    jobs.set(jobId, { status: "in-progress", progress, data, cancel });
  };

  const processRender = async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) throw new Error(`Render job ${jobId} not found`);

    let cancelled = false;
    const cancel = () => { cancelled = true; };
    jobs.set(jobId, { status: "in-progress", progress: 0, data: job.data, cancel });

    const tmpCleanups: (() => void)[] = [];

    try {
      const { clips, musicSrc, outputWidth, outputHeight, cutDeadSpace, captionStyle, watermark, userId, renderId } = job.data;

      // Step 1: convert MOV → mp4
      setProgress(jobId, 5, job.data, cancel);
      console.info(`[${jobId}] Step 1: converting clips`);
      const convertedClips = await Promise.all(
        clips.map(async (clip) => {
          const { localPath, cleanup } = await ensureMp4(clip.src, port);
          tmpCleanups.push(cleanup);
          return { ...clip, localPath };
        })
      );
      if (cancelled) throw new Error('Cancelled');

      // Step 2: cut dead space (optional)
      setProgress(jobId, 20, job.data, cancel);
      const readyClips = await Promise.all(
        convertedClips.map(async (clip) => {
          if (!cutDeadSpace) return clip;
          console.info(`[${jobId}] Step 2: cutting silence from clip`);
          const { outputPath, cleanup } = await cutSilence(clip.localPath);
          tmpCleanups.push(cleanup);
          return { ...clip, localPath: outputPath, trimStart: undefined };
        })
      );
      if (cancelled) throw new Error('Cancelled');

      // Step 3: stitch clips + mix music
      setProgress(jobId, 40, job.data, cancel);
      console.info(`[${jobId}] Step 3: stitching clips`);
      const { httpUrl, cleanup: stitchCleanup } = await stitchClips(
        readyClips,
        captionStyle ? undefined : musicSrc, // don't mix music yet if captions needed
        outputWidth,
        outputHeight,
        port
      );
      if (cancelled) throw new Error('Cancelled');

      // Get local file path of stitched video
      const stitchedFileName = httpUrl.split('/renders/')[1];
      const stitchedLocalPath = require('node:path').join(require('node:path').resolve('renders'), stitchedFileName);

      let finalPath = stitchedLocalPath;
      let captionCleanup: (() => void) | null = null;

      // Step 4: transcribe + render captions (optional)
      if (captionStyle && process.env.OPENAI_API_KEY) {
        setProgress(jobId, 55, job.data, cancel);
        console.info(`[${jobId}] Step 4: transcribing audio`);
        const words = await transcribeVideo(stitchedLocalPath);
        if (cancelled) throw new Error('Cancelled');

        setProgress(jobId, 70, job.data, cancel);
        console.info(`[${jobId}] Step 5: burning captions`);
        const { outputPath, cleanup } = await burnCaptions(
          stitchedLocalPath,
          words,
          captionStyle,
          outputWidth,
          outputHeight
        );
        captionCleanup = cleanup;
        tmpCleanups.push(() => { try { require('node:fs').unlinkSync(stitchedLocalPath); } catch {} });
        finalPath = outputPath;
        if (cancelled) throw new Error('Cancelled');
      }

      // Watermark step (free plan)
      if (watermark) {
        const { execFile } = require('node:child_process');
        const { promisify } = require('node:util');
        const { randomUUID } = require('node:crypto');
        const path = require('node:path');
        const execFileAsync = promisify(execFile);
        const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
        const watermarkedPath = path.join(path.resolve('renders'), `${randomUUID()}-watermarked.mp4`);
        const wmText = 'reelezy.com';
        const drawtext = `drawtext=text='${wmText}':fontsize=36:fontcolor=white@0.5:borderw=2:bordercolor=black@0.5:x=(w-text_w)/2:y=(h-text_h)/2`;
        await execFileAsync(FFMPEG_PATH, [
          '-y', '-i', finalPath,
          '-vf', drawtext,
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
          '-c:a', 'copy', '-movflags', '+faststart',
          watermarkedPath,
        ]);
        tmpCleanups.push(() => { try { require('node:fs').unlinkSync(finalPath); } catch {} });
        finalPath = watermarkedPath;
      }

      // Measure duration
      const durationSeconds = await getVideoDuration(finalPath);
      console.info(`[${jobId}] Duration: ${durationSeconds.toFixed(1)}s`);

      // Step 5/6: upload to Supabase
      let finalUrl = `${process.env.PUBLIC_URL || `http://localhost:${port}`}/renders/${require('node:path').basename(finalPath)}`;
      console.info(`[${jobId}] userId=${userId} renderId=${renderId} hasSupabase=${!!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)}`);

      if (userId && renderId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        setProgress(jobId, 90, job.data, cancel);
        console.info(`[${jobId}] Uploading to Supabase`);
        try {
          finalUrl = await uploadRenderToSupabase(finalPath, userId, renderId);
          stitchCleanup();
          if (captionCleanup) captionCleanup();
          console.info(`[${jobId}] Uploaded to Supabase: ${finalUrl}`);
        } catch (uploadErr) {
          console.error(`[${jobId}] Supabase upload failed, keeping local URL:`, uploadErr);
        }
      }

      jobs.set(jobId, { status: "completed", videoUrl: finalUrl, durationSeconds, data: job.data });
      console.info(`[${jobId}] Done: ${finalUrl}`);

    } catch (error) {
      console.error(`[${jobId}] Render failed:`, error);
      jobs.set(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        data: job.data,
      });
    } finally {
      tmpCleanups.forEach(fn => fn());
    }
  };

  const queueRender = (jobId: string, data: JobData) => {
    jobs.set(jobId, {
      status: "queued",
      data,
      cancel: () => { jobs.delete(jobId); },
    });
    const render = queue.then(() => processRender(jobId));
    queue = render.catch(() => undefined);
  };

  function createJob(data: JobData) {
    const jobId = randomUUID();
    queueRender(jobId, data);
    return jobId;
  }

  return { createJob, jobs };
};
