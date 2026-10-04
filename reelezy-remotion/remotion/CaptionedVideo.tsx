import { AbsoluteFill, Video, Audio, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { z } from "zod";

export const wordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export const captionedVideoSchema = z.object({
  videoSrc: z.string(),
  musicSrc: z.string().optional(),
  words: z.array(wordSchema),
  captionStyle: z.object({
    preset: z.string(),
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    color: z.string().optional(),
    position: z.enum(['top', 'center', 'bottom']).optional(),
  }),
  width: z.number(),
  height: z.number(),
});

export type CaptionedVideoProps = z.infer<typeof captionedVideoSchema>;
export type WordTimestamp = z.infer<typeof wordSchema>;

// Timing offset to compensate for Whisper's slight delay
const TIMING_OFFSET = -0.05;

const PRESETS: Record<string, {
  fontFamily: string;
  fontSize: number;
  color: string;
  activeColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  bgColor?: string;
  position: 'top' | 'center' | 'bottom';
  wordsPerGroup: number;
  uppercase?: boolean;
}> = {
  bold_center: {
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 72,
    color: '#FFFFFF',
    activeColor: '#D85A30',
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'bottom',
    wordsPerGroup: 3,
    uppercase: true,
  },
  minimal_bottom: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 42,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.5)',
    position: 'bottom',
    wordsPerGroup: 5,
  },
  coral_pop: {
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 64,
    color: '#F1EFE8',
    activeColor: '#D85A30',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'bottom',
    wordsPerGroup: 3,
    uppercase: true,
  },
  word_by_word: {
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 96,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 5,
    position: 'center',
    wordsPerGroup: 1,
    uppercase: true,
  },
  word_by_word_minimal: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 80,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.6)',
    position: 'center',
    wordsPerGroup: 1,
  },
  word_by_word_coral: {
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 96,
    color: '#D85A30',
    activeColor: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 5,
    position: 'center',
    wordsPerGroup: 1,
    uppercase: true,
  },
  typewriter: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: 44,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
    bgColor: 'rgba(0,0,0,0.5)',
    position: 'bottom',
    wordsPerGroup: 4,
  },
};

function groupWords(words: WordTimestamp[], wordsPerGroup: number): { words: WordTimestamp[]; start: number; end: number }[] {
  const groups = [];
  for (let i = 0; i < words.length; i += wordsPerGroup) {
    const group = words.slice(i, i + wordsPerGroup);
    groups.push({
      words: group,
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }
  return groups;
}

export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  videoSrc,
  musicSrc,
  words,
  captionStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps + TIMING_OFFSET;

  const presetKey = captionStyle.preset || 'bold_center';
  const preset = PRESETS[presetKey] || PRESETS.bold_center;

  const fontFamily = captionStyle.fontFamily || preset.fontFamily;
  const fontSize = captionStyle.fontSize || preset.fontSize;
  const color = captionStyle.color || preset.color;
  const position = captionStyle.position || preset.position;

  const groups = groupWords(words, preset.wordsPerGroup);
  const currentGroup = groups.find(g => currentTime >= g.start && currentTime <= g.end + 0.15);

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: '4%',
    right: '4%',
    textAlign: 'center',
    ...(position === 'bottom' ? { bottom: '10%' } : {}),
    ...(position === 'top' ? { top: '8%' } : {}),
    ...(position === 'center' ? { top: '45%', transform: 'translateY(-50%)' } : {}),
  };

  const textShadow = preset.strokeColor
    ? `${preset.strokeWidth}px ${preset.strokeWidth}px 0 ${preset.strokeColor}, -${preset.strokeWidth}px -${preset.strokeWidth}px 0 ${preset.strokeColor}, ${preset.strokeWidth}px -${preset.strokeWidth}px 0 ${preset.strokeColor}, -${preset.strokeWidth}px ${preset.strokeWidth}px 0 ${preset.strokeColor}`
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {musicSrc && <Audio src={musicSrc} volume={0.6} />}

      {currentGroup && (
        <div style={positionStyle}>
          <div style={{
            display: 'inline-flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0 10px',
            padding: preset.bgColor ? '8px 20px' : undefined,
            background: preset.bgColor,
            borderRadius: preset.bgColor ? 8 : undefined,
          }}>
            {currentGroup.words.map((w, i) => {
              const isActive = currentTime >= w.start && currentTime <= w.end + 0.1;
              const displayWord = preset.uppercase ? w.word.toUpperCase() : w.word;
              return (
                <span
                  key={i}
                  style={{
                    fontFamily,
                    fontSize,
                    fontWeight: 900,
                    color: isActive ? preset.activeColor : color,
                    textShadow,
                    lineHeight: 1.15,
                    display: 'inline-block',
                  }}
                >
                  {displayWord}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
