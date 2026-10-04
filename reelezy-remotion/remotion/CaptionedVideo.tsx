import { AbsoluteFill, Video, Audio, useCurrentFrame, useVideoConfig } from "remotion";
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

const PRESETS: Record<string, {
  fontFamily: string;
  fontSize: number;
  color: string;
  activeColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  position: 'top' | 'center' | 'bottom';
  wordsPerGroup: number;
}> = {
  bold_center: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 52,
    color: '#FFFFFF',
    activeColor: '#D85A30',
    strokeColor: '#000000',
    strokeWidth: 3,
    position: 'bottom',
    wordsPerGroup: 3,
  },
  minimal_bottom: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 38,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
    position: 'bottom',
    wordsPerGroup: 5,
  },
  coral_pop: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 48,
    color: '#F1EFE8',
    activeColor: '#D85A30',
    position: 'bottom',
    wordsPerGroup: 3,
  },
  word_by_word: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 64,
    color: '#FFFFFF',
    activeColor: '#D85A30',
    strokeColor: '#000000',
    strokeWidth: 4,
    position: 'center',
    wordsPerGroup: 1,
  },
  typewriter: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 42,
    color: '#FFFFFF',
    activeColor: '#FFFFFF',
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
  const currentTime = frame / fps;

  const presetKey = captionStyle.preset || 'bold_center';
  const preset = PRESETS[presetKey] || PRESETS.bold_center;

  const fontFamily = captionStyle.fontFamily || preset.fontFamily;
  const fontSize = captionStyle.fontSize || preset.fontSize;
  const color = captionStyle.color || preset.color;
  const position = captionStyle.position || preset.position;

  const groups = groupWords(words, preset.wordsPerGroup);
  const currentGroup = groups.find(g => currentTime >= g.start && currentTime <= g.end + 0.1);

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: '5%',
    right: '5%',
    textAlign: 'center',
    ...(position === 'bottom' ? { bottom: '12%' } : {}),
    ...(position === 'top' ? { top: '8%' } : {}),
    ...(position === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : {}),
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {musicSrc && <Audio src={musicSrc} volume={0.6} />}

      {currentGroup && (
        <div style={positionStyle}>
          <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 8px' }}>
            {currentGroup.words.map((w, i) => {
              const isActive = currentTime >= w.start && currentTime <= w.end;
              return (
                <span
                  key={i}
                  style={{
                    fontFamily,
                    fontSize,
                    fontWeight: 700,
                    color: isActive ? preset.activeColor : color,
                    textShadow: preset.strokeColor
                      ? `${preset.strokeWidth}px ${preset.strokeWidth}px 0 ${preset.strokeColor}, -${preset.strokeWidth}px -${preset.strokeWidth}px 0 ${preset.strokeColor}, ${preset.strokeWidth}px -${preset.strokeWidth}px 0 ${preset.strokeColor}, -${preset.strokeWidth}px ${preset.strokeWidth}px 0 ${preset.strokeColor}`
                      : undefined,
                    lineHeight: 1.2,
                    display: 'inline-block',
                    transition: 'color 0.05s',
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
