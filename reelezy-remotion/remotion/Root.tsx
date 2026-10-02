import { Composition } from "remotion";
import { ReelezyVideo, reelezySchema } from "./ReelezyVideo";

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
    </>
  );
};
