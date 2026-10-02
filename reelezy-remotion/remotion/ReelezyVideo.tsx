import { AbsoluteFill, Video, Audio, Sequence, useVideoConfig } from "remotion";
import { z } from "zod";

export const clipSchema = z.object({
  src: z.string(),
  startFrom: z.number().optional(),   // trimStart in seconds → converted to frames
  endAt: z.number().optional(),       // trimStart + trimLength in seconds → converted to frames
  volume: z.number().optional(),
  speed: z.number().optional(),
  fit: z.enum(["crop", "cover", "contain"]).optional(),
  filter: z.string().optional(),
  rotate: z.number().optional(),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  letterbox: z.boolean().optional(),
  durationInSeconds: z.number(),      // effective clip length (already trimmed)
});

export const reelezySchema = z.object({
  clips: z.array(clipSchema),
  musicSrc: z.string().optional(),
  width: z.number(),
  height: z.number(),
});

export type ReelezyProps = z.infer<typeof reelezySchema>;

const MUSIC_VOLUME = 0.6;

const getFilterStyle = (filter?: string): React.CSSProperties => {
  switch (filter) {
    case "greyscale": return { filter: "grayscale(100%)" };
    case "sepia": return { filter: "sepia(100%)" };
    case "blur": return { filter: "blur(8px)" };
    case "invert": return { filter: "invert(100%)" };
    default: return {};
  }
};

const getObjectFit = (fit?: string): "cover" | "contain" | "fill" => {
  if (fit === "contain") return "contain";
  return "cover";
};

export const ReelezyVideo: React.FC<ReelezyProps> = ({ clips, musicSrc }) => {
  const { fps } = useVideoConfig();

  // Build cumulative start times in frames
  const clipStartFrames: number[] = [];
  let cursor = 0;
  for (const clip of clips) {
    clipStartFrames.push(cursor);
    cursor += Math.round(clip.durationInSeconds * fps);
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {clips.map((clip, i) => {
        const durationInFrames = Math.round(clip.durationInSeconds * fps);
        const startFrom = clip.startFrom ? Math.round(clip.startFrom * fps) : 0;
        const endAt = clip.endAt ? Math.round(clip.endAt * fps) : undefined;
        const filterStyle = getFilterStyle(clip.filter);
        const objectFit = getObjectFit(clip.fit);

        const transform = [
          clip.rotate ? `rotate(${clip.rotate}deg)` : "",
          clip.flipH ? "scaleX(-1)" : "",
          clip.flipV ? "scaleY(-1)" : "",
        ].filter(Boolean).join(" ");

        return (
          <Sequence
            key={i}
            from={clipStartFrames[i]}
            durationInFrames={durationInFrames}
          >
            {/* Letterbox blurred background */}
            {clip.letterbox && (
              <AbsoluteFill>
                <Video
                  src={clip.src}
                  startFrom={startFrom}
                  {...(endAt ? { endAt } : {})}
                  volume={0}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    filter: "blur(20px)",
                    transform: "scale(1.1)",
                  }}
                />
              </AbsoluteFill>
            )}

            {/* Main clip */}
            <AbsoluteFill>
              <Video
                src={clip.src}
                startFrom={startFrom}
                {...(endAt ? { endAt } : {})}
                volume={typeof clip.volume === "number" ? clip.volume : 1}
                playbackRate={clip.speed || 1}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: clip.letterbox ? "contain" : objectFit,
                  transform: transform || undefined,
                  ...filterStyle,
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Background music */}
      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={MUSIC_VOLUME}
          startFrom={0}
        />
      )}
    </AbsoluteFill>
  );
};
