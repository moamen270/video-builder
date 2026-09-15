import React from "react";
import { Composition } from "remotion";
import { ResolvedManifest } from "@vb/engine/schema";
import { Short } from "./Short";
import { SAMPLE } from "./sample";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Short"
    component={Short}
    schema={ResolvedManifest}
    defaultProps={SAMPLE}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={SAMPLE.durationInFrames}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps, width: props.width, height: props.height })}
  />
);
