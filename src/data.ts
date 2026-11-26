// What Reading Desk keeps and reads: pins, prefs (layout, inbox, passage), the items in progress,
// inbox and collection walks, highlight summaries for last-highlight recall, the daily/cyclable
// commonplace passage, and formatting helpers.

declare global {
  namespace zk {
    interface Settings {
      /** 0.1's setting: the key of the inbox collection. The settings screen replaces it. */
      inbox?: string;
    }
  }
}

// ───────────────────────────── Stored state ─────────────────────────────

/** One of the three selectable Home layouts. */
export type HomeLayout = "folio" | "index" | "atelier";

export const LAYOUTS: { id: HomeLayout; name: string; subtitle: string }[] = [
  {
    id: "folio",
    name: "Folio",
    subtitle: "Broadsheet hero with highlight recall, companion paper & catalog",
  },
  {
    id: "index",
    name: "Index Desk",
    subtitle: "Zero-cover Swiss cards: ink/white diptych, card grid & Surprise me",
  },
  {
    id: "atelier",
    name: "Reading Room",
    subtitle: "Book/Paper spotlight, captioned cover shelf, inbox & drawers",
  },
];

export const isLayout = (v: unknown): v is HomeLayout => v === "folio" || v === "index" || v === "atelier";

export const layoutName = (id: HomeLayout) => LAYOUTS.find((l) => l.id === id)?.name ?? "Folio";

/** An item the user pinned. The library is kept so a group item opens from its own library. */
export interface Pin {
  key: string;
  library: number;
}

/** A collection, as kept for the inbox or opened as a drawer. */
export interface CollectionRef {
  key: string;
  library?: number;
}

/** What the settings screen sets (`zk.storage` "prefs"). */
export interface Prefs {
  /** Which Home layout to draw; default `"folio"`. */
  layout?: HomeLayout;
  /** The inbox collection; `null`: none picked (settings.json is then ignored). Absent: not set yet. */
  inbox?: CollectionRef | null;
  /** The daily commonplace passage; default on. */
  passage?: boolean;
}

/** A resolved passage highlight. */
export interface PassagePick {
  key: string;
  itemKey: string;
  library: number;
  text: string;
  source: string;
}

/** The day's passage, picked once a day or cycled by the user (`zk.storage` "passage"). */
interface Passage {
  day: string;
  offset?: number;
  /** Absent: there was no highlight to pick that day. */
  pick?: PassagePick;
}

/** Compact per-item highlight summary cached off-render for instant Home renders. */
export interface HighlightEntry {
  count: number;
  snippet: string;
  key: string;
}

export interface HighlightSummary {
  day: string;
  total: number;
  byItem: Record<string, HighlightEntry>;
}

/** At most this many pins (the action refuses more). */
export const MAX_PINS = 50;
/** Opened items the pair looks through for a book and a paper. */
const PAIR_WALK = 200;
/** Opened items Your desk's Reading tab lists. */
export const READING_WALK = 60;
/** Inbox / drawer items looked at: past this, "99+". */
export const INBOX_CAP = 100;

export const loadPins = async () => ((await zk.storage.get<Pin[]>("pins")) ?? []).slice(0, MAX_PINS);
export const loadPrefs = async () => (await zk.storage.get<Prefs>("prefs")) ?? {};
export const savePrefs = (change: Partial<Prefs>) =>
  zk.storage.update<Prefs>("prefs", (p = {}) => ({ ...p, ...change }));

export const layoutOf = (prefs: Prefs): HomeLayout => (isLayout(prefs.layout) ? prefs.layout : "folio");

/** The inbox: picked on the settings screen, else 0.1's settings.json. */
export function inboxOf(prefs: Prefs): CollectionRef | null {
  if (prefs.inbox !== undefined) return prefs.inbox;
  return typeof zk.settings.inbox === "string" && zk.settings.inbox ? { key: zk.settings.inbox } : null;
}

// ───────────────────────────── Items ─────────────────────────────

/** A book, by item type or by its readable file being an EPUB. Everything else is a paper. */
export const isBook = (item: zk.Item) =>
  item.type === "book" || item.type === "bookSection" || item.format === "EPUB";

export const ref = (i: { key: string; libraryId: number }) => ({ key: i.key, library: i.libraryId });
export const same = (a: { key: string; library?: number }, b: { key: string; library?: number }) =>
  a.key === b.key && (a.library === undefined || b.library === undefined || a.library === b.library);

/**
 * Opened on this Kindle and not marked read, most recent first, at most `limit`. "Unread" is the
 * read mark, not progress: a book at 100% stays until it is marked read.
 */
export async function inProgress(limit: number): Promise<zk.Item[]> {
  const out: zk.Item[] = [];
  for await (const item of zk.library.items({ opened: true, read: false, limit })) out.push(item);
  return out;
}

/**
 * The book and the paper being read: the most recently opened unread one of each, plus the first
 * `recentCap` opened items for inline lists.
 */
export async function openedOverview(recentCap = 20): Promise<{
  book?: zk.Item;
  paper?: zk.Item;
  recent: zk.Item[];
}> {
  let book: zk.Item | undefined;
  let paper: zk.Item | undefined;
  const recent: zk.Item[] = [];
  for await (const item of zk.library.items({ opened: true, read: false, limit: PAIR_WALK })) {
    if (recent.length < recentCap) recent.push(item);
    if (isBook(item)) book ??= item;
    else paper ??= item;
    if (book && paper && recent.length >= recentCap) break;
  }
  return { book, paper, recent };
}

/** The pinned items that still exist, in pin order. */
export async function pinnedItems(pins: Pin[]): Promise<zk.Item[]> {
  const items = await Promise.all(pins.map((p) => zk.library.item(p.key)));
  return items.filter((i): i is zk.Item => i !== null);
}

/**
 * The inbox's newest unread items, at most INBOX_CAP: newest added first.
 */
export async function inboxItems(inbox: CollectionRef): Promise<zk.Item[]> {
  const unread: zk.Item[] = [];
  const query: zk.ItemsQuery = { collection: inbox.key, read: false, limit: INBOX_CAP };
  if (inbox.library !== undefined) query.library = inbox.library;
  for await (const item of zk.library.items(query)) unread.push(item);
  return unread.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
}

/** Items in a collection drawer (both read and unread, newest added first). */
export async function collectionItems(col: CollectionRef): Promise<zk.Item[]> {
  const out: zk.Item[] = [];
  const query: zk.ItemsQuery = { collection: col.key, limit: INBOX_CAP };
  if (col.library !== undefined) query.library = col.library;
  for await (const item of zk.library.items(query)) out.push(item);
  return out.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
}

/** Pick a random unread item (preferring inbox & unstarted pins, avoiding currently active keys). */
export async function pickSurpriseItem(excludeKeys: Set<string>): Promise<zk.Item | null> {
  const prefs = await loadPrefs();
  const inbox = inboxOf(prefs);
  const [pins, unreadInbox] = await Promise.all([loadPins(), inbox ? inboxItems(inbox) : Promise.resolve([])]);
  const pinned = await pinnedItems(pins);
  const pool: zk.Item[] = [];
  const seen = new Set(excludeKeys);
  const pushUnique = (items: zk.Item[]) => {
    for (const i of items) {
      if (i.read || seen.has(i.key)) continue;
      seen.add(i.key);
      pool.push(i);
    }
  };
  pushUnique(unreadInbox);
  pushUnique(pinned.filter((i) => i.openedAt === null));
  if (pool.length === 0) {
    for await (const item of zk.library.items({ read: false, limit: 80 })) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        pool.push(item);
      }
    }
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** "12", or "99+" when the walk stopped at its cap. */
export const countOf = (n: number, walked: number) => (walked >= INBOX_CAP ? `${INBOX_CAP - 1}+` : String(n));

// ───────────────────────────── Words ─────────────────────────────

/** "Jane Austen" (one author, `full`), "He, Zhang, Ren, Sun", "Vaswani et al." (more than `most`). */
export function authorsOf(i: zk.Item, opts: { most: number; full?: boolean }): string {
  const authors = i.creators.filter((c) => c.type === "author");
  const people = authors.length > 0 ? authors : i.creators;
  if (opts.full && people.length === 1) {
    const c = people[0];
    return c.name ?? [c.first, c.last].filter(Boolean).join(" ");
  }
  const names = people.map((c) => c.last ?? c.name ?? "").filter(Boolean);
  return names.length > opts.most ? `${names[0]} et al.` : names.join(", ");
}

/** "He, Zhang, Ren, Sun · 2016": authors and year, either alone when the other is missing. */
export const bylineOf = (i: zk.Item) => [authorsOf(i, { most: 4 }), i.year ?? ""].filter(Boolean).join(" · ");

/** "42%" of an item opened here; "" if never. */
export const percentOf = (i: zk.Item) => (i.progress === null ? "" : `${Math.round(i.progress * 100)}%`);

/** Compact uppercase type/format badge ("EPUB", "PDF", "PREPRINT", "ARTICLE", "BOOK"). */
export function typeLabel(item: zk.Item): string {
  if (item.format) return item.format;
  if (item.type === "preprint") return "PREPRINT";
  if (item.type === "journalArticle") return "ARTICLE";
  if (item.type === "book" || item.type === "bookSection") return "BOOK";
  return "PAPER";
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "NOV 26" in local Kindle time. */
export function todayStamp(now = new Date()): string {
  return `${MONTHS[now.getMonth()].toUpperCase()} ${now.getDate()}`;
}

/**
 * When, in the Kindle's local time: "today", "yesterday", a weekday within the week ("Mon"),
 * else "Nov 12" ("Nov 12, 2024" in another year). "" for no date.
 */
export function whenOf(iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return DAYS[d.getDay()];
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? date : `${date}, ${d.getFullYear()}`;
}

// ───────────────────────────── Highlights & Commonplace ─────────────────────────────

/** Today on this Kindle, "2026-11-26". */
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

const EMPTY_HL: HighlightSummary = { day: "", total: 0, byItem: {} };
let summaryDirty = false;
let refreshingSummary = false;

/**
 * Cached highlight summary (total count + latest snippet & count per item). Instant single storage
 * read during render; refreshed asynchronously when stale or after highlight/sync events.
 */
export async function keptHighlightSummary(): Promise<HighlightSummary> {
  const kept = await zk.storage.get<HighlightSummary>("hlSummary");
  if (!kept || kept.day !== today() || summaryDirty) refreshSummaryLater();
  return kept ?? EMPTY_HL;
}

function refreshSummaryLater() {
  if (refreshingSummary) return;
  refreshingSummary = true;
  setTimeout(async () => {
    try {
      await buildHighlightSummary();
      summaryDirty = false;
      zk.ui.refresh();
    } catch (err) {
      console.warn("highlight summary couldn't refresh:", err);
    } finally {
      refreshingSummary = false;
    }
  }, 0);
}

async function buildHighlightSummary(): Promise<void> {
  const byItem: Record<string, HighlightEntry> = {};
  let total = 0;
  for await (const a of zk.library.recentAnnotations({ limit: 300 })) {
    if (a.type !== "highlight" && a.type !== "underline") continue;
    total++;
    const text = a.text?.trim() ?? "";
    const cur = byItem[a.itemKey];
    if (!cur) {
      byItem[a.itemKey] = {
        count: 1,
        snippet: text.length >= 24 ? text.slice(0, 180) : "",
        key: a.key,
      };
    } else {
      cur.count++;
      if (!cur.snippet && text.length >= 24) {
        cur.snippet = text.slice(0, 180);
        cur.key = a.key;
      }
    }
  }
  await zk.storage.set("hlSummary", { day: today(), total, byItem } satisfies HighlightSummary);
}

/** Register event listeners so highlight snippets & counts stay fresh after reading or syncing. */
export function registerHighlightWatchers() {
  const markDirty = () => {
    summaryDirty = true;
    refreshSummaryLater();
  };
  zk.on("highlightCreated", markDirty);
  zk.on("highlightChanged", markDirty);
  zk.on("highlightDeleted", markDirty);
  zk.on("syncFinished", markDirty);
}

/**
 * The passage a render shows: the one kept in storage (one read). When it isn't today's, today's
 * is picked off the render (a timer) and the screen refreshed; until then the kept one shows, so
 * the page doesn't jump twice.
 */
export async function keptPassage(): Promise<PassagePick | undefined> {
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
      await pickPassage(0);
      zk.ui.refresh();
    } catch (err) {
      console.warn("the passage couldn't be picked:", err);
    } finally {
      picking = false;
    }
  }, 0);
}

/** Advance to the next highlight right away (called from the user's `Next ↻` tap). */
export async function cyclePassage(): Promise<void> {
  const kept = await zk.storage.get<Passage>("passage");
  const nextOffset = kept?.day === today() ? (kept.offset ?? 0) + 1 : 1;
  await pickPassage(nextOffset);
}

/**
 * Picks a highlight of 40–400 characters from the newest 300, deterministic for `(day, offset)`.
 */
async function pickPassage(offset: number): Promise<void> {
  const day = today();
  const candidates: zk.Annotation[] = [];
  for await (const a of zk.library.recentAnnotations({ limit: 300 })) {
    const text = a.text?.trim() ?? "";
    if (a.type === "highlight" && text.length >= 40 && text.length <= 400) candidates.push(a);
  }
  let pick: PassagePick | undefined;
  for (let n = 0; n < candidates.length && !pick; n++) {
    const a = candidates[(hash(day) + offset + n) % candidates.length];
    const item = await zk.library.item(a.itemKey);
    if (!item) continue;
    const source = [item.title || "Untitled", authorsOf(item, { most: 1 }), a.pageLabel ? `p. ${a.pageLabel}` : ""]
      .filter(Boolean)
      .join(" · ");
    pick = { key: a.key, itemKey: a.itemKey, library: a.libraryId, text: a.text!.trim(), source };
  }
  await zk.storage.set("passage", { day, offset, pick } satisfies Passage);
}

/**
 * The passage was tapped: open its item at the highlight. The item gone: the pick is dropped (the
 * next render picks another); the highlight gone: the item opens where it was left; a cancelled
 * download: nothing.
 */
export async function openPassage(): Promise<void> {
  const pick = (await zk.storage.get<Passage>("passage"))?.pick;
  if (!pick) return;
  const why = (err: unknown) => (err instanceof Error ? err.message : String(err));
  try {
    await zk.library.open({ key: pick.itemKey, library: pick.library }, { annotation: pick.key });
  } catch (err) {
    const reason = why(err);
    if (reason.includes("Cancelled")) return;
    if (reason.includes("Item not found") || reason.includes("Annotation not found")) {
      await zk.storage.delete("passage");
      zk.ui.refresh();
    }
    if (!reason.includes("Annotation not found")) {
      if (!reason.includes("Item not found")) console.warn("the passage didn't open:", reason);
      return;
    }
    try {
      await zk.library.open({ key: pick.itemKey, library: pick.library });
    } catch (again) {
      if (!why(again).includes("Cancelled")) console.warn("the passage's item didn't open:", why(again));
    }
  }
}
