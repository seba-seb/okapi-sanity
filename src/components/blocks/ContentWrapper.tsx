import { editable } from "@/sanity/dataAttr";
import type { Block } from "@/lib/types";
import type { BlockProps } from "./props";
import { Blocks } from "../BlockRenderer";

type ContentWrapperData = {
  content?: Block[];
};

/**
 * A prose stack for the copy blocks. The child blocks provide the vertical
 * rhythm via their own margins; `.content-wrapper` (globals.css) trims the
 * first child's top margin and the last child's bottom margin so it sits flush.
 */
export function ContentWrapper({
  block,
  path,
  ctx,
}: BlockProps<ContentWrapperData & any>) {
  if (!block.content?.length) return null;
  return (
    <div
      className="content-wrapper"
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <Blocks blocks={block.content} pathPrefix={`${path}.content`} ctx={ctx} />
    </div>
  );
}
