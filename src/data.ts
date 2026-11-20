// What Reading Desk keeps and reads: pins, prefs, the inbox, the items in progress, the day's
// passage, and the words it writes about items (bylines, percentages, "today").

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
export interface Pin {
  key: string;
  library: number;
}

/** A collection, as kept for the inbox. */
export interface CollectionRef {
  key: string;
  library?: number;
}

/** What the settings screen sets (`zk.storage` "prefs"). */
export interface Prefs {
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

/** At most this many pins (the action refuses more). */
export const MAX_PINS = 50;
/** Opened items the pair looks through for a book and a paper. */
const PAIR_WALK = 200;
/** Opened items Your desk's Reading tab lists. */
export const READING_WALK = 60;
/** Inbox items looked at: past this, "99+". */
export const INBOX_CAP = 100;

export const loadPins = async () => ((await zk.storage.get<Pin[]>("pins")) ?? []).slice(0, MAX_PINS);
export const loadPrefs = async () => (await zk.storage.get<Prefs>("prefs")) ?? {};
export const savePrefs = (change: Partial<Prefs>) =>
  zk.storage.update<Prefs>("prefs", (p = {}) => ({ ...p, ...change }));

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
 * The book and the paper being read: the most recently opened unread one of each. The walk
 * (lazy, most recent first) stops once it has both, or after PAIR_WALK items.
 */
export async function openedPair(): Promise<{ book?: zk.Item; paper?: zk.Item }> {
  let book: zk.Item | undefined;
  let paper: zk.Item | undefined;
  for await (const item of zk.library.items({ opened: true, read: false, limit: PAIR_WALK })) {
    if (isBook(item)) book ??= item;
    else paper ??= item;
    if (book && paper) break;
  }
  return { book, paper };
}

/** The pinned items that still exist, in pin order. */
export async function pinnedItems(pins: Pin[]): Promise<zk.Item[]> {
  const items = await Promise.all(pins.map((p) => zk.library.item(p.key)));
  return items.filter((i): i is zk.Item => i !== null);
}

/**
 * The inbox's newest unread items, at most INBOX_CAP: the walk is the app's order, newest added
 * first, and stops there, so a big inbox costs a render no more than a small one ("99+").
 */
export async function inboxItems(inbox: CollectionRef): Promise<zk.Item[]> {
  const unread: zk.Item[] = [];
  const query: zk.ItemsQuery = { collection: inbox.key, read: false, limit: INBOX_CAP };
  if (inbox.library !== undefined) query.library = inbox.library;
  for await (const item of zk.library.items(query)) unread.push(item);
  // ISO 8601 strings of one format sort as text.
  return unread.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
export async function keptPassage(): Promise<Passage["pick"]> {
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
