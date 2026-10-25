import { getVideoDuration } from "./get-duration";

type TimedClip = {
  localPath: string;
  trimStart?: number;
  trimLength?: number;
  speed?: number;
  transition?: string;
  captionTexts?: string[];
};

const TRANSITION_DURATION = 0.3; // matches stitch-clips.ts

export type TextSegment = { text: string; start: number; end: number };

// Each clip's on-screen text, timed across that clip, as whole phrases (shown as their own caption layer above the speech)
export async function clipTextSegments(clips: TimedClip[]): Promise<TextSegment[]> {
  const out: TextSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const fileDuration = await getVideoDuration(clip.localPath);
    const available = Math.max(0.1, (fileDuration > 0 ? fileDuration : clip.trimLength || 5) - (clip.trimStart ?? 0));
    const length = Math.min(clip.trimLength ?? available, available) / (clip.speed && clip.speed > 0 ? clip.speed : 1);
    if (i > 0 && clip.transition && clip.transition !== "none") cursor = Math.max(0, cursor - TRANSITION_DURATION);
    const texts = (clip.captionTexts || []).filter((t) => t.trim().length > 0);
    const segLen = texts.length > 0 ? length / texts.length : 0;
    texts.forEach((text, k) => out.push({ text: text.trim(), start: cursor + k * segLen, end: cursor + (k + 1) * segLen }));
    cursor += length;
  }
  return out;
}
