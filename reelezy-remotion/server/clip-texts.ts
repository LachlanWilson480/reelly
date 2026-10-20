import { getVideoDuration } from "./get-duration";

type Word = { word: string; start: number; end: number };
type TimedClip = {
  localPath: string;
  trimStart?: number;
  trimLength?: number;
  speed?: number;
  transition?: string;
  captionTexts?: string[];
};

const TRANSITION_DURATION = 0.3; // matches stitch-clips.ts

// Turns each clip's on-screen text into caption words spread across that clip, so videos with no speech still get captions.
// Where a clip has on-screen text, it replaces any speech captions for that stretch so the two never overlap.
export async function addClipTexts(spoken: Word[], clips: TimedClip[]): Promise<Word[]> {
  const windows: { start: number; end: number; texts: string[] }[] = [];
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const fileDuration = await getVideoDuration(clip.localPath);
    const available = Math.max(0.1, (fileDuration > 0 ? fileDuration : clip.trimLength || 5) - (clip.trimStart ?? 0));
    const length = Math.min(clip.trimLength ?? available, available) / (clip.speed && clip.speed > 0 ? clip.speed : 1);
    if (i > 0 && clip.transition && clip.transition !== "none") cursor = Math.max(0, cursor - TRANSITION_DURATION);
    windows.push({ start: cursor, end: cursor + length, texts: clip.captionTexts || [] });
    cursor += length;
  }

  const textWindows = windows.filter((w) => w.texts.length > 0);
  const kept = spoken.filter((w) => !textWindows.some((t) => w.start < t.end && w.end > t.start));

  const added: Word[] = [];
  for (const w of textWindows) {
    const segmentLength = (w.end - w.start) / w.texts.length;
    w.texts.forEach((text, k) => {
      const parts = text.split(/\s+/).filter(Boolean);
      if (parts.length === 0) return;
      const segStart = w.start + k * segmentLength;
      const step = segmentLength / parts.length;
      parts.forEach((part, j) => added.push({ word: part, start: segStart + j * step, end: segStart + (j + 1) * step }));
    });
  }

  return [...kept, ...added].sort((a, b) => a.start - b.start);
}
