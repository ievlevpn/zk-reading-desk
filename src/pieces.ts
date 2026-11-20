// The pieces Reading Desk is composed of, each from the app's primitives (zk.ui): a section
// label, a heading with a link, an item beside its cover (the pair's side), a row of covers, a
// list of text lines, a segmented switch, and a grid of captioned covers. The app draws them in
// its own type and greys. The one place pixels enter is sizing (below): a cover is about as wide
// on every Kindle, so a Scribe holds more of them rather than bigger ones.

import { ref } from "./data";

type Block = zk.ui.Block;

/** The app's page margin and medium and large gaps, in zk.display's pixels (300 ppi). */
const MARGIN = 60;
export const MEDIUM = 36;
export const LARGE = 60;

/** The page's width inside its margins. */
export const pageWidth = () => zk.display.width - 2 * MARGIN;

/** `px` as a share of a row `width` wide with two children at a medium gap (a percent is of what the gap leaves). */
export const share = (px: number, width: number): zk.ui.Percent =>
  `${Math.min(100, Math.max(1, Math.round((100 * px) / (width - MEDIUM))))}%`;

/** How many tiles of about `px` a row `width` wide holds at `gap` pixels between them. */
export const perRow = (px: number, width: number, gap: number) => Math.max(1, Math.round((width + gap) / (px + gap)));

/** A section label: small sans caps, tracked, secondary ("PINNED", "BOOK"). */
export const label = (text: string) => zk.ui.text(text, { style: "label", caps: true });

/** A serif bold title, cut at `lines`. */
const title = (text: string, size: "xsmall" | "small" | "body", lines: number) =>
  zk.ui.text(text || "Untitled", { font: "serif", weight: "bold", size, lines });

/** Secondary sans text, one line unless said. */
const meta = (text: string, size: "xsmall" | "small" = "small", lines = 1) =>
  zk.ui.text(text, { font: "sans", size, tone: "secondary", lines });

/** A link as a heading's ("All 9 ›"), on a line of its own at its end. */
export const endLink = (text: string, id: string) =>
  zk.ui.text(text, { id, align: "end", font: "sans", size: "body", weight: "medium", tone: "ink" });

/** A heading: its label on the left, a link on the right ("All 9 ›"), tapped by `link.id`. */
export function heading(text: string, link?: { id: string; text: string }): Block {
  return zk.ui.row([
    label(text),
    link && zk.ui.text(link.text, { id: link.id, width: "auto", font: "sans", size: "body", weight: "medium", tone: "ink" }),
  ]);
}

/**
 * The pair's side: a kicker over the item's cover, and beside it the title (up to 3 lines), the
 * authors, and at the bottom the bar (once started) and a meta line. `cover`: the cover's share
 * of the side; `titleLines`: where the title is cut.
 */
export function pair(side: {
  kicker: string;
  item: zk.Item;
  authors: string;
  meta: string;
  cover: zk.ui.Percent;
  titleLines: number;
}): Block {
  const { item } = side;
  return zk.ui.column([
    label(side.kicker),
    zk.ui.item(
      ref(item),
      zk.ui.row(
        [
          zk.ui.cover(ref(item), { width: side.cover }),
          zk.ui.column(
            [
              title(item.title, "body", side.titleLines),
              side.authors && meta(side.authors, "small", 2),
              zk.ui.spacer(),
              item.progress !== null && zk.ui.progress(item.progress),
              meta(side.meta),
            ],
            { gap: "xsmall" },
          ),
        ],
        { align: "stretch", gap: "medium" },
      ),
    ),
  ]);
}

/**
 * One row of `columns` small covers (never more: what doesn't fit isn't drawn), each an item with
 * a bar under it once it was opened; no captions.
 */
export function shelfRow(items: zk.Item[], columns: number): Block {
  return zk.ui.grid(
    items.map((i) =>
      zk.ui.item(ref(i), zk.ui.column([zk.ui.cover(ref(i)), i.progress !== null && zk.ui.progress(i.progress)])),
    ),
    { columns, rows: 1, gap: "medium" },
  );
}

/** Text lines, one an item: its title (one line) over its byline, and on the right a short word. */
export function lines(rows: { item: zk.Item; byline: string; right: string }[]): Block[] {
  return rows.map(({ item, byline, right }) =>
    zk.ui.item(
      ref(item),
      zk.ui.row(
        [
          zk.ui.column([title(item.title, "body", 1), byline && meta(byline)], { gap: "xsmall" }),
          right && zk.ui.text(right, { width: "auto", font: "sans", size: "small", tone: "secondary" }),
        ],
        { align: "top", gap: "medium" },
      ),
    ),
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
          radius: "small",
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
const barSlot = (item: zk.Item) =>
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
