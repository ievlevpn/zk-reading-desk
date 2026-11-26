// The three selectable Home layouts for Reading Desk:
//   - Folio        ("folio")   — Editorial broadsheet: ink hero with last-highlight recall, shaded
//                                companion paper, inline shelf tabs + numbered catalog, commonplace
//   - Index Desk   ("index")   — Swiss typographic cards (zero covers): black/white active diptych,
//                                desk telemetry + Surprise me, 2×2 / 3×2 index-card grid, excerpt
//   - Reading Room ("atelier") — Calm full-width Book|Paper spotlight, captioned cover shelf with
//                                inline filter, side-by-side Inbox + Commonplace, collection drawers

import {
  type HighlightSummary,
  type PassagePick,
  authorsOf,
  bylineOf,
  countOf,
  isBook,
  percentOf,
  ref,
  same,
  todayStamp,
  typeLabel,
  whenOf,
} from "./data";
import { type Block, barSlot, cleanTitle, isShort, isTall, isWide, kicker, pill } from "./pieces";

export type FolioTab = "pinned" | "inbox" | "reading";
export type IndexFilter = "all" | "pinned" | "inbox";
export type AtelierMode = "book" | "paper";
export type AtelierShelf = "pinned" | "recent";

export interface HomeState {
  folioTab: FolioTab;
  indexFilter: IndexFilter;
  atelierMode: AtelierMode;
  atelierShelf: AtelierShelf;
}

export interface HomeModel {
  book?: zk.Item;
  paper?: zk.Item;
  hero?: zk.Item;
  recent: zk.Item[];
  pinned: zk.Item[];
  inbox: zk.Item[] | null;
  collections: zk.Collection[];
  colByKey: Map<string, zk.Collection>;
  hl: HighlightSummary;
  passage?: PassagePick;
}

const FIRST_USE =
  "Open a book or a paper and it will wait for you here. Pin items from an item's menu: long-press → More… → Pin to Home / Unpin.";

const pctNum = (i: zk.Item) => (i.progress === null ? null : Math.round(i.progress * 100));

function hlSnippetOf(hl: HighlightSummary, item: zk.Item, maxLen: number): string | null {
  const raw = hl.byItem[item.key]?.snippet?.trim();
  if (!raw) return null;
  return `“${raw.slice(0, maxLen)}${raw.length > maxLen ? "…" : ""}”`;
}

function colPathOf(colByKey: Map<string, zk.Collection>, item: zk.Item): string {
  const key = item.collections[0];
  return key ? (colByKey.get(key)?.path.join(" / ") ?? "") : "";
}

function activeLabel(item: zk.Item): string {
  return isBook(item) ? "BOOK" : "PAPER";
}

function sideMeta(item: zk.Item): string {
  if (item.openedAt === null) return "Not started";
  return [percentOf(item), whenOf(item.openedAt)].filter(Boolean).join(" · ");
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT A: "FOLIO" — Editorial Broadsheet
// ═══════════════════════════════════════════════════════════════════════════

function folioHeroCard(item: zk.Item, hl: HighlightSummary, colByKey: Map<string, zk.Collection>): Block {
  const colPath = colPathOf(colByKey, item);
  const stat = sideMeta(item).toUpperCase();
  const snippet = isShort() ? null : hlSnippetOf(hl, item, isWide() ? 145 : 115);

  const masthead = zk.ui.box(
    zk.ui.row([
      zk.ui.text(`NOW READING · ${activeLabel(item)}`, { font: "sans", size: "xsmall", weight: "bold", caps: true }),
      zk.ui.text(stat, { font: "sans", size: "xsmall", weight: "bold", lines: 1, width: "auto" }),
    ]),
    { fill: "ink", pad: "small" },
  );

  const coverW: zk.ui.Percent = isWide() ? "24%" : isShort() ? "20%" : "23%";
  const body = zk.ui.item(
    ref(item),
    zk.ui.box(
      zk.ui.row(
        [
          zk.ui.cover(ref(item), { width: coverW }),
          zk.ui.column(
            [
              zk.ui.text(cleanTitle(item), {
                font: "serif",
                size: isWide() ? "title" : "large",
                weight: "bold",
                lines: 2,
                math: true,
              }),
              zk.ui.text(
                [authorsOf(item, { most: 2, full: true }), item.year ?? "", colPath].filter(Boolean).join(" · "),
                { font: "sans", size: "small", tone: "secondary", lines: 1 },
              ),
              snippet && zk.ui.space("small"),
              snippet && zk.ui.text(snippet, { font: "serif", size: "small", italic: true, tone: "secondary", lines: isWide() ? 3 : 2 }),
              zk.ui.spacer(),
              item.progress !== null && zk.ui.progress(item.progress),
            ],
            { gap: "xsmall" },
          ),
        ],
        { align: "stretch", gap: "medium" },
      ),
      { pad: isShort() ? "small" : "medium" },
    ),
  );

  return zk.ui.box(zk.ui.column([masthead, body], { gap: "none" }), { border: "thick", radius: "none" });
}

function folioCompanionPaper(paper: zk.Item, wide: boolean): Block {
  const meta = [authorsOf(paper, { most: 2, full: true }), paper.year ?? ""].filter(Boolean).join(" · ");
  const stat = sideMeta(paper);
  if (wide) {
    return zk.ui.item(
      ref(paper),
      zk.ui.box(
        zk.ui.column(
          [
            zk.ui.row([
              kicker("ON THE DESK · PAPER"),
              zk.ui.text(typeLabel(paper), { font: "sans", size: "xsmall", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
            ]),
            zk.ui.divider(),
            zk.ui.text(cleanTitle(paper), { font: "serif", size: "large", weight: "bold", lines: 4, math: true }),
            meta && zk.ui.text(meta, { font: "sans", size: "small", tone: "secondary", lines: 2 }),
            zk.ui.spacer(),
            paper.progress !== null && zk.ui.progress(paper.progress),
            zk.ui.row([
              zk.ui.text(stat, { font: "sans", size: "small", weight: "medium", tone: "ink" }),
              zk.ui.text("Resume ›", { font: "sans", size: "small", weight: "medium", tone: "ink", lines: 1, width: "auto" }),
            ]),
          ],
          { gap: "small" },
        ),
        { fill: "light", pad: "medium", radius: "none" },
      ),
    );
  }
  return zk.ui.item(
    ref(paper),
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            kicker("COMPANION PAPER"),
            zk.ui.text(stat, { font: "sans", size: "xsmall", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
          ]),
          zk.ui.row(
            [
              zk.ui.column(
                [
                  zk.ui.text(cleanTitle(paper), { font: "serif", size: "body", weight: "bold", lines: 1, math: true }),
                  meta && zk.ui.text(meta, { font: "sans", size: "small", tone: "secondary", lines: 1 }),
                ],
                { gap: "xsmall" },
              ),
              zk.ui.text("Resume ›", { font: "sans", size: "small", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
            ],
            { align: "center", gap: "medium" },
          ),
          paper.progress !== null && zk.ui.progress(paper.progress),
        ],
        { gap: "xsmall" },
      ),
      { fill: "light", pad: "small", radius: "none" },
    ),
  );
}

function folioCatalogRow(item: zk.Item, idx: number, rightText: string): Block {
  const num = String(idx + 1).padStart(2, "0");
  const hasBar = item.progress !== null;
  const byline = bylineOf(item);
  return zk.ui.item(
    ref(item),
    zk.ui.row(
      [
        zk.ui.text(num, { font: "sans", size: "small", weight: "bold", tone: "secondary", lines: 1, width: "auto" }),
        zk.ui.column(
          [
            zk.ui.text(cleanTitle(item), { font: "serif", size: "body", weight: "bold", lines: 1, math: true }),
            byline && zk.ui.text(byline, { font: "sans", size: "small", tone: "secondary", lines: 1 }),
          ],
          { gap: "xsmall" },
        ),
        hasBar
          ? zk.ui.column(
              [
                zk.ui.text(rightText, { font: "sans", size: "small", weight: "medium", tone: "ink", align: "end", lines: 1 }),
                zk.ui.progress(item.progress!),
              ],
              { gap: "xsmall", width: isWide() ? "13%" : "17%" },
            )
          : zk.ui.text(rightText, { font: "sans", size: "small", weight: "medium", tone: "secondary", align: "end", lines: 1, width: "auto" }),
      ],
      { align: "center", gap: "medium" },
    ),
  );
}

export function renderFolio(d: HomeModel, state: HomeState): Block {
  const wide = isWide();
  const primary = d.book ?? d.hero;
  const companion = primary && d.paper && !same(ref(primary), ref(d.paper)) ? d.paper : undefined;

  const topSpread =
    primary && companion
      ? wide
        ? zk.ui.row(
            [
              zk.ui.column([folioHeroCard(primary, d.hl, d.colByKey)], { width: "63%" }),
              zk.ui.column([folioCompanionPaper(companion, true)], { width: "37%" }),
            ],
            { align: "stretch", gap: "medium" },
          )
        : zk.ui.column([folioHeroCard(primary, d.hl, d.colByKey), folioCompanionPaper(companion, false)], { gap: "small" })
      : primary
        ? folioHeroCard(primary, d.hl, d.colByKey)
        : null;

  const activeItems = [primary, companion].filter((x): x is zk.Item => !!x);
  const notHero = (i: zk.Item) => !activeItems.some((h) => same(ref(h), ref(i)));
  const pinnedList = d.pinned.filter(notHero);
  const inboxList = (d.inbox ?? []).filter(notHero);
  const readingList = d.recent.filter(notHero);

  const hasInbox = d.inbox !== null && d.inbox.length > 0;
  // Auto-resolve tab so first-time users without pins still see Reading or Inbox
  let tab: FolioTab = state.folioTab;
  if (tab === "inbox" && !hasInbox) tab = pinnedList.length > 0 ? "pinned" : "reading";
  if (tab === "pinned" && pinnedList.length === 0) tab = readingList.length > 0 ? "reading" : hasInbox ? "inbox" : "pinned";

  const hasAnyList = pinnedList.length > 0 || inboxList.length > 0 || readingList.length > 0;
  const tabs = zk.ui.row(
    [
      d.pinned.length > 0 && pill(`Pinned · ${d.pinned.length}`, { id: "ft-pinned", active: tab === "pinned", radius: "none" }),
      hasInbox && pill(`Inbox · ${countOf(d.inbox!.length, d.inbox!.length)}`, { id: "ft-inbox", active: tab === "inbox", radius: "none" }),
      d.recent.length > 0 && pill(`Reading · ${d.recent.length}`, { id: "ft-reading", active: tab === "reading", radius: "none" }),
      zk.ui.spacer(),
      zk.ui.text("Full desk ›", { id: `all-${tab}`, font: "sans", size: "small", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
    ],
    { align: "center", gap: "small" },
  );

  let middleBand: Block | null = null;
  if (hasAnyList) {
    if (wide && tab === "pinned" && pinnedList.length > 0 && inboxList.length > 0) {
      middleBand = zk.ui.column(
        [
          tabs,
          zk.ui.row(
            [
              zk.ui.column(
                [kicker("PINNED SHELF"), ...pinnedList.slice(0, 5).map((it, i) => folioCatalogRow(it, i, percentOf(it) || "New"))],
                { gap: "small", width: "52%" },
              ),
              zk.ui.column(
                [
                  kicker(`INBOX · ${countOf(d.inbox!.length, d.inbox!.length)} NEW`),
                  ...inboxList.slice(0, 5).map((it, i) => folioCatalogRow(it, i, whenOf(it.addedAt) || "New")),
                ],
                { gap: "small", width: "48%" },
              ),
            ],
            { align: "top", gap: "large" },
          ),
        ],
        { gap: "medium" },
      );
    } else {
      const items = tab === "inbox" ? inboxList : tab === "reading" ? readingList : pinnedList;
      const maxRows = isTall() ? 5 : isShort() ? 2 : 3;
      const rows = items.slice(0, maxRows).map((it, idx) =>
        folioCatalogRow(it, idx, tab === "inbox" ? whenOf(it.addedAt) || "New" : percentOf(it) || whenOf(it.addedAt) || "New"),
      );
      middleBand = zk.ui.column([tabs, ...rows], { gap: "small" });
    }
  }

  const firstUse = !topSpread && !middleBand;
  const commonplace =
    d.passage &&
    zk.ui.column(
      [
        zk.ui.divider(),
        zk.ui.row([
          kicker(`COMMONPLACE · ${todayStamp()}`),
          zk.ui.text("Next ↻", { id: "next-passage", font: "sans", size: "xsmall", weight: "bold", tone: "secondary", lines: 1, width: "auto" }),
        ]),
        zk.ui.quote({ id: "passage", text: d.passage.text, source: d.passage.source }),
      ],
      { gap: "xsmall" },
    );

  return zk.ui.column(
    [topSpread, middleBand, firstUse && zk.ui.text(FIRST_USE, { tone: "secondary" }), commonplace],
    { gap: isTall() ? "large" : "medium", fit: "trim" },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT B: "INDEX DESK" — Swiss Zettelkasten (Zero Redundant Covers)
// ═══════════════════════════════════════════════════════════════════════════

function indexActiveBook(book: zk.Item, hl: HighlightSummary): Block {
  const pct = pctNum(book);
  const hlCount = hl.byItem[book.key]?.count ?? 0;
  const snippet = isWide() ? hlSnippetOf(hl, book, 115) : null;
  const byline = [authorsOf(book, { most: 2, full: true }), book.year ?? ""].filter(Boolean).join(" · ");

  return zk.ui.item(
    ref(book),
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            zk.ui.text(`BOOK · ${typeLabel(book)}`, { font: "sans", size: "xsmall", weight: "bold", caps: true }),
            zk.ui.text((whenOf(book.openedAt) || "UP NEXT").toUpperCase(), {
              font: "sans",
              size: "xsmall",
              weight: "medium",
              lines: 1,
              width: "auto",
            }),
          ]),
          zk.ui.space("small"),
          zk.ui.text(cleanTitle(book), {
            font: "serif",
            size: isWide() ? "title" : "large",
            weight: "bold",
            lines: isShort() ? 2 : 3,
            math: true,
          }),
          byline && zk.ui.text(byline, { font: "sans", size: "small", lines: 1 }),
          snippet && zk.ui.space("small"),
          snippet && zk.ui.text(snippet, { font: "serif", size: "small", italic: true, lines: 2 }),
          zk.ui.spacer(),
          zk.ui.space("small"),
          zk.ui.row(
            [
              zk.ui.text(pct !== null ? `${pct}%` : "New", { font: "sans", size: "large", weight: "bold", lines: 1, width: "auto" }),
              zk.ui.text(
                hlCount > 0 ? `· ${hlCount} ${hlCount === 1 ? "highlight" : "highlights"}` : pct !== null ? "· in progress" : "· open book ›",
                { font: "sans", size: "small", lines: 1 },
              ),
            ],
            { align: "bottom", gap: "small" },
          ),
        ],
        { gap: "xsmall" },
      ),
      { fill: "ink", pad: isShort() ? "small" : "medium", radius: "small" },
    ),
  );
}

function indexActivePaper(paper: zk.Item): Block {
  const pct = pctNum(paper);
  const byline = [authorsOf(paper, { most: 2, full: true }), paper.year ?? ""].filter(Boolean).join(" · ");

  return zk.ui.item(
    ref(paper),
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            kicker(`PAPER · ${typeLabel(paper)}`),
            zk.ui.text((whenOf(paper.openedAt) || "UP NEXT").toUpperCase(), {
              font: "sans",
              size: "xsmall",
              weight: "medium",
              tone: "secondary",
              lines: 1,
              width: "auto",
            }),
          ]),
          zk.ui.space("small"),
          zk.ui.text(cleanTitle(paper), {
            font: "serif",
            size: isWide() ? "title" : "large",
            weight: "bold",
            lines: isShort() ? 2 : 3,
            math: true,
          }),
          byline && zk.ui.text(byline, { font: "sans", size: "small", tone: "secondary", lines: 1 }),
          zk.ui.spacer(),
          zk.ui.space("small"),
          paper.progress !== null && zk.ui.progress(paper.progress),
          zk.ui.row(
            [
              zk.ui.text(pct !== null ? `${pct}%` : "New", {
                font: "sans",
                size: "large",
                weight: "bold",
                tone: "ink",
                lines: 1,
                width: "auto",
              }),
              zk.ui.text("· open paper ›", { font: "sans", size: "small", tone: "secondary", lines: 1 }),
            ],
            { align: "bottom", gap: "small" },
          ),
        ],
        { gap: "xsmall" },
      ),
      { border: "thick", pad: isShort() ? "small" : "medium", radius: "small" },
    ),
  );
}

function indexMiniCard(item: zk.Item, badgeText?: string): Block {
  const pct = percentOf(item);
  const badge = badgeText ?? (pct || "NEW");
  const byline = bylineOf(item);
  return zk.ui.item(
    ref(item),
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            zk.ui.text(typeLabel(item), { font: "sans", size: "xsmall", weight: "bold", caps: true, tone: "secondary" }),
            zk.ui.text(badge, {
              font: "sans",
              size: "xsmall",
              weight: "bold",
              tone: pct ? "ink" : "secondary",
              lines: 1,
              width: "auto",
            }),
          ]),
          zk.ui.text(cleanTitle(item), { font: "serif", size: "body", weight: "bold", lines: 2, math: true }),
          byline && zk.ui.text(byline, { font: "sans", size: "xsmall", tone: "secondary", lines: 1 }),
          item.progress !== null ? zk.ui.progress(item.progress) : zk.ui.box(zk.ui.spacer(), { pad: "xsmall", width: "1%" }),
        ],
        { gap: "xsmall" },
      ),
      { border: "thin", pad: "small", radius: "small" },
    ),
  );
}

export function renderIndex(d: HomeModel, state: HomeState): Block {
  const wide = isWide();
  const inboxCount = d.inbox ? countOf(d.inbox.length, d.inbox.length) : null;
  const telemetryParts = [
    `${d.recent.length} READING`,
    inboxCount !== null ? `${inboxCount} INBOX` : null,
    d.hl.total > 0 ? `${d.hl.total} NOTES` : null,
  ].filter(Boolean);

  const telemetry = zk.ui.row(
    [
      zk.ui.text(telemetryParts.join("  ·  ") || "READING DESK", {
        font: "sans",
        size: "xsmall",
        weight: "bold",
        caps: true,
        tone: "secondary",
      }),
      pill("Surprise me", { id: "surprise", light: true, border: "none", radius: "round" }),
      zk.ui.text("Desk ›", { id: "all-reading", font: "sans", size: "small", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
    ],
    { align: "center", gap: "small" },
  );

  const diptychCards = [d.book && indexActiveBook(d.book, d.hl), d.paper && indexActivePaper(d.paper)].filter(
    (x): x is Block => !!x,
  );
  const diptych = diptychCards.length > 0 ? zk.ui.row(diptychCards, { align: "stretch", gap: "medium" }) : null;

  const activeKeys = new Set([d.book?.key, d.paper?.key].filter((k): k is string => !!k));
  const inboxRest = (d.inbox ?? []).filter((i) => !activeKeys.has(i.key));
  const pinnedRest = d.pinned.filter((i) => !activeKeys.has(i.key));
  const recentRest = d.recent.filter((i) => !activeKeys.has(i.key));
  const hasInbox = inboxRest.length > 0;

  let filter: IndexFilter = state.indexFilter;
  if (filter === "inbox" && !hasInbox) filter = "all";
  if (filter === "pinned" && pinnedRest.length === 0) filter = "all";

  // Deduplicated mixed pool: inbox + pinned + recent fallback
  const mixPool: zk.Item[] = [];
  const mixSeen = new Set<string>();
  const addToMix = (items: zk.Item[], cap: number) => {
    let added = 0;
    for (const it of items) {
      if (added >= cap) break;
      if (mixSeen.has(it.key)) continue;
      mixSeen.add(it.key);
      mixPool.push(it);
      added++;
    }
  };
  addToMix(inboxRest, wide ? 3 : 2);
  addToMix(pinnedRest, 6);
  addToMix(recentRest, 6);

  const deckPool = filter === "pinned" ? pinnedRest : filter === "inbox" ? inboxRest : mixPool;
  const cols = wide ? 3 : 2;
  const rows = isShort() ? 1 : 2;
  const inboxKeys = new Set((d.inbox ?? []).map((i) => i.key));
  const cards = deckPool.slice(0, cols * rows).map((it) => {
    const isInbox = inboxKeys.has(it.key);
    const when = whenOf(it.addedAt);
    return indexMiniCard(it, isInbox && it.progress === null ? (when ? `INBOX · ${when}` : "INBOX") : undefined);
  });

  const deckBand =
    cards.length > 0
      ? zk.ui.column(
          [
            zk.ui.row(
              [
                kicker("INDEX CARDS · ON DECK"),
                pill("Mix", { id: "if-all", active: filter === "all", radius: "round" }),
                pinnedRest.length > 0 && pill("Pinned", { id: "if-pinned", active: filter === "pinned", radius: "round" }),
                hasInbox && pill(`Inbox ${inboxCount}`, { id: "if-inbox", active: filter === "inbox", radius: "round" }),
              ],
              { align: "center", gap: "xsmall" },
            ),
            zk.ui.grid(cards, { columns: cols, rows, gap: "small" }),
          ],
          { gap: "small" },
        )
      : null;

  const firstUse = !diptych && !deckBand;
  const noteBand =
    d.passage &&
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            kicker("DAILY EXCERPT"),
            zk.ui.text("Another ↻", { id: "next-passage", font: "sans", size: "xsmall", weight: "bold", tone: "secondary", lines: 1, width: "auto" }),
          ]),
          zk.ui.quote({ id: "passage", text: d.passage.text, source: d.passage.source }),
        ],
        { gap: "xsmall" },
      ),
      { fill: "light", pad: "medium", radius: "small" },
    );

  return zk.ui.column(
    [telemetry, diptych, deckBand, firstUse && zk.ui.text(FIRST_USE, { tone: "secondary" }), noteBand],
    { gap: isTall() ? "medium" : "small", fit: "trim" },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT C: "READING ROOM" ("atelier") — Calm Spotlight + Captioned Shelf
// ═══════════════════════════════════════════════════════════════════════════

export function renderAtelier(d: HomeModel, state: HomeState): Block {
  const wide = isWide();
  const hasBoth = !!(d.book && d.paper);
  const mode: AtelierMode = state.atelierMode === "paper" && d.paper ? "paper" : d.book ? "book" : "paper";
  const spotlight = (mode === "paper" ? d.paper : d.book) ?? d.hero;

  const spotlightBand = spotlight
    ? (() => {
        const spCol = colPathOf(d.colByKey, spotlight);
        const spHl = isShort() ? null : hlSnippetOf(d.hl, spotlight, 120);
        const spHlCount = d.hl.byItem[spotlight.key]?.count ?? 0;
        const byline = [authorsOf(spotlight, { most: 2, full: true }), spotlight.year ?? ""].filter(Boolean).join(" · ");
        const statLine = [
          percentOf(spotlight) ? `${percentOf(spotlight)} read` : "Not started",
          spHlCount > 0 ? `${spHlCount} ${spHlCount === 1 ? "highlight" : "highlights"}` : "",
          whenOf(spotlight.openedAt),
        ]
          .filter(Boolean)
          .join(" · ");

        return zk.ui.column(
          [
            zk.ui.row(
              [
                kicker("OPEN ON THE DESK"),
                hasBoth &&
                  zk.ui.box(
                    zk.ui.row(
                      [
                        zk.ui.box(
                          zk.ui.text(" Book ", { font: "sans", size: "xsmall", weight: "bold", align: "center", lines: 1 }),
                          { id: "am-book", pad: "xsmall", fill: mode === "book" ? "ink" : "none", width: "auto" },
                        ),
                        zk.ui.box(
                          zk.ui.text(" Paper ", { font: "sans", size: "xsmall", weight: "bold", align: "center", lines: 1 }),
                          { id: "am-paper", pad: "xsmall", fill: mode === "paper" ? "ink" : "none", width: "auto" },
                        ),
                      ],
                      { gap: "none" },
                    ),
                    { border: "thin", radius: "small", width: "auto" },
                  ),
              ],
              { align: "center" },
            ),
            zk.ui.item(
              ref(spotlight),
              zk.ui.row(
                [
                  zk.ui.cover(ref(spotlight), { width: wide ? "20%" : isShort() ? "21%" : "25%" }),
                  zk.ui.column(
                    [
                      spCol && zk.ui.text(spCol, { font: "sans", size: "xsmall", weight: "bold", caps: true, tone: "secondary", lines: 1 }),
                      zk.ui.text(cleanTitle(spotlight), {
                        font: "serif",
                        size: isShort() ? "large" : "title",
                        weight: "bold",
                        lines: wide || isShort() ? 2 : 3,
                        math: true,
                      }),
                      byline && zk.ui.text(byline, { font: "serif", size: "body", italic: true, tone: "secondary", lines: 1 }),
                      spHl && zk.ui.text(spHl, { font: "serif", size: "small", italic: true, tone: "secondary", lines: 2 }),
                      zk.ui.spacer(),
                      spotlight.progress !== null && zk.ui.progress(spotlight.progress),
                      zk.ui.row([
                        zk.ui.text(statLine, { font: "sans", size: "small", tone: "secondary", lines: 1 }),
                        zk.ui.text("Continue ›", { font: "sans", size: "small", weight: "bold", tone: "ink", lines: 1, width: "auto" }),
                      ]),
                    ],
                    { gap: "xsmall" },
                  ),
                ],
                { align: "stretch", gap: "medium" },
              ),
            ),
          ],
          { gap: "small" },
        );
      })()
    : null;

  // 2. Captioned Cover Shelf
  const shelfCols = wide ? 6 : isShort() ? 4 : 4;
  const pinnedPool = d.pinned.filter((i) => !spotlight || !same(ref(i), ref(spotlight)));
  const recentPool = d.recent.filter((i) => !spotlight || !same(ref(i), ref(spotlight)));
  const shelfMode: AtelierShelf =
    state.atelierShelf === "recent" || pinnedPool.length === 0 ? "recent" : "pinned";
  const shelfItems = shelfMode === "recent" ? recentPool : pinnedPool;

  const shelfBand =
    shelfItems.length > 0
      ? zk.ui.column(
          [
            zk.ui.divider(),
            zk.ui.row(
              [
                kicker("THE SHELF"),
                pinnedPool.length > 0 && pill("Pinned", { id: "as-pinned", active: shelfMode === "pinned", radius: "round" }),
                recentPool.length > 0 && pill("Recent", { id: "as-recent", active: shelfMode === "recent", radius: "round" }),
                zk.ui.text(
                  shelfMode === "pinned" ? `All ${d.pinned.length} ›` : `All ${d.recent.length} ›`,
                  {
                    id: shelfMode === "pinned" ? "all-pinned" : "all-reading",
                    font: "sans",
                    size: "small",
                    weight: "medium",
                    tone: "ink",
                    lines: 1,
                    width: "auto",
                  },
                ),
              ],
              { align: "center", gap: "xsmall" },
            ),
            zk.ui.grid(
              shelfItems.slice(0, shelfCols).map((item) =>
                zk.ui.item(
                  ref(item),
                  zk.ui.column(
                    [
                      zk.ui.cover(ref(item)),
                      barSlot(item),
                      zk.ui.text(cleanTitle(item), { font: "serif", size: "xsmall", weight: "bold", lines: 1, math: true }),
                      zk.ui.text([authorsOf(item, { most: 1 }), percentOf(item) || "New"].filter(Boolean).join(" · "), {
                        font: "sans",
                        size: "xsmall",
                        tone: "secondary",
                        lines: 1,
                      }),
                    ],
                    { gap: "xsmall" },
                  ),
                ),
              ),
              { columns: shelfCols, rows: 1, gap: "medium" },
            ),
          ],
          { gap: "small" },
        )
      : null;

  // 3. Lower Band: Inbox + Daily Commonplace (Side-by-side on Scribe)
  const freshInbox = (d.inbox ?? []).filter((i) => !spotlight || !same(ref(i), ref(spotlight)));
  const inboxList =
    freshInbox.length > 0
      ? zk.ui.column(
          [
            zk.ui.row([
              kicker(`INBOX · ${countOf(d.inbox!.length, d.inbox!.length)} UNREAD`),
              zk.ui.text("All ›", { id: "all-inbox", font: "sans", size: "small", weight: "medium", tone: "ink", lines: 1, width: "auto" }),
            ]),
            ...freshInbox.slice(0, wide ? 4 : 2).map((item) =>
              zk.ui.item(
                ref(item),
                zk.ui.row(
                  [
                    zk.ui.column(
                      [
                        zk.ui.text(cleanTitle(item), { font: "serif", size: "body", weight: "bold", lines: 1, math: true }),
                        bylineOf(item) && zk.ui.text(bylineOf(item), { font: "sans", size: "small", tone: "secondary", lines: 1 }),
                      ],
                      { gap: "xsmall" },
                    ),
                    zk.ui.text(whenOf(item.addedAt) || "New", {
                      font: "sans",
                      size: "xsmall",
                      tone: "secondary",
                      lines: 1,
                      width: "auto",
                    }),
                  ],
                  { align: "top", gap: "small" },
                ),
              ),
            ),
          ],
          { gap: "small" },
        )
      : null;

  const passageBox =
    d.passage &&
    zk.ui.box(
      zk.ui.column(
        [
          zk.ui.row([
            kicker(`COMMONPLACE · ${todayStamp()}`),
            zk.ui.text("↻", { id: "next-passage", font: "sans", size: "small", weight: "bold", tone: "secondary", lines: 1, width: "auto" }),
          ]),
          zk.ui.quote({ id: "passage", text: d.passage.text, source: d.passage.source }),
        ],
        { gap: "small" },
      ),
      { fill: "light", pad: "medium", radius: "small" },
    );

  let lowerBand: Block | null = null;
  if (inboxList && passageBox && wide) {
    lowerBand = zk.ui.column(
      [
        zk.ui.divider(),
        zk.ui.row(
          [
            zk.ui.column([inboxList], { width: "54%" }),
            zk.ui.column([passageBox], { width: "46%" }),
          ],
          { align: "top", gap: "large" },
        ),
      ],
      { gap: "small" },
    );
  } else if (inboxList || passageBox) {
    lowerBand = zk.ui.column([zk.ui.divider(), inboxList ?? passageBox!], { gap: "small" });
  }

  // 4. Quick Collection Drawers (shown on Scribe)
  const topCols = d.collections.filter((c) => c.libraryId === 0).slice(0, 6);
  const drawerBand =
    wide && topCols.length > 0
      ? zk.ui.row(
          [
            kicker("DRAWERS"),
            ...topCols.map((c) => pill(c.name, { id: `col:${c.libraryId}:${c.key}`, radius: "round", border: "thin" })),
          ],
          { align: "center", gap: "small" },
        )
      : null;

  const firstUse = !spotlightBand && !shelfBand && !lowerBand;
  return zk.ui.column(
    [spotlightBand, shelfBand, lowerBand, drawerBand, firstUse && zk.ui.text(FIRST_USE, { tone: "secondary" })],
    { gap: isTall() ? "medium" : "small", fit: "trim" },
  );
}
