// Studio colours, per project. One source for the Sanity Studio theme
// (sanity.config.ts → @sanity/themer buildTheme) and the Okapi Editor UI
// (selection outlines, active chips, chat bubbles). Change them here only.
//
// Only the accent and the backgrounds are customised: text, borders and the
// state tones (green/yellow/red/purple) stay Sanity's own, so a Studio upgrade
// can't leave the theme half-broken.

/** Brand colour: primary buttons, focus rings, links, editor selection. */
export const STUDIO_ACCENT = "#C2562C";
/** Lighter accent for secondary UI (hover outlines in the canvas). */
export const STUDIO_ACCENT_SOFT = "#F29B6B";
/** Dark-mode Studio background (light mode keeps Sanity's white). */
export const STUDIO_BG_DARK = "#16100D";

// Editor radii, matched to Sanity UI's own scale [0, 1, 3, 6, 9, 12, 21] so the
// Okapi Editor looks like the rest of the Studio (the Studio itself isn't changed).
/** Buttons, chips, inputs, rows — Sanity UI radius index 2. */
export const STUDIO_RADIUS_CONTROL = 3;
/** Popovers, field groups, chat bubbles — Sanity UI radius index 3. */
export const STUDIO_RADIUS_PANEL = 6;
