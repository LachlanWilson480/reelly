import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureMp4 } from "./convert-clip";
import { cutSilence, mapThroughKeep, type Segment } from "./cut-silence";
import { stitchClips } from "./stitch-clips";
import { uploadRenderToSupabase } from "./upload-to-supabase";
import { getVideoDuration } from "./get-duration";
import { transcribeVideo } from "./transcribe";
import { correctTranscript } from "./correct-transcript";
import { alignToText, alignByClip } from "./align-script";
import { createClient } from "@supabase/supabase-js";
import { burnCaptions } from "./burn-captions";
import { clipTextSegments } from "./clip-texts";
import { applyOverlay, type OverlayInput } from "./overlay";
import { burnCustomCaptions, type CustomCaption, type CustomCaptionStyle } from "./custom-captions";

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
  captionTexts?: string[];
  crop?: { x: number; y: number; w: number; h: number };
  place?: { x: number; y: number; s: number };
};

type CaptionStyle = {
  layers?: {
    onScreen?: { enabled?: boolean; x?: number; y?: number };
    speech?: { enabled?: boolean; x?: number; y?: number };
    textLayer?: 'onScreen' | 'speech';
  };
  preset: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: 'top' | 'center' | 'bottom';
};

type JobData = {
  clips: ClipInput[];
  musicSrc?: string;
  voiceovers?: { url: string; start: number; duration: number }[];
  originalVolume?: number;
  musicVolume?: number;
  // Seconds into the video where the music starts. Below 0 skips that much of the start of the song.
  musicStart?: number;
  // The words the person was reading (their script), so captions can have every word, spelt right
  captionScript?: string;
  outputWidth: number;
  outputHeight: number;
  cutDeadSpace?: boolean;
  crf?: number;
  captionStyle?: CaptionStyle | null;
  captionTextOnly?: boolean;
  customCaptions?: { items: CustomCaption[]; style: CustomCaptionStyle };
  overlay?: OverlayInput;
  overlays?: OverlayInput[];
  watermark?: boolean;
  userId?: string;
  renderId?: string;
  callbackUrl?: string;
};

type JobState =
  | { status: "queued"; data: JobData; cancel: () => void }
  | { status: "in-progress"; progress: number; data: JobData; cancel: () => void }
  | { status: "completed"; videoUrl: string; durationSeconds: number; data: JobData }
  | { status: "failed"; error: string; data: JobData };

// Tells the website the moment a render ends, so it is saved even if nobody has the app open
const notifyCallback = async (data: JobData, payload: Record<string, unknown>) => {
  if (!data.callbackUrl || !data.renderId || !process.env.RENDER_SERVER_SECRET) return;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(data.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.RENDER_SERVER_SECRET },
        body: JSON.stringify({ renderId: data.renderId, ...payload }),
      });
      if (res.ok) return;
      console.warn(`Render callback attempt ${attempt} returned ${res.status}`);
    } catch (err) {
      console.warn(`Render callback attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
};

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
      const { clips, musicSrc, originalVolume, musicVolume, outputWidth, outputHeight, cutDeadSpace, captionStyle, captionTextOnly, customCaptions, overlay, watermark, crf, userId, renderId } = job.data;
      // Smart Trim can move these, so they are worked on as copies
      let voiceovers = job.data.voiceovers;
      let overlays = job.data.overlays;
      let musicStart = job.data.musicStart ?? 0;

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

      // Step 2: cut dead space (optional). It listens to each clip's own sound and to any voiceover playing over it,
      // so nothing is cut while someone is talking, then moves the voiceovers and overlays to match the shorter clips.
      setProgress(jobId, 20, job.data, cancel);
      const speedOf = (c: ClipInput) => Math.min(8, Math.max(0.25, c.speed ?? 1));
      // durationInSeconds is how long the clip lasts in the video, with its speed already taken into account
      const startsAt: number[] = [];
      { let acc = 0; for (const c of convertedClips) { startsAt.push(acc); acc += Math.max(0, c.durationInSeconds || 0); } }
      const lengthOf = (i: number) => Math.max(0, convertedClips[i].durationInSeconds || 0);
      const voiceoverIn = (i: number): Segment[] => (voiceovers || []).flatMap((v) => {
        const vEnd = v.duration > 0 ? v.start + v.duration : Infinity;
        const a = Math.max(v.start, startsAt[i]);
        const b = Math.min(vEnd, startsAt[i] + lengthOf(i));
        return b > a ? [{ start: (a - startsAt[i]) * speedOf(convertedClips[i]), end: (b - startsAt[i]) * speedOf(convertedClips[i]) }] : [];
      });
      const kept: (Segment[] | null)[] = convertedClips.map(() => null);
      const readyClips = await Promise.all(
        convertedClips.map(async (clip, i) => {
          // A clip the user trimmed by hand keeps their exact trim, so skip Smart Trim for it
          if (!cutDeadSpace || customCaptions || clip.trimStart || clip.trimLength) return clip;
          console.info(`[${jobId}] Step 2: cutting silence from clip`);
          const { outputPath, cleanup, keep } = await cutSilence(clip.localPath, voiceoverIn(i));
          tmpCleanups.push(cleanup);
          kept[i] = keep;
          return { ...clip, localPath: outputPath, trimStart: undefined };
        })
      );
      if (cancelled) throw new Error('Cancelled');
      if (kept.some(Boolean)) {
        // A moment on the original timeline, moved to where it is once the silences are gone
        const newStarts: number[] = [];
        { let acc = 0; convertedClips.forEach((c, i) => { newStarts.push(acc); const k = kept[i]; acc += k ? k.reduce((n, s) => n + (s.end - s.start), 0) / speedOf(c) : lengthOf(i); }); }
        const moveTime = (t: number) => {
          let i = convertedClips.length - 1;
          for (let j = 0; j < convertedClips.length; j++) { if (t < startsAt[j] + lengthOf(j)) { i = j; break; } }
          const local = Math.max(0, t - startsAt[i]) * speedOf(convertedClips[i]);
          const within = Math.min(local, kept[i] ? kept[i]!.reduce((m, s) => Math.max(m, s.end), 0) : local);
          return newStarts[i] + mapThroughKeep(kept[i], within) / speedOf(convertedClips[i]);
        };
        if (voiceovers) voiceovers = voiceovers.map((v) => ({ ...v, start: moveTime(v.start) }));
        if (overlays) overlays = overlays.map((o) => ({ ...o, start: moveTime(o.start), end: o.end === null ? null : moveTime(o.end) }));
        if (musicStart > 0) musicStart = moveTime(musicStart);
      }

      // Step 3: stitch clips + mix music
      setProgress(jobId, 40, job.data, cancel);
      console.info(`[${jobId}] Step 3: stitching clips`);
      const { httpUrl, cleanup: stitchCleanup, clipSpans } = await stitchClips(
        readyClips,
        musicSrc, // mixed in here so the music is not lost when captions are on
        outputWidth,
        outputHeight,
        port,
        undefined,
        // Voiceover is mixed in before captions are transcribed, so the captions include it
        { takes: voiceovers, originalVolume, musicVolume, musicStart }
      );
      if (cancelled) throw new Error('Cancelled');

      // Get local file path of stitched video
      const stitchedFileName = httpUrl.split('/renders/')[1];
      const stitchedLocalPath = require('node:path').join(require('node:path').resolve('renders'), stitchedFileName);

      let finalPath = stitchedLocalPath;
      let captionCleanup: (() => void) | null = null;

      // Step 4: transcribe + render captions (optional)
      const hasClipTexts = readyClips.some((c) => c.captionTexts && c.captionTexts.length > 0);
      const layers = captionStyle?.layers;
      const speechOn = !captionTextOnly && layers?.speech?.enabled !== false;
      const textLayerOn = (layers?.textLayer === 'speech' ? layers?.speech?.enabled : layers?.onScreen?.enabled) !== false;
      const textOn = hasClipTexts && textLayerOn;
      if (captionStyle && ((process.env.OPENAI_API_KEY && speechOn) || textOn)) {
        setProgress(jobId, 55, job.data, cancel);
        console.info(`[${jobId}] Step 4: transcribing audio`);
        // Correct proper nouns using user profile (also given to the speech-to-text as a hint)
        let properNouns: string[] = [];
        if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: profile } = await sb.from("business_profiles").select("business_name, suburb").eq("user_id", userId).maybeSingle();
            if (profile) properNouns = [profile.business_name, profile.suburb].filter(Boolean);
          } catch {}
        }
        const script = (job.data.captionScript || '').trim();
        // A filmed video has one script line per clip. Then each clip's words are matched to its own line.
        const scriptLines = script.split('\n').map((l) => l.trim()).filter(Boolean);
        const byClip = scriptLines.length > 0 && scriptLines.length === readyClips.length && clipSpans.length === readyClips.length && !(voiceovers && voiceovers.length > 0);
        let words: Awaited<ReturnType<typeof transcribeVideo>> = [];
        if (process.env.OPENAI_API_KEY && speechOn) {
          try {
            // Only names as the hint: giving it the whole script can make it skip words it thinks it already has
            words = await transcribeVideo(stitchedLocalPath, properNouns.join(', '));
          } catch (err) {
            // A silent video has nothing to transcribe, but its on-screen text (or script) still becomes captions
            if (!textOn && !byClip) throw err;
            console.warn(`[${jobId}] Transcription skipped:`, err instanceof Error ? err.message : err);
          }
        }
        // Use both what was heard (for timing) and the script (for every word, spelt right)
        const scripted = byClip ? alignByClip(words, scriptLines, clipSpans) : script ? alignToText(words, script, 0.5) : words;
        console.info(`[${jobId}] Captions: ${words.length} words heard, ${scripted.length} shown${byClip ? `, matched clip by clip across ${clipSpans.length} clips` : ''}`);
        const spokenWords = correctTranscript(scripted, properNouns);
        const textSegments = textOn ? await clipTextSegments(readyClips) : [];
        if (cancelled) throw new Error('Cancelled');

        setProgress(jobId, 70, job.data, cancel);
        console.info(`[${jobId}] Step 5: burning captions`);
        const { outputPath, cleanup } = await burnCaptions(
          stitchedLocalPath,
          spokenWords,
          captionStyle,
          outputWidth,
          outputHeight,
          textSegments
        );
        captionCleanup = cleanup;
        tmpCleanups.push(() => { try { require('node:fs').unlinkSync(stitchedLocalPath); } catch {} });
        finalPath = outputPath;
        if (cancelled) throw new Error('Cancelled');
      }

      // Step 5b: captions the user placed on the timeline
      if (customCaptions && customCaptions.items.length > 0) {
        setProgress(jobId, 80, job.data, cancel);
        console.info(`[${jobId}] Step 5b: burning ${customCaptions.items.length} timeline captions`);
        const burned = await burnCustomCaptions(finalPath, customCaptions.items, customCaptions.style, outputWidth, outputHeight);
        if (captionCleanup) captionCleanup();
        captionCleanup = burned.cleanup;
        finalPath = burned.outputPath;
        if (cancelled) throw new Error('Cancelled');
      }


      // Step 5c: an image or video the person laid over the finished video
      const overlayList: OverlayInput[] = overlays && overlays.length > 0 ? overlays : overlay ? [overlay] : [];
      if (overlayList.length > 0) {
        setProgress(jobId, 84, job.data, cancel);
        // One pass per overlay, in order, so a later overlay sits on top of an earlier one
        for (let n = 0; n < overlayList.length; n++) {
          const ov = overlayList[n];
          console.info(`[${jobId}] Step 5c: adding ${ov.kind} overlay ${n + 1} of ${overlayList.length}`);
          try {
            const overlaid = await applyOverlay(finalPath, ov, outputWidth, outputHeight);
            if (captionCleanup) captionCleanup();
            captionCleanup = overlaid.cleanup;
            finalPath = overlaid.outputPath;
          } catch (err) {
            // A broken overlay should not lose the whole video, so carry on without it
            console.error(`[${jobId}] Overlay ${n + 1} failed, continuing without it:`, err);
          }
          if (cancelled) throw new Error('Cancelled');
        }
      }

      // Watermark step (free plan)
      if (watermark) {
        const { execFile } = require('node:child_process');
        const { promisify } = require('node:util');
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
      void notifyCallback(job.data, { status: "done", outputUrl: finalUrl, durationSeconds });

    } catch (error) {
      console.error(`[${jobId}] Render failed:`, error);
      jobs.set(jobId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        data: job.data,
      });
      void notifyCallback(job.data, { status: "failed", error: error instanceof Error ? error.message : String(error) });
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
