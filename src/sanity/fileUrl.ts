import { dataset, projectId } from "./env";

/**
 * Builds a CDN URL for a Sanity file asset directly from its `_ref`, so we
 * don't need to dereference the asset in every GROQ query.
 * Ref format: `file-<assetId>-<extension>`.
 */
export function fileUrlFromRef(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const [, id, extension] = ref.split("-");
  if (!id || !extension) return undefined;
  return `https://cdn.sanity.io/files/${projectId}/${dataset}/${id}.${extension}`;
}
