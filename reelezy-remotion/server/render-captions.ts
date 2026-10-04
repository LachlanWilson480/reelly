import { renderMedia, selectComposition } from "@remotion/renderer";
import { bundle } from "@remotion/bundler";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

let bundleUrl: string | null = null;

async function getBundle(): Promise<string> {
  if (bundleUrl) return bundleUrl;
  console.info("Bundling Remotion for captions...");
  bundleUrl = await bundle({
    entryPoint: path.resolve("remotion/index.ts"),
    onProgress(progress) {
      console.info(`Bundling: ${progress}%`);
    },
  });
  return bundleUrl;
}

type WordTimestamp = { word: string; start: number; end: number };
type CaptionStyle = {
  preset: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: 'top' | 'center' | 'bottom';
};

export async function renderWithCaptions(
  videoSrc: string,
  words: WordTimestamp[],
  captionStyle: CaptionStyle,
  musicSrc: string | undefined,
  outputWidth: number,
  outputHeight: number
): Promise<{ outputPath: string; cleanup: () => void }> {
  const serveUrl = await getBundle();
  const outputPath = path.join(path.resolve("renders"), `${randomUUID()}-captioned.mp4`);

  const lastWord = words[words.length - 1];
  const durationInFrames = lastWord ? Math.ceil((lastWord.end + 1) * 30) : 300;

  const inputProps = {
    videoSrc,
    musicSrc,
    words,
    captionStyle,
    width: outputWidth,
    height: outputHeight,
  };

  const composition = await selectComposition({
    serveUrl,
    id: "CaptionedVideo",
    inputProps,
  });

  await renderMedia({
    serveUrl,
    composition: { ...composition, durationInFrames },
    inputProps,
    codec: "h264",
    outputLocation: outputPath,
  });

  const cleanup = () => { try { fs.unlinkSync(outputPath); } catch {} };
  return { outputPath, cleanup };
}
