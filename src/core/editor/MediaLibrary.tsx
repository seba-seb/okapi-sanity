import { useCallback, useContext, useEffect, useState } from "react";
import { useClient, type SanityClient } from "sanity";
import { Box, Button, Dialog, Flex, Stack, Text, TextArea, TextInput } from "@sanity/ui";
import { Menu, MenuButton, MenuDivider, MenuItem } from "@sanity/ui/menu";
import { CheckmarkIcon } from "@sanity/icons/Checkmark";
import { CopyIcon } from "@sanity/icons/Copy";
import { DownloadIcon } from "@sanity/icons/Download";
import { EditIcon } from "@sanity/icons/Edit";
import { EllipsisHorizontalIcon } from "@sanity/icons/EllipsisHorizontal";
import { TrashIcon } from "@sanity/icons/Trash";

import { ASSET_MIME } from "./protocol";
import { UploadContext, type ImageValue } from "./FieldControls";
import { apiVersion } from "@/core/sanity/env";
import { STUDIO_ACCENT, STUDIO_RADIUS_CONTROL } from "@/theme/studio";

type Asset = {
  _id: string;
  _createdAt: string;
  url: string;
  originalFilename?: string;
  altText?: string;
  size?: number;
  extension?: string;
  metadata?: { lqip?: string; dimensions?: { width: number; height: number } };
};

// ponytail: newest 60 only; search reaches older ones. Add paging when a project outgrows that.
const FIELDS = `_id, _createdAt, url, originalFilename, altText, size, extension, metadata{ lqip, dimensions{ width, height } }`;
const QUERY = `*[_type == "sanity.imageAsset" && ($q == "" || originalFilename match $q || altText match $q)] | order(_createdAt desc)[0...60]{ ${FIELDS} }`;

const kb = (bytes = 0) => (bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} KB`);

/**
 * Image library (left column → Images): every image already in the dataset,
 * so the same file is reused instead of uploaded again. Click a thumbnail to
 * put it in the selected block's image field (`target`), or drag it onto any
 * image-bearing block on the canvas (ASSET_MIME → CanvasApp → "dropAsset").
 */
export function MediaLibrary({
  client,
  target,
  onPick,
  upload,
  pickOnUpload,
}: {
  client: SanityClient;
  /** Where a click puts the image ("the selected Card", "this block"), or null. */
  target: string | null;
  onPick: (assetId: string) => void;
  upload: (file: File) => Promise<unknown>;
  /** Picker mode: uploading a single file picks it right away. */
  pickOnUpload?: boolean;
}) {
  const [q, setQ] = useState("");
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Asset | null>(null);

  const load = useCallback(
    (query: string) =>
      client
        .fetch<Asset[]>(QUERY, { q: query.trim() ? `*${query.trim()}*` : "" })
        .then((a) => (setAssets(a), setError(null)))
        .catch((e: Error) => setError(e.message)),
    [client],
  );
  const remove = async (a: Asset) => {
    if (!window.confirm(`Delete “${a.originalFilename ?? a._id}” from the library? This can't be undone.`)) return;
    try {
      await client.delete(a._id);
      setDetails(null);
      await load(q);
    } catch {
      // Sanity refuses to delete an asset that a document (draft or published) still uses.
      setError(`“${a.originalFilename ?? a._id}” is still used on a page — remove it there first.`);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Hover-only ⋯ (no inline :hover); kept visible while its menu is open. */}
      <style>{`.ok-ml-item .ok-ml-more{opacity:0;transition:opacity .12s}.ok-ml-item:hover .ok-ml-more,.ok-ml-item:focus-within .ok-ml-more{opacity:1}`}</style>
      <div style={{ display: "flex", gap: 6 }}>
        <input type="search" placeholder="Search by file name" value={q} onChange={(e) => setQ(e.target.value)} style={input} />
        <label style={{ ...chip, display: "inline-block", opacity: busy ? 0.5 : 1 }} title="Upload images to the library">
          {busy ? "…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={busy}
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (!files.length) return;
              setBusy(true);
              try {
                const done = [];
                for (const f of files) done.push((await upload(f)) as ImageValue);
                const ref = done[0]?.asset?._ref;
                if (pickOnUpload && done.length === 1 && ref) return onPick(ref);
                await load(q);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6 }}>
        {target ? `Click to use in ${target} — or drag onto the canvas.` : "Drag onto an image on the canvas, or select an image block and click."}
      </div>
      {error ? <div style={{ fontSize: 12, color: "#e5484d" }}>{error}</div> : null}
      {assets === null ? (
        <div style={{ opacity: 0.6 }}>Loading…</div>
      ) : !assets.length ? (
        <div style={{ opacity: 0.6 }}>{q ? "No images match." : "No images yet — upload some."}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 6 }}>
          {assets.map((a) => {
            const d = a.metadata?.dimensions;
            const name = a.originalFilename ?? a._id;
            return (
              <div key={a._id} className="ok-ml-item" style={{ position: "relative" }}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(ASSET_MIME, a._id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => target && onPick(a._id)}
                title={d ? `${name} · ${d.width}×${d.height}` : name}
                style={{
                  padding: 0,
                  aspectRatio: "1",
                  border,
                  borderRadius: STUDIO_RADIUS_CONTROL,
                  overflow: "hidden",
                  width: "100%",
                  display: "block",
                  cursor: target ? "pointer" : "grab",
                  background: a.metadata?.lqip ? `center / cover url(${a.metadata.lqip})` : "color-mix(in srgb, currentColor 8%, transparent)",
                }}
                onFocus={(e) => (e.currentTarget.style.outline = `2px solid ${STUDIO_ACCENT}`)}
                onBlur={(e) => (e.currentTarget.style.outline = "")}
              >
                <img src={`${a.url}?w=200&h=200&fit=crop&auto=format`} alt={name} loading="lazy" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <div className="ok-ml-more" style={{ position: "absolute", top: 4, right: 4 }}>
                <MenuButton
                  id={`ok-ml-${a._id}`}
                  popover={{ placement: "bottom-end", portal: true }}
                  button={<Button icon={EllipsisHorizontalIcon} mode="default" tone="default" padding={2} fontSize={1} aria-label="Image options" title="Options" />}
                  menu={
                    <Menu>
                      <Box padding={3} style={{ maxWidth: 240 }}>
                        <Stack gap={2}>
                          <Text size={1} weight="semibold" textOverflow="ellipsis">{name}</Text>
                          <Text size={1} muted>
                            {[d && `${d.width}×${d.height}`, kb(a.size), a.extension?.toUpperCase()].filter(Boolean).join(" · ")}
                          </Text>
                        </Stack>
                      </Box>
                      <MenuDivider />
                      {target ? <MenuItem icon={CheckmarkIcon} text={`Use in ${target}`} onClick={() => onPick(a._id)} /> : null}
                      <MenuItem icon={EditIcon} text="Rename & alt text…" onClick={() => setDetails(a)} />
                      <MenuItem icon={CopyIcon} text="Copy URL" onClick={() => navigator.clipboard.writeText(a.url)} />
                      <MenuItem icon={DownloadIcon} text="Download original" onClick={() => window.open(`${a.url}?dl=`, "_blank")} />
                      <MenuDivider />
                      <MenuItem icon={TrashIcon} tone="critical" text="Delete…" onClick={() => remove(a)} />
                    </Menu>
                  }
                />
              </div>
              </div>
            );
          })}
        </div>
      )}
      {details ? (
        <AssetDetails
          asset={details}
          onClose={() => setDetails(null)}
          onDelete={() => remove(details)}
          onSave={async (patch) => {
            await client.patch(details._id).set(patch).commit();
            setDetails(null);
            await load(q);
          }}
        />
      ) : null}
    </div>
  );
}

/** Library-level details: file name + the image's alt text. */
function AssetDetails({ asset: a, onClose, onSave, onDelete }: { asset: Asset; onClose: () => void; onSave: (p: { originalFilename: string; altText: string }) => Promise<void>; onDelete: () => void }) {
  const [name, setName] = useState(a.originalFilename ?? "");
  const [alt, setAlt] = useState(a.altText ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const d = a.metadata?.dimensions;
  return (
    <Dialog
      id="ok-asset-details"
      header="Image details"
      width={1}
      onClose={onClose}
      onClickOutside={onClose}
      footer={
        <Flex padding={3} gap={2} justify="space-between">
          <Button icon={TrashIcon} mode="bleed" tone="critical" text="Delete" onClick={onDelete} />
          <Flex gap={2}>
            <Button mode="ghost" text="Cancel" onClick={onClose} />
            <Button
              tone="primary"
              text={saving ? "Saving…" : "Save"}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSave({ originalFilename: name.trim() || (a.originalFilename ?? ""), altText: alt.trim() });
                } catch (e) {
                  setErr((e as Error).message);
                  setSaving(false);
                }
              }}
            />
          </Flex>
        </Flex>
      }
    >
      <Box padding={4}>
        <Stack gap={4}>
          <img src={`${a.url}?w=640&fit=max&auto=format`} alt={alt} style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 4, background: "color-mix(in srgb, currentColor 6%, transparent)" }} />
          <Text size={1} muted>
            {[d && `${d.width}×${d.height}px`, kb(a.size), a.extension?.toUpperCase(), `uploaded ${new Date(a._createdAt).toLocaleDateString()}`].filter(Boolean).join(" · ")}
          </Text>
          <Stack gap={2}>
            <Text size={1} weight="semibold">File name</Text>
            <TextInput value={name} onChange={(e) => setName(e.currentTarget.value)} />
          </Stack>
          <Stack gap={2}>
            <Text size={1} weight="semibold">Alt text</Text>
            <TextArea rows={2} value={alt} onChange={(e) => setAlt(e.currentTarget.value)} placeholder="Describe the image for screen readers and search" />
            <Text size={1} muted>Belongs to the image: used everywhere it appears on the site.</Text>
          </Stack>
          {err ? <Text size={1} style={{ color: "#e5484d" }}>{err}</Text> : null}
        </Stack>
      </Box>
    </Dialog>
  );
}

const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL, whiteSpace: "nowrap", flexShrink: 0 } as const;
const input = { flex: 1, minWidth: 0, padding: "4px 8px", font: "inherit", fontSize: 12, color: "inherit", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL } as const;

/**
 * The properties panel's image control (via ImageFieldContext): preview, the
 * image's own alt text (stored on the asset, so it follows the image to every
 * block), and Replace/Choose → the library, with Upload inside it.
 */
export function ImageField({ value, onChange }: { value: ImageValue | undefined; onChange: (v: unknown) => void }) {
  const client = useClient({ apiVersion });
  const upload = useContext(UploadContext);
  const ref = value?.asset?._ref;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [alt, setAlt] = useState("");
  const [saved, setSaved] = useState<"" | "saving" | "saved" | "error">("");
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setAsset(null);
    if (!ref) return;
    let live = true;
    client.fetch<Asset | null>(`*[_id == $id][0]{ ${FIELDS} }`, { id: ref }).then((a) => {
      if (!live) return;
      setAsset(a);
      setAlt(a?.altText ?? "");
    });
    return () => {
      live = false;
    };
  }, [client, ref]);

  const saveAlt = async () => {
    if (!ref || alt.trim() === (asset?.altText ?? "")) return;
    setSaved("saving");
    try {
      await client.patch(ref).set({ altText: alt.trim() }).commit();
      setAsset((a) => (a ? { ...a, altText: alt.trim() } : a));
      setSaved("saved");
    } catch {
      setSaved("error");
    }
  };
  const d = asset?.metadata?.dimensions;

  return (
    <Stack gap={3}>
      {ref ? (
        <>
          <div style={{ border, borderRadius: STUDIO_RADIUS_CONTROL, overflow: "hidden", background: "color-mix(in srgb, currentColor 6%, transparent)" }}>
            {asset ? <img src={`${asset.url}?w=600&fit=max&auto=format`} alt={alt} style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "contain" }} /> : <div style={{ height: 120 }} />}
          </div>
          {asset ? (
            <Text size={1} muted textOverflow="ellipsis">
              {[asset.originalFilename, d && `${d.width}×${d.height}`, kb(asset.size)].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          <Stack gap={2}>
            <Flex justify="space-between" align="center">
              <Text size={1} weight="semibold">Alt text</Text>
              <Text size={0} muted>{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : saved === "error" ? "Couldn't save" : ""}</Text>
            </Flex>
            <TextArea
              rows={2}
              value={alt}
              onChange={(e) => (setAlt(e.currentTarget.value), setSaved(""))}
              onBlur={saveAlt}
              placeholder="Describe the image for screen readers and search"
            />
            <Text size={0} muted>Belongs to the image — used everywhere it appears.</Text>
          </Stack>
          <Flex gap={2}>
            <Button mode="ghost" text="Replace…" onClick={() => setPicking(true)} style={{ flex: 1 }} />
            <Button mode="bleed" tone="critical" icon={TrashIcon} aria-label="Remove image" title="Remove image" onClick={() => onChange(undefined)} />
          </Flex>
        </>
      ) : (
        <Button mode="ghost" text="Choose image…" onClick={() => setPicking(true)} />
      )}
      <Text size={0} muted>Or drop an image file on it in the canvas.</Text>
      {picking && upload ? (
        <Dialog id="ok-image-picker" header="Choose an image" width={2} onClose={() => setPicking(false)} onClickOutside={() => setPicking(false)}>
          <Box padding={4}>
            <MediaLibrary
              client={client}
              target="this block"
              upload={upload}
              pickOnUpload
              onPick={(id) => {
                // Keep the rest (hotspot/crop reset with the new asset).
                const { hotspot: _h, crop: _c, ...rest } = value ?? {};
                onChange({ ...rest, _type: "image", asset: { _type: "reference", _ref: id } });
                setPicking(false);
              }}
            />
          </Box>
        </Dialog>
      ) : null}
    </Stack>
  );
}
