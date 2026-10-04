import { Composition } from "remotion";
import { ReelezyVideo, reelezySchema } from "./ReelezyVideo";
import { CaptionedVideo, captionedVideoSchema } from "./CaptionedVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelezyVideo"
        component={ReelezyVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={reelezySchema}
        defaultProps={{
          clips: [],
          width: 1080,
          height: 1920,
        }}
        calculateMetadata={async ({ props }) => {
          const fps = 30;
          const totalFrames = props.clips.reduce((sum, clip) => {
            return sum + Math.round(clip.durationInSeconds * fps);
          }, 0);
          return {
            durationInFrames: Math.max(totalFrames, 1),
            width: props.width,
            height: props.height,
          };
        }}
      />
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={captionedVideoSchema}
        defaultProps={{
          videoSrc: "",
          words: [],
          captionStyle: { preset: "bold_center" },
          width: 1080,
          height: 1920,
        }}
        calculateMetadata={async ({ props }) => {
          const lastWord = props.words[props.words.length - 1];
          const durationInFrames = lastWord
            ? Math.ceil((lastWord.end + 1) * 30)
            : 300;
          return {
            durationInFrames: Math.max(durationInFrames, 1),
            width: props.width,
            height: props.height,
          };
        }}
      />
    </>
  );
};
