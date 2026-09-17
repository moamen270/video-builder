import React from "react";
import { Composition } from "remotion";
import { ResolvedManifest } from "@vb/engine/schema";
import { Short } from "./Short";
import { SAMPLE } from "./sample";
import { Avatar, Cover, CoverProps } from "./brand/Brand";

export const RemotionRoot: React.FC = () => (
  <>
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
  {/* Brand stills (rendered with `vb brand` at frame 60). */}
  <Composition id="Avatar" component={Avatar} width={2048} height={2048} fps={30} durationInFrames={90} />
  <Composition
    id="Cover"
    component={Cover}
    schema={CoverProps}
    defaultProps={{ width: 2560, height: 1440, guides: false }}
    width={2560}
    height={1440}
    fps={30}
    durationInFrames={90}
    calculateMetadata={({ props }) => ({ width: props.width, height: props.height })}
  />
  </>
);
