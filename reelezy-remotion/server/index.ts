import express from "express";
import cors from "cors";
import { makeRenderQueue } from "./render-queue";
import { extractAudio } from "./extract-audio";
import path from "node:path";
import fs from "node:fs";

const { PORT = 3000, RENDER_SERVER_SECRET } = process.env;

type IncomingClip = {
  src: string;
  trimStart?: number;
  trimLength?: number;
  duration?: number;
  volume?: number;
  speed?: number;
  fit?: string;
  filter?: string;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  letterbox?: boolean;
  transition?: string;
};

function setupApp() {
  const app = express();
  const rendersDir = path.resolve("renders");
  const tmpDir = path.resolve("tmp");

  if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const queue = makeRenderQueue({
    port: Number(PORT),
    serveUrl: "",
    rendersDir,
  });

  app.use(cors());
  app.use("/renders", express.static(rendersDir));
  app.use("/tmp", express.static(tmpDir));
  app.use(express.json({ limit: "10mb" }));

  app.use((req, res, next) => {
    if (req.path === "/health") return next();
    if (RENDER_SERVER_SECRET) {
      const key = req.headers["x-api-key"];
      if (key !== RENDER_SERVER_SECRET) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/renders", async (req, res) => {
    try {
      const { clips, musicSrc, outputOrientation, resolution, cutDeadSpace, captionStyle, userId, renderId, watermark } = req.body;

      if (!Array.isArray(clips) || clips.length === 0) {
        res.status(400).json({ error: "clips array is required" });
        return;
      }

      const isLow = resolution === "low";
      const isLandscape = outputOrientation === "landscape";
      const outputWidth = isLandscape ? (isLow ? 960 : 1920) : (isLow ? 540 : 1080);
      const outputHeight = isLandscape ? (isLow ? 540 : 1080) : (isLow ? 960 : 1920);

      const mappedClips = (clips as IncomingClip[]).map((clip) => {
        const trimStart = clip.trimStart ?? 0;
        const durationInSeconds =
          typeof clip.trimLength === "number" && clip.trimLength > 0
            ? clip.trimLength
            : typeof clip.duration === "number" && clip.duration > 0
            ? Math.max(0.1, clip.duration - trimStart)
            : 5;

        return {
          src: clip.src,
          trimStart: trimStart > 0 ? trimStart : undefined,
          trimLength: clip.trimLength,
          durationInSeconds,
          volume: clip.volume,
          speed: clip.speed,
          fit: clip.fit,
          filter: clip.filter,
          rotate: clip.rotate,
          flipH: clip.flipH,
          flipV: clip.flipV,
          letterbox: clip.letterbox,
          transition: clip.transition,
        };
      });

      // Normalize captionStyle
      let normalizedCaptionStyle = null;
      if (captionStyle) {
        if (typeof captionStyle === 'string') {
          normalizedCaptionStyle = { preset: captionStyle };
        } else if (typeof captionStyle === 'object' && captionStyle.preset) {
          normalizedCaptionStyle = {
            preset: captionStyle.preset,
            fontFamily: captionStyle.custom?.font?.family,
            fontSize: captionStyle.custom?.font?.size,
            color: captionStyle.custom?.font?.color,
            position: captionStyle.custom?.position,
            borderColor: captionStyle.custom?.borderColor,
          };
        }
      }

      const jobId = queue.createJob({
        clips: mappedClips,
        musicSrc,
        outputWidth,
        outputHeight,
        cutDeadSpace: cutDeadSpace === true,
        captionStyle: normalizedCaptionStyle,
        watermark: watermark === true,
        userId,
        renderId,
      });

      res.json({ jobId });
    } catch (err) {
      console.error("POST /renders error:", err);
      res.status(500).json({ error: "Failed to queue render" });
    }
  });

  app.get("/renders/:jobId", (req, res) => {
    const job = queue.jobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const completed = job.status === "completed" ? job as { videoUrl: string; durationSeconds: number } : null;

    res.json({
      status: job.status === "completed" ? "done" : job.status,
      progress: job.status === "in-progress"
        ? Math.round((job as { progress: number }).progress)
        : job.status === "completed" ? 100
        : job.status === "queued" ? 10
        : 0,
      outputUrl: completed ? completed.videoUrl : null,
      durationSeconds: completed ? completed.durationSeconds : null,
      error: job.status === "failed" ? (job as { error: string }).error : null,
    });
  });

  app.delete("/renders/:jobId", (req, res) => {
    const job = queue.jobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.status !== "queued" && job.status !== "in-progress") {
      res.status(400).json({ error: "Job is not cancellable" });
      return;
    }
    job.cancel();
    res.json({ message: "Job cancelled" });
  });

  app.post("/extract-audio", async (req, res) => {
    try {
      const { videoUrl } = req.body;
      if (!videoUrl) {
        res.status(400).json({ error: "videoUrl is required" });
        return;
      }

      console.info(`Extracting audio from: ${videoUrl.split('?')[0]}`);
      const { buffer, cleanup } = await extractAudio(videoUrl);

      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', String(buffer.length));
      res.send(buffer);

      cleanup();
    } catch (err) {
      console.error("POST /extract-audio error:", err);
      res.status(500).json({ error: "Failed to extract audio" });
    }
  });

  return app;
}

import { ensureBrowser } from "@remotion/renderer";

const app = setupApp();

ensureBrowser().then(() => {
  app.listen(PORT, () => {
    console.info(`Render server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to ensure browser:", err);
  process.exit(1);
});
