import { editable } from "@/core/sanity/dataAttr";
import { fileUrlFromRef } from "@/core/sanity/fileUrl";
import { urlForImage } from "@/core/sanity/image";
import { clean } from "@/core/lib/clean";
import { px } from "@/theme/style";
import type { SanityImage } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";

type LoopingVideoData = {
  videoFile?: { asset?: { _ref?: string } };
  externalUrl?: string;
  poster?: SanityImage;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
  autoplay?: boolean;
  controls?: boolean;
  radius?: number;
  maxWidth?: number;
};

export function LoopingVideo({
  block,
  path,
  ctx,
}: BlockProps<LoopingVideoData & any>) {
  const c = clean(block);
  const src = fileUrlFromRef(c.videoFile?.asset?._ref) ?? c.externalUrl;
  if (!src) return null;

  const poster = block.poster?.asset?._ref
    ? urlForImage(block.poster).width(1600).url()
    : undefined;
  const hasRatio = c.aspectRatio && c.aspectRatio !== "auto";
  const autoplay = c.autoplay !== false;

  return (
    <div
      className={`ok-media ${hasRatio ? "ok-media--ratio" : ""}`}
      style={
        {
          maxWidth: px(c.maxWidth),
          borderRadius: px(c.radius),
          aspectRatio: hasRatio ? c.aspectRatio : undefined,
          alignSelf: c.maxWidth ? "flex-start" : "stretch",
          "--ok-fit": c.objectFit ?? "cover",
        } as React.CSSProperties
      }
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <video
        src={src}
        poster={poster}
        autoPlay={autoplay}
        loop
        muted
        playsInline
        controls={!!c.controls}
        preload="metadata"
      />
    </div>
  );
}
