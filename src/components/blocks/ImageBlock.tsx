import { editable } from "@/sanity/dataAttr";
import { urlForImage } from "@/sanity/image";
import { clean } from "@/lib/clean";
import { PLACEHOLDER_IMAGE } from "@/lib/blockDefaults";
import type { SanityImage } from "@/lib/types";
import type { BlockProps } from "./props";

type ImageBlockData = {
  image?: SanityImage;
  aspectRatio?: string;
  customAspectRatio?: string;
  objectFit?: "cover" | "contain";
  radius?: "none" | "main";
};

export function ImageBlock({ block, path, ctx }: BlockProps<ImageBlockData & any>) {
  const ref = block.image?.asset?._ref;

  const c = clean(block);
  // No image yet → show the placeholder so a fresh block isn't blank.
  const src = ref ? urlForImage(block.image).width(1800).url() : PLACEHOLDER_IMAGE;

  // "custom" pulls the typed ratio; anything but "auto" (or an empty custom)
  // constrains the box.
  const ratio =
    c.aspectRatio === "custom" ? c.customAspectRatio?.trim() : c.aspectRatio;
  const hasRatio = !!ratio && ratio !== "auto";

  return (
    <figure
      className={`media ${hasRatio ? "media--ratio" : ""}`}
      style={
        {
          borderRadius: c.radius === "main" ? "var(--radius-main)" : undefined,
          aspectRatio: hasRatio ? ratio : undefined,
          alignSelf: "stretch",
          margin: 0,
          "--fit": c.objectFit ?? "cover",
        } as React.CSSProperties
      }
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <img src={src} alt={c.image?.alt ?? ""} loading="lazy" />
    </figure>
  );
}
