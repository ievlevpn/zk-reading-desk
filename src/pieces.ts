// Shared e-ink UI pieces composed from the app's primitives (zk.ui): kickers, tactile pills,
// segmented switches, aligned progress bar slots, and captioned cover grids.

import { ref } from "./data";

export type Block = zk.ui.Block;

/** The app's page margin and standard gaps, in zk.display's pixels (300 ppi). */
const MARGIN = 60;
export const MEDIUM = 36;
export const LARGE = 60;

/** The page's width inside its margins. */
export const pageWidth = () => zk.display.width - 2 * MARGIN;
/** Scribe-class wide screen. */
export const isWide = () => zk.display.width >= 1500;
/** Scribe-class tall screen. */
export const isTall = () => zk.display.height >= 2000;
/** Basic Kindle or landscape Paperwhite: tighter gaps and line caps. */
export const isShort = () => zk.display.height < 1400;

/** How many tiles of about `px` a row `width` wide holds at `gap` pixels between them. */
export const perRow = (px: number, width: number, gap: number) => Math.max(1, Math.round((width + gap) / (px + gap)));

/** Clean item title fallback. */
export const cleanTitle = (item: zk.Item) => item.title || "Untitled";

/** Small tracked uppercase section kicker ("OPEN ON THE DESK", "PINNED SHELF"). */
export const kicker = (text: string, tone: "ink" | "secondary" | "inverse" = "secondary") =>
  zk.ui.text(text, { font: "sans", size: "xsmall", weight: "bold", caps: true, tone });

/** A serif bold title, cut at `lines`, with MicroTeX math rendering enabled. */
export const title = (text: string, size: "xsmall" | "small" | "body" | "large" | "title", lines: number) =>
  zk.ui.text(text || "Untitled", { font: "serif", weight: "bold", size, lines, math: true });

/** Secondary sans text, one line unless said. */
export const meta = (text: string, size: "xsmall" | "small" = "small", lines = 1) =>
  zk.ui.text(text, { font: "sans", size, tone: "secondary", lines });

/** A compact tactile pill (filter tab, drawer chip, or action pill). */
export function pill(
  text: string,
  opts: {
    id?: string;
    active?: boolean;
    light?: boolean;
    border?: zk.ui.Border;
    radius?: zk.ui.Radius;
    caps?: boolean;
  } = {},
): Block {
  const fill: zk.ui.Fill = opts.active ? "ink" : opts.light ? "light" : "none";
  const border: zk.ui.Border = opts.active ? "none" : (opts.border ?? "thin");
  return zk.ui.box(
    zk.ui.text(` ${text} `, {
      font: "sans",
      size: "xsmall",
      weight: opts.active ? "bold" : "medium",
      caps: !!opts.caps,
      lines: 1,
      ...(opts.active ? {} : { tone: "ink" }),
    }),
    {
      id: opts.id,
      pad: "xsmall",
      fill,
      border,
      radius: opts.radius ?? "small",
      width: "auto",
    },
  );
}

/** A segmented switch: one framed row of segments, the selected one in ink; a tap sends its id. */
export function segmented(segments: { id: string; text: string }[], selected: string): Block {
  return zk.ui.box(
    zk.ui.row(
      segments.map((s) =>
        zk.ui.box(zk.ui.text(s.text, { align: "center", font: "sans", size: "body", weight: "medium" }), {
          id: s.id,
          pad: "small",
          fill: s.id === selected ? "ink" : "none",
        }),
      ),
      { gap: "none" },
    ),
    { border: "thin", radius: "small" },
  );
}

/**
 * The bar once opened, in a slot as tall whether or not there is one, so titles line up across a
 * grid's row: an empty box with xsmall padding (twice the bar's height, drawing nothing) sets it.
 */
export const barSlot = (item: zk.Item) =>
  zk.ui.row(
    [item.progress !== null && zk.ui.progress(item.progress), zk.ui.box(zk.ui.spacer(), { pad: "xsmall", width: "1%" })],
    { gap: "none", align: "top" },
  );

/** Covers in a grid of `columns` that pages, each with its bar once opened, its title and a caption under it. */
export function coverGrid(cells: { item: zk.Item; caption: string }[], columns: number): Block {
  return zk.ui.grid(
    cells.map(({ item, caption }) =>
      zk.ui.item(
        ref(item),
        zk.ui.column([
          zk.ui.cover(ref(item)),
          barSlot(item),
          zk.ui.column([title(item.title, "small", 1), caption && meta(caption, "xsmall")], { gap: "xsmall" }),
        ]),
      ),
    ),
    { columns, gap: "large" },
  );
}
