"use client";

import { useEffect, useRef } from "react";

import { editable } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import { rem } from "@/lib/style";
import { LOGO3D_PRESETS } from "@/lib/logo3dPresets";
import type { Logo3dController } from "./logo3dScene";
import type { BlockProps } from "./props";

type Logo3dData = {
  preset?: string;
  customSvg?: string;
  color?: "primary" | "secondary";
  maxWidth?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  grain?: number;
};

/** The SVG markup for a block: the pasted custom SVG, or the chosen preset. */
function resolveSvg(preset?: string, customSvg?: string): string | null {
  if (preset === "custom") return customSvg?.trim() || null;
  const found = LOGO3D_PRESETS.find((p) => p.key === preset);
  return (found ?? LOGO3D_PRESETS[0]).svg;
}

export function Logo3d({ block, path, ctx }: BlockProps<Logo3dData & any>) {
  const c = clean(block);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Logo3dController | null>(null);

  const svg = resolveSvg(c.preset, c.customSvg);
  // Primary → brand color (purple in light/dark, white in Brand theme);
  // Secondary → the text color. Both resolve per the section's data-theme.
  const color = c.color === "secondary" ? "var(--fg)" : "var(--brand)";

  // Build (and only rebuild) the scene when the SHAPE changes. The <canvas> is
  // keyed by `svg`, so each shape gets a fresh canvas + WebGL context — reusing
  // one canvas across scene teardowns is unreliable (stale context → the logo
  // sometimes stops updating). Color is applied in place (next effect), so
  // switching color is instant and never rebuilds.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !svg) return;

    let dispose: (() => void) | null = null;
    let cancelled = false;

    const rotation = {
      x: c.rotationX ?? 0,
      y: c.rotationY ?? 0,
      z: c.rotationZ ?? 0,
    };

    // Lazy-load three.js (and the scene) only when a 3D logo is on the page.
    void import("./logo3dScene").then(({ initLogo3dScene }) => {
      if (cancelled || !canvasRef.current) return;
      const controller = initLogo3dScene(canvasRef.current, svg, {
        rotation,
        grain: c.grain,
        docId: ctx.documentId,
        path,
      });
      sceneRef.current = controller;
      dispose = controller.dispose;
    });

    return () => {
      cancelled = true;
      dispose?.();
      sceneRef.current = null;
    };
  }, [svg]);

  // Apply color changes in place — instant, no scene rebuild. (No-op until the
  // scene has finished its async init, which reads the initial color itself.)
  useEffect(() => {
    sceneRef.current?.setColor();
  }, [color]);

  return (
    <div
      className="logo3d"
      // Full-width by default; `maxWidth` (drag handle, in ch — see CanvasResizer)
      // caps + centers it. Aspect ratio ties height to width so the box tracks
      // the shape instead of leaving dead space above/below.
      style={{
        position: "relative", // anchors the on-canvas grain slider (draft mode)
        width: "100%",
        maxWidth: rem(c.maxWidth),
        marginInline: "auto",
        aspectRatio: "1 / 1",
        alignSelf: "stretch",
      }}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      {svg ? (
        <canvas
          // Keyed by shape → a fresh canvas (and WebGL context) per shape.
          key={svg}
          ref={canvasRef}
          className="logo3d__canvas"
          style={{ display: "block", width: "100%", height: "100%", color }}
        />
      ) : null}
    </div>
  );
}
