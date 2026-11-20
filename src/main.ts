// Reading Desk — a Home written by a plugin.
//
// Home's body, top to bottom:
//
//   CONTINUE · BOOK      what you are in the middle of: the item opened last and not marked read
//                        (a card on tall screens, a row on short ones; "START HERE" and the newest
//                        unread pin when nothing is open yet)
//   Books Papers Pinned New 4      tabs (chips); the choice is kept
//     Books              a shelf of the books you are reading, then pinned books
//     Papers             rows of the papers you are reading, then UP NEXT: pinned papers
//     Pinned             a shelf of everything pinned
//     New                rows of the unread items of an inbox collection, newest first
//   ┃ “a passage…”       one of your highlights, a new one each day; a tap opens the reader at it
//
// The plugin never draws items: it hands their keys to `items` blocks, and the app draws them
// (cover, title, progress), opens them on a tap and repaints them when their reading state
// changes. The app keeps Home's frame (header, search, banners, tab bar).
//
// The settings screen (Plugins → Reading Desk) picks the inbox collection, turns the passage
// on or off, and lists the pins. 0.1's settings.json ({ "inbox": "<collection key>" }) is still
// read until an inbox is picked there.
//
// Permissions: "library:read" (the items, the collections) and "annotations:read" (the passage).

declare global {
  namespace zk {
    interface Settings {
      /** 0.1's setting: the key of the inbox collection. The settings screen replaces it. */
      inbox?: string;
    }
  }
}

// ───────────────────────────── Stored state ─────────────────────────────

/** An item the user pinned. The library is kept so a group item opens from its own library. */
interface Pin {
  key: string;
  library: number;
}

/** A collection, as kept for the inbox. */
interface CollectionRef {
  key: string;
  library?: number;
}

/** What the settings screen sets (`zk.storage` "prefs"). */
interface Prefs {
  /** The inbox collection; `null`: none picked (settings.json is then ignored). Absent: not set yet. */
  inbox?: CollectionRef | null;
  /** The daily passage; default on. */
  passage?: boolean;
}

/** The day's passage, picked once a day (`zk.storage` "passage"). */
interface Passage {
  day: string;
  /** Absent: there was no highlight to pick that day. */
  pick?: { key: string; itemKey: string; library: number; text: string; source: string };
}

type Tab = "books" | "papers" | "pinned" | "new";
const TABS: Tab[] = ["books", "papers", "pinned", "new"];

/** At most this many pins (the action refuses more), and opened items looked at. */
const MAX_PINS = 50;
const MAX_OPENED = 30;
const INBOX_CAP = 100;

const loadPins = async () => ((await zk.storage.get<Pin[]>("pins")) ?? []).slice(0, MAX_PINS);
const loadPrefs = async () => (await zk.storage.get<Prefs>("prefs")) ?? {};
const savePrefs = (change: Partial<Prefs>) => zk.storage.update<Prefs>("prefs", (p = {}) => ({ ...p, ...change }));

/** The inbox: picked on the settings screen, else 0.1's settings.json. */
function inboxOf(prefs: Prefs): CollectionRef | null {
  if (prefs.inbox !== undefined) return prefs.inbox;
  return typeof zk.settings.inbox === "string" && zk.settings.inbox ? { key: zk.settings.inbox } : null;
}

// ───────────────────────────── Items ─────────────────────────────

/** A book, by item type or by its readable file being an EPUB. Everything else is a paper. */
const isBook = (item: zk.Item) =>
  item.type === "book" || item.type === "bookSection" || item.format === "EPUB";

const ref = (i: { key: string; libraryId: number }) => ({ key: i.key, library: i.libraryId });
const same = (a: { key: string; library?: number }, b: { key: string; library?: number }) =>
  a.key === b.key && (a.library === undefined || b.library === undefined || a.library === b.library);

/**
 * Items in progress: opened on this Kindle and not marked read, most recent first. "Unread" is
 * the read mark, not progress: a book at 100% stays until it is marked read. `opened: true`
 * yields lazily, so the walk stops after MAX_OPENED.
 */
async function inProgress(): Promise<zk.Item[]> {
  const out: zk.Item[] = [];
  for await (const item of zk.library.items({ opened: true, read: false, limit: MAX_OPENED })) out.push(item);
  return out;
}

/** The pinned items that still exist, in pin order. */
async function pinnedItems(pins: Pin[]): Promise<zk.Item[]> {
  const out: zk.Item[] = [];
  for (const p of pins) {
    const item = await zk.library.item(p.key);
    if (item) out.push(item);
  }
  return out;
}

/**
 * The inbox's newest unread items, at most INBOX_CAP: the walk is the app's order, newest added
 * first, and stops there, so a big inbox costs a render no more than a small one ("New 99+").
 */
async function inboxItems(inbox: CollectionRef): Promise<zk.Item[]> {
  const unread: zk.Item[] = [];
  const query: zk.ItemsQuery = { collection: inbox.key, read: false, limit: INBOX_CAP };
  if (inbox.library !== undefined) query.library = inbox.library;
  for await (const item of zk.library.items(query)) unread.push(item);
  // ISO 8601 strings of one format sort as text.
  return unread.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
}

// ───────────────────────────── The passage ─────────────────────────────

/** Today on this Kindle, "2026-11-20". */
function today(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** A small stable hash (FNV-1a), so a day always picks the same highlight. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * The passage a render shows: the one kept in storage (one read). When it isn't today's, today's
 * is picked off the render (a timer) and the screen refreshed; until then the kept one shows, so
 * the page doesn't jump twice.
 */
async function keptPassage(): Promise<Passage["pick"]> {
  const kept = await zk.storage.get<Passage>("passage");
  if (kept?.day !== today()) pickLater();
  return kept?.pick;
}

let picking = false;
function pickLater() {
  if (picking) return;
  picking = true;
  setTimeout(async () => {
    try {
      await pickPassage();
      zk.ui.refresh();
    } catch (err) {
      console.warn("the passage couldn't be picked:", err);
    } finally {
      picking = false;
    }
  }, 0);
}

/**
 * Today's passage: a highlight of 40–400 characters from the newest 300, picked by the date (so
 * the same all day), and kept in storage.
 */
async function pickPassage(): Promise<void> {
  const day = today();
  const candidates: zk.Annotation[] = [];
  for await (const a of zk.library.recentAnnotations({ limit: 300 })) {
    const text = a.text?.trim() ?? "";
    if (a.type === "highlight" && text.length >= 40 && text.length <= 400) candidates.push(a);
  }
  let pick: Passage["pick"];
  // Some highlights' items may be gone or switched off: try from the day's index on.
  for (let n = 0; n < candidates.length && !pick; n++) {
    const a = candidates[(hash(day) + n) % candidates.length];
    const item = await zk.library.item(a.itemKey);
    if (!item) continue;
    const source = [item.title || "Untitled", a.pageLabel ? `p. ${a.pageLabel}` : ""].filter(Boolean).join(" · ");
    pick = { key: a.key, itemKey: a.itemKey, library: a.libraryId, text: a.text!.trim(), source };
  }
  await zk.storage.set("passage", { day, pick } satisfies Passage);
}

// ───────────────────────────── Pins ─────────────────────────────

// The action's title is fixed, so one action toggles: pinned → unpinned and back.
zk.itemAction({
  id: "pin",
  title: "Pin to Home / Unpin",
  run: async (item) => {
    let reply = "";
    await zk.storage.update<Pin[]>("pins", (pins = []) => {
      const rest = pins.filter((p) => !same(p, ref(item)));
      if (rest.length < pins.length) {
        reply = "Unpinned";
        return rest;
      }
      if (pins.length >= MAX_PINS) {
        reply = `Home holds ${MAX_PINS} pins: unpin one first (Plugins → Reading Desk)`;
        return pins;
      }
      reply = "Pinned to Home";
      return [...pins, ref(item)];
    });
    zk.ui.refresh();
    return reply;
  },
});

// ───────────────────────────── Home ─────────────────────────────

/**
 * Below this window height (pixels at 300 ppi) "Now reading" is a row, not a card: a basic
 * Kindle (1337) and a Paperwhite (1547) need the room for a shelf row and the passage; a Scribe
 * (2379) has room for the card.
 */
const CARD_MIN_HEIGHT = 1800;
const display = () => ({ width: zk.display?.width ?? 1236, height: zk.display?.height ?? 1547 });
const shortScreen = () => display().height < CARD_MIN_HEIGHT;

// ── Fitting the page ──
// The app lays the body out and pages it; the plugin only decides whether the passage goes in.
// It must never cost a page: these estimates of the app's block heights (pixels at 300 ppi)
// tell how many pages the tab's content takes with and without it. Rough is fine: they only
// decide whether a passage shows.
const FRAME_H = 434; // Home around its body: header and search (292), tab bar (130), a gap (12)
const PAGE_NUMBER_H = 60;
// The column's gap: "small" on short screens (every pixel counts), "medium" on tall ones.
const gapPx = () => (shortScreen() ? 18 : 36);
const ROW_H = 186;
const CHIPS_H = 76;
const LABEL_H = 48;
const HERO_ROW_H = LABEL_H + ROW_H;
const HERO_CARD_H = 400;
const MARGINS = 120;

/** A shelf row's height: tiles of about 240 px, 36 apart, 2:3 covers, a bar and a line under. */
function shelfRowH(): number {
  const w = display().width - MARGINS;
  const n = Math.max(1, Math.round((w + 36) / 276));
  return Math.floor(((w - (n - 1) * 36) / n) * 1.5) + 70;
}

/** The quote's height: italic serif lines of about 17.5 px a character, at most 5, and its source. */
function passageH(text: string): number {
  const perLine = Math.floor((display().width - MARGINS - 36) / 17.5);
  const lines = Math.min(5, Math.ceil(text.length / perLine) + (text.match(/\n/g)?.length ?? 0));
  return 8 + lines * 50 + 14 + 34;
}

/** Pages a breakable block of `units` takes when it gets `budget` px a page (the app's split). */
function pagesOf(units: number[], budget: number): number {
  let pages = 1;
  let used = 0;
  units.forEach((h, i) => {
    if (i > 0 && used + h > budget) {
      pages++;
      used = 0;
    }
    used += h;
  });
  return pages;
}

/**
 * How many pages: `fixed` (blocks that don't page, with their gaps) above one block of `units`,
 * and `tail` (the passage) under it.
 * All fits: 1. Else the app pages that block in place under the fixed ones when its first unit
 * fits; else the whole body flows from page to page (approximated by whole units).
 */
function pagesFor(fixed: number, units: number[], tail = 0): number {
  const body = display().height - FRAME_H;
  const total = units.reduce((a, b) => a + b, 0);
  if (fixed + total + tail <= body) return 1;
  const room = body - PAGE_NUMBER_H - fixed - tail;
  if (units.length > 0 && units[0] <= room) return pagesOf(units, room);
  return pagesOf([fixed, ...units, ...(tail ? [tail] : [])], body - PAGE_NUMBER_H);
}

const label = (text: string) => zk.ui.text(text, { style: "label" });

/** The tab shown: the stored one if it can show, else Books. */
async function currentTab(hasInbox: boolean): Promise<Tab> {
  const t = await zk.storage.get<Tab>("tab");
  return t && TABS.includes(t) && (t !== "new" || hasInbox) ? t : "books";
}

/** "Now reading": the hero block (a card, or a label over a row), or nothing. */
function nowReading(hero: zk.Item | undefined, kicker: string): zk.ui.Child {
  if (!hero) return null;
  if (!shortScreen()) return zk.ui.items({ id: "now", style: "card", items: [{ ...ref(hero), label: kicker }] });
  // One block, so the label never pages away from its row.
  return zk.ui.column([label(kicker), zk.ui.items({ id: "now", style: "row", items: [ref(hero)] })], { gap: "none" });
}

zk.screen("desk", {
  title: "Reading Desk",
  home: true,
  render: async () => {
    const prefs = await loadPrefs();
    const inbox = inboxOf(prefs);
    const [opened, pins, unread] = await Promise.all([inProgress(), loadPins(), inbox ? inboxItems(inbox) : null]);

    // The hero: the item opened last; none yet, the newest unread pin.
    let hero: zk.Item | undefined = opened[0];
    let kicker = hero ? (isBook(hero) ? "CONTINUE · BOOK" : "CONTINUE · PAPER") : "";
    let pinned: zk.Item[] | null = null; // looked up only when needed
    const pinnedNow = async () => (pinned ??= await pinnedItems(pins));
    if (!hero && pins.length > 0) {
      hero = [...(await pinnedNow())].reverse().find((i) => !i.read);
      kicker = "START HERE";
    }
    const notHero = (i: { key: string; libraryId: number }) => !hero || !same(ref(i), ref(hero));

    const tab = await currentTab(unread !== null);
    const newCount = unread?.filter(notHero).length ?? 0;
    const chips = [
      { id: "books", title: "Books" },
      { id: "papers", title: "Papers" },
      { id: "pinned", title: "Pinned" },
      unread && {
        id: "new",
        title: unread.length >= INBOX_CAP ? `New ${INBOX_CAP - 1}+` : newCount > 0 ? `New ${newCount}` : "New",
      },
    ].filter((c): c is { id: Tab; title: string } => !!c);

    const reading = opened.filter(notHero);
    const inProgressKeys = new Set(opened.map((i) => i.key));
    // The tab's content, and its units (rows, or shelf rows) for fitting the page.
    let content: zk.ui.Child[] = [];
    let units: number[] = [];
    let extra = 0; // fixed blocks in the content (Up next's label)
    const rows = (n: number) => Array<number>(n).fill(ROW_H);
    const shelfRows = (n: number) => {
      const per = Math.max(1, Math.round((display().width - MARGINS + 36) / 276));
      const r = Math.ceil(n / per);
      return Array<number>(r).fill(shelfRowH() + 40).map((h, i) => (i === r - 1 ? h - 40 : h));
    };
    if (tab === "books") {
      const books = reading.filter(isBook);
      const more = (await pinnedNow()).filter((i) => isBook(i) && !inProgressKeys.has(i.key) && notHero(i));
      const all = [...books, ...more];
      content = [zk.ui.items({ id: "books", style: "shelf", items: all.map(ref), empty: "Books you open show up here." })];
      units = shelfRows(all.length);
    } else if (tab === "papers") {
      const papers = reading.filter((i) => !isBook(i));
      // Up next: pinned papers not started (never opened here) and not read.
      const next = (await pinnedNow()).filter((i) => !isBook(i) && i.progress === null && !i.read && notHero(i));
      if (papers.length === 0 && next.length === 0) {
        content = [zk.ui.items({ id: "papers", style: "row", items: [], empty: "Papers you open or pin show up here." })];
      } else if (papers.length > 0 && next.length > 0) {
        content = [
          zk.ui.items({ id: "papers", style: "row", items: papers.map(ref) }),
          label("UP NEXT"),
          zk.ui.items({ id: "next", style: "row", items: next.map(ref) }),
        ];
        units = rows(papers.length + next.length);
        extra = LABEL_H + 2 * gapPx();
      } else {
        content = [
          next.length > 0 && label("UP NEXT"),
          zk.ui.items({ id: next.length > 0 ? "next" : "papers", style: "row", items: [...papers, ...next].map(ref) }),
        ];
        units = rows(papers.length + next.length);
        extra = next.length > 0 ? LABEL_H + gapPx() : 0;
      }
    } else if (tab === "pinned") {
      const all = (await pinnedNow()).filter(notHero);
      content = [
        zk.ui.items({
          id: "pinned",
          style: "shelf",
          items: all.map(ref),
          empty: "Long-press an item → More… → Pin.",
        }),
      ];
      units = shelfRows(all.length);
    } else {
      const items = (unread ?? []).filter(notHero);
      content = [zk.ui.items({ id: "new", style: "row", items: items.map(ref), empty: "Nothing new in the inbox." })];
      units = rows(items.length);
    }

    // Above the content: the hero and the tabs, each with its gap.
    let fixed = (hero ? (shortScreen() ? HERO_ROW_H : HERO_CARD_H) + gapPx() : 0) + CHIPS_H + gapPx() + extra;
    if (units.length === 0) units = [112]; // the empty text
    // Papers in two blocks that page would page each on its own, a row or two each: one block
    // then, papers in progress first ("42%") and the ones not started ("new") after them.
    if (tab === "papers" && extra === LABEL_H + 2 * gapPx() && pagesFor(fixed, units) > 1) {
      const all = content.flatMap((c) => (c && typeof c === "object" && c.kind === "items" ? c.items : []));
      content = [zk.ui.items({ id: "papers", style: "row", items: all })];
      fixed -= extra;
    }

    // The passage, last: under the content when it fits there; when the content pages, the app
    // keeps the passage in place and pages the content above it, or (no room for that) it comes
    // after the content. Left out when it would cost a page.
    const pick = prefs.passage === false ? undefined : await keptPassage();
    const showPassage =
      !!pick && pagesFor(fixed, units, passageH(pick.text) + gapPx()) <= pagesFor(fixed, units);
    return zk.ui.column(
      [
        nowReading(hero, kicker),
        zk.ui.chips({ id: "tabs", select: "one", chips, selected: [tab] }),
        ...content,
        showPassage && zk.ui.quote({ id: "passage", text: pick!.text, source: pick!.source }),
      ],
      { gap: shortScreen() ? "small" : "medium" },
    );
  },
  onEvent: async (e) => {
    if (e.kind === "chips" && e.id === "tabs" && TABS.includes(e.chip as Tab)) {
      await zk.storage.set("tab", e.chip);
    } else if (e.kind === "tap" && e.id === "passage") {
      const kept = await zk.storage.get<Passage>("passage");
      const pick = kept?.pick;
      if (!pick) return;
      const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
      try {
        await zk.library.open({ key: pick.itemKey, library: pick.library }, { annotation: pick.key });
      } catch (err) {
        const reason = why(err);
        if (reason.includes("Cancelled")) return; // the user cancelled the download
        if (reason.includes("Item not found") || reason.includes("Annotation not found")) {
          // Gone since the morning: the next render picks another.
          await zk.storage.delete("passage");
          zk.ui.refresh();
        }
        if (!reason.includes("Annotation not found")) {
          if (!reason.includes("Item not found")) console.warn("the passage didn't open:", reason);
          return;
        }
        // The highlight went, the item didn't: open it where it was left.
        try {
          await zk.library.open({ key: pick.itemKey, library: pick.library });
        } catch (again) {
          if (!why(again).includes("Cancelled")) console.warn("the passage's item didn't open:", why(again));
        }
      }
    }
  },
});

// ───────────────────────────── Settings ─────────────────────────────

/** "Probability / SPDEs", with the group's name for a group's collection. */
const collectionName = (c: zk.Collection) =>
  c.path.join(" / ") + (c.libraryId !== 0 ? ` (${c.libraryName})` : "");

const authorsOf = (i: zk.Item) => {
  const names = i.creators.map((c) => c.last ?? c.name ?? "").filter(Boolean);
  const who = names.length > 2 ? `${names[0]} et al.` : names.join(", ");
  return [who, i.year ?? ""].filter(Boolean).join(" · ");
};

/** The pin the settings screen is asking about (its row id), if any. */
let unpinAsk: string | null = null;
const pinId = (p: Pin) => `${p.library}:${p.key}`;

zk.screen("settings", {
  title: "Settings",
  main: true,
  render: async () => {
    const prefs = await loadPrefs();
    const inbox = inboxOf(prefs);
    let inboxName = "None: the New tab is hidden";
    if (inbox) {
      const c = (await zk.library.collections()).find((c) => same({ key: c.key, library: c.libraryId }, inbox));
      inboxName = c ? collectionName(c) : "A collection no longer on the Kindle";
    }
    const pins = await loadPins();
    const items = await Promise.all(pins.map((p) => zk.library.item(p.key)));
    const asked = pins.findIndex((p) => pinId(p) === unpinAsk);
    const askedTitle = asked >= 0 ? items[asked]?.title || "this item" : "";

    return zk.ui.column(
      [
        zk.ui.list({
          id: "prefs",
          rows: [
            { id: "inbox", title: "Inbox collection", subtitle: inboxName },
            {
              id: "passage",
              title: "A passage each day",
              subtitle: "One of your highlights under the desk, a new one each day",
              meta: prefs.passage === false ? "Off" : "On",
            },
          ],
        }),
        label(`PINNED (${pins.length})`),
        asked >= 0 && zk.ui.notice(`Unpin “${askedTitle}”?`),
        asked >= 0 &&
          zk.ui.buttons([
            { id: "keep", title: "Keep" },
            { id: "unpin", title: "Unpin", primary: true },
          ]),
        zk.ui.list({
          id: "pins",
          rows: pins.map((p, n) => ({
            id: pinId(p),
            title: items[n]?.title || "An item no longer on the Kindle",
            subtitle: items[n] ? authorsOf(items[n]) : undefined,
            meta: "Unpin…",  // a tap asks first
            selected: pinId(p) === unpinAsk,
          })),
          empty: "Nothing pinned. Long-press an item → More… → Pin to Home / Unpin.",
        }),
      ],
      { gap: "medium" },
    );
  },
  onEvent: async (e) => {
    if (e.kind === "select" && e.id === "prefs") {
      if (e.row === "inbox") zk.ui.open("inbox");
      else if (e.row === "passage") {
        const prefs = await loadPrefs();
        await savePrefs({ passage: prefs.passage === false });
      }
    } else if (e.kind === "select" && e.id === "pins") {
      unpinAsk = unpinAsk === e.row ? null : e.row;
    } else if (e.kind === "tap" && e.id === "keep") {
      unpinAsk = null;
    } else if (e.kind === "tap" && e.id === "unpin" && unpinAsk) {
      const gone = unpinAsk;
      await zk.storage.update<Pin[]>("pins", (pins = []) => pins.filter((p) => pinId(p) !== gone));
      unpinAsk = null;
    } else if (e.kind === "back" || e.kind === "open") {
      unpinAsk = null;
    }
  },
});

/** The inbox picker: a search over the collections, "None" first. */
let inboxSearch = "";

zk.screen("inbox", {
  title: "Inbox collection",
  render: async () => {
    const inbox = inboxOf(await loadPrefs());
    const words = inboxSearch.toLowerCase().split(/\s+/).filter(Boolean);
    const all = await zk.library.collections();
    const matches = all
      .map((c) => ({ c, name: collectionName(c) }))
      .filter(({ name }) => words.every((w) => name.toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 300);
    return zk.ui.column([
      zk.ui.search({ id: "find", placeholder: "Find a collection", value: inboxSearch }),
      zk.ui.list({
        id: "collections",
        rows: [
          ...(words.length === 0 ? [{ id: "none", title: "None", subtitle: "No New tab", selected: !inbox }] : []),
          ...matches.map(({ c, name }) => ({
            id: `${c.libraryId}:${c.key}`,
            title: name,
            selected: !!inbox && same({ key: c.key, library: c.libraryId }, inbox),
          })),
        ],
        empty: "No collection matches",
      }),
    ]);
  },
  onEvent: async (e) => {
    if (e.kind === "open" || e.kind === "back") inboxSearch = "";
    else if ((e.kind === "change" || e.kind === "submit") && e.id === "find") inboxSearch = e.text;
    else if (e.kind === "select" && e.id === "collections") {
      if (e.row === "none") await savePrefs({ inbox: null });
      else {
        const colon = e.row.indexOf(":");
        await savePrefs({ inbox: { library: Number(e.row.slice(0, colon)), key: e.row.slice(colon + 1) } });
      }
      inboxSearch = "";
      zk.ui.close();
    }
  },
});

export {};
