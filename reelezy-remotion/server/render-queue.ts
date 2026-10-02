import { randomUUID } from "node:crypto";
import { ensureMp4 } from "./convert-clip";
import { cutSilence } from "./cut-silence";
import { stitchClips } from "./stitch-clips";

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
};

type JobData = {
  clips: ClipInput[];
  musicSrc?: string;
  outputWidth: number;
  outputHeight: number;
  cutDeadSpace?: boolean;
};

type JobState =
  | { status: "queued"; data: JobData; cancel: () => void }
  | { status: "in-progress"; progress: number; data: JobData; cancel: () => void }
  | { status: "completed"; videoUrl: string; data: JobData }
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
      const { clips, musicSrc, outputWidth, outputHeight, cutDeadSpace } = job.data;

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
      setProgress(jobId, 25, job.data, cancel);
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

      // Step 3: stitch clips + mix music (final file kept in renders/)
      setProgress(jobId, 50, job.data, cancel);
      console.info(`[${jobId}] Step 3: stitching clips`);
      const { httpUrl } = await stitchClips(
        readyClips,
        musicSrc,
        outputWidth,
        outputHeight,
        port
      );
      if (cancelled) throw new Error('Cancelled');

      setProgress(jobId, 100, job.data, cancel);
      jobs.set(jobId, { status: "completed", videoUrl: httpUrl, data: job.data });
      console.info(`[${jobId}] Done: ${httpUrl}`);

    } catch (error) {
      console.error(`[${jobId}] Render failed:`, error);
      jobs.set(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        data: job.data,
      });
    } finally {
      // Only clean up tmp files, not the final render
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
