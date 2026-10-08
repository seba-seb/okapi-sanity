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
import { Box } from "./box/Box";
import { HorizontalScroll } from "./horizontalScroll/HorizontalScroll";
import { StackCards } from "./stackCards/StackCards";
import { Marquee } from "./marquee/Marquee";
import { TextScrub } from "./textScrub/TextScrub";
import { BigType } from "./bigType/BigType";
import { ParallaxMedia } from "./parallaxMedia/ParallaxMedia";

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
  box: Box,
  horizontalScroll: HorizontalScroll,
  stackCards: StackCards,
  marquee: Marquee,
  textScrub: TextScrub,
  bigType: BigType,
  parallaxMedia: ParallaxMedia,
};

