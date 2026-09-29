import type { SanityImageSource } from "@sanity/image-url";

export type ResponsiveNumber = {
  mobile?: number;
  tablet?: number;
  desktop?: number;
};

export type Theme = "light" | "dark" | "brand";

/** Named vertical-padding steps for a section (top / bottom). */
export type SectionPadding =
  | "none"
  | "even"
  | "small"
  | "medium"
  | "large"
  | "pageTop";

/** T-shirt gap steps between blocks, mapped to the `--space-*` scale. */
export type GapSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

/** A generic building block — the renderer switches on `_type`. */
export type Block = {
  _type: string;
  _key: string;
  [key: string]: unknown;
};

export type SanityImage = SanityImageSource & {
  alt?: string;
  asset?: { _ref?: string };
};

export type SectionData = Block & {
  _type: "section";
  theme?: Theme;
  content?: Block[];
  backgroundImage?: SanityImage;
  overlayOpacity?: number;
  paddingTop?: SectionPadding;
  paddingBottom?: SectionPadding;
  gap?: GapSize;
  contentAlign?: "start" | "center" | "end";
  fullHeight?: boolean;
};

export type Page = {
  _id: string;
  _type: "page";
  title?: string;
  slug?: { current?: string };
  sections?: SectionData[];
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: SanityImage;
};

/** Context threaded through the renderer for click-to-edit data attributes. */
export type RenderContext = {
  documentId: string;
  documentType: string;
};
