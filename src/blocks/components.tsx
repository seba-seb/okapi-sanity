import type { ComponentType } from "react";

import type { ContentBlockType } from "./meta";
import type { BlockProps } from "./_shared/props";
import { Eyebrow } from "./eyebrow/Eyebrow";
import { Heading } from "./heading/Heading";
import { Paragraph } from "./paragraph/Paragraph";
import { Button } from "./button/Button";
import { ButtonWrapper } from "./buttonWrapper/ButtonWrapper";
import { ImageBlock } from "./imageBlock/ImageBlock";
import { LoopingVideo } from "./loopingVideo/LoopingVideo";
import { ContentWrapper } from "./contentWrapper/ContentWrapper";
import { Card } from "./card/Card";
import { Slider } from "./slider/Slider";
import { Grid } from "./grid/Grid";
import { Logo3d } from "./logo3d/Logo3d";
import { CanvasLogo3dEditor } from "./logo3d/CanvasLogo3dEditor";

/** Site side of the registry. Missing a type from meta.ts = type error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BLOCK_COMPONENTS: Record<ContentBlockType, ComponentType<BlockProps<any>>> = {
  eyebrow: Eyebrow,
  heading: Heading,
  paragraph: Paragraph,
  // A button placed directly in a section (not inside a Button Group).
  button: (props) => <Button {...props} standalone />,
  buttonWrapper: ButtonWrapper,
  imageBlock: ImageBlock,
  loopingVideo: LoopingVideo,
  contentWrapper: ContentWrapper,
  card: Card,
  slider: Slider,
  grid: Grid,
  logo3d: Logo3d,
};

/** Block-specific canvas tools, mounted in the preview next to the core ones. */
export const BLOCK_CANVAS_TOOLS: ComponentType[] = [CanvasLogo3dEditor];
