import { editable, keyed } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import { px, responsiveVars } from "@/lib/style";
import type { Block, ResponsiveNumber } from "@/lib/types";
import type { BlockProps } from "./props";
import { Block as BlockView } from "../BlockRenderer";
import { SliderClient } from "./SliderClient";

type SliderData = {
  slides?: Block[];
  slidesPerView?: ResponsiveNumber;
  gap?: number;
  loop?: boolean;
  align?: "start" | "center";
  showArrows?: boolean;
  showDots?: boolean;
};

export function Slider({ block, path, ctx }: BlockProps<SliderData & any>) {
  if (!block.slides?.length) return null;
  const c = clean(block);

  const styleVars = {
    ...responsiveVars("slides", c.slidesPerView, {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    }),
    "--slide-gap": px(c.gap) ?? "24px",
  } as React.CSSProperties;

  // Slides are rendered on the server; the client wrapper only handles Embla.
  const slides = block.slides.map((slide: Block) => ({
    key: slide._key,
    node: (
      <BlockView
        block={slide}
        path={keyed(`${path}.slides`, slide._key)}
        ctx={ctx}
      />
    ),
  }));

  return (
    <SliderClient
      styleVars={styleVars}
      loop={c.loop !== false}
      align={c.align ?? "start"}
      showArrows={c.showArrows !== false}
      showDots={c.showDots !== false}
      editAttr={editable(ctx.documentId, ctx.documentType, path, block._type)}
      slides={slides}
    />
  );
}
