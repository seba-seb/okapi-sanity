import { editable } from "@/core/sanity/dataAttr";
import { urlForImage } from "@/core/sanity/image";
import { clean } from "@/core/lib/clean";
import { PLACEHOLDER_IMAGE } from "@/blocks/defaults";
import type { SanityImage } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";

type CardLayout = "imageTop" | "imageBackground" | "simple";

type CardData = {
  layout?: CardLayout;
  image?: SanityImage;
  heading?: string;
  body?: string;
  href?: string;
};

export function Card({ block, path, ctx }: BlockProps<CardData & any>) {
  const c = clean(block);
  const layout: CardLayout = c.layout ?? "imageTop";
  const showImage = layout !== "simple";
  const assetRef = block.image?.asset?._ref;
  // No image yet → show the placeholder so a fresh card isn't blank.
  const src = showImage
    ? assetRef
      ? urlForImage(block.image).width(1200).url()
      : PLACEHOLDER_IMAGE
    : null;
  const isBackground = layout === "imageBackground" && showImage;
  const alt = c.image?.alt ?? "";

  const className = `ok-card ok-card--${layout}${showImage ? "" : " ok-card--noimage"}`;
  const edit = editable(ctx.documentId, ctx.documentType, path, block._type);

  const inner = (
    <>
      {isBackground && src ? (
        <img className="ok-card__bg" src={src} alt={alt} loading="lazy" />
      ) : null}
      {!isBackground && src ? (
        <div className="ok-card__media">
          <img src={src} alt={alt} loading="lazy" />
        </div>
      ) : null}
      {/* Cleaned (stega-free) text so the card stays a single overlay target. */}
      <div className="ok-card__body">
        {c.heading ? <h3 className="ok-card__title">{c.heading}</h3> : null}
        {c.body ? <p className="ok-card__text">{c.body}</p> : null}
      </div>
    </>
  );

  // Background image → flip the card to a dark theme so text stays readable.
  const props = {
    className,
    "data-ok-theme": isBackground ? "dark" : undefined,
    ...edit,
  };

  return c.href ? (
    <a href={c.href} {...props}>
      {inner}
    </a>
  ) : (
    <div {...props}>{inner}</div>
  );
}
