// Reading Desk — a Home written by a plugin.
//
// The body of the app's Home, top to bottom:
//
//   BOOK · CONTINUE      the book you opened last and haven't marked read
//   PAPER · CONTINUE     the same, for anything that isn't a book
//   PINNED               items you pinned (long-press → More… → Pin to Home / Unpin)
//   NEW IN INBOX (n)     unread items of one collection, newest added first
//
// The plugin never draws items: it hands their keys to an `items` block, and the app draws
// them (title, authors, progress), opens them on a tap and repaints the block when their
// reading state changes. The app keeps Home's frame (header, search, banners, tab bar).
//
// settings.json, next to plugin.json, edited over USB:
//   { "inbox": "<key of a collection>" }      without it the inbox section is left out.
//
// Permission: "library:read", to find the items to show. Pins live in zk.storage.

declare global {
  namespace zk {
    interface Settings {
      /** The key of the collection whose unread items are listed as "New in inbox". */
      inbox?: string;
    }
  }
}

/** An item the user pinned. The library is kept so a group item opens from its own library. */
interface Pin {
  key: string;
  library: number;
}

const heading = (text: string) => zk.ui.text(text, { style: "label" });

/** A book, by item type or by its readable file being an EPUB. */
const isBook = (item: zk.Item) =>
  item.type === "book" || item.type === "bookSection" || item.format === "EPUB";

// ───────────────────────────── Continue ─────────────────────────────

/**
 * The most recently opened unread book and paper. `opened: true` yields items most recent first
 * and lazily, so we stop as soon as both slots are filled.
 */
async function findContinue(): Promise<{ book?: zk.Item; paper?: zk.Item }> {
  const found: { book?: zk.Item; paper?: zk.Item } = {};
  // "Unread" is the read mark, not progress: a book at 100% stays here until it is marked read.
  for await (const item of zk.library.items({ opened: true, read: false })) {
    const slot = isBook(item) ? "book" : "paper";
    found[slot] ??= item;
    if (found.book && found.paper) break;
  }
  return found;
}

// ───────────────────────────── Pins ─────────────────────────────

const loadPins = async () => (await zk.storage.get<Pin[]>("pins")) ?? [];

// The action's title is fixed, so one action toggles: pinned → unpinned and back.
zk.itemAction({
  id: "pin",
  title: "Pin to Home / Unpin",
  run: async (item) => {
    let pinned = false;
    await zk.storage.update<Pin[]>("pins", (pins = []) => {
      const rest = pins.filter((p) => p.key !== item.key);
      pinned = rest.length === pins.length;
      return pinned ? [...rest, { key: item.key, library: item.libraryId }] : rest;
    });
    return pinned ? "Pinned to Home" : "Unpinned";
  },
});

// ───────────────────────────── Inbox ─────────────────────────────

async function findInbox(collection: string): Promise<zk.Item[]> {
  // Visits every unread item of the collection: fine for an inbox (render has 1 s).
  const unread: zk.Item[] = [];
  for await (const item of zk.library.items({ collection, read: false })) unread.push(item);
  // ISO 8601 strings of one format sort as text.
  unread.sort((a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0));
  return unread;
}

// ───────────────────────────── The screen ─────────────────────────────

zk.screen("desk", {
  title: "Reading Desk",
  home: true,
  main: true,
  render: async () => {
    const { book, paper } = await findContinue();
    const blocks: zk.ui.Child[] = [];

    if (book) {
      blocks.push(zk.ui.items({ id: "book", style: "card", items: [{ key: book.key, library: book.libraryId, label: "BOOK · CONTINUE" }] }));
    }
    if (paper) {
      blocks.push(zk.ui.items({ id: "paper", style: "card", items: [{ key: paper.key, library: paper.libraryId, label: "PAPER · CONTINUE" }] }));
    }

    // Pinned, minus what already shows under Continue.
    const shown = new Set([book?.key, paper?.key]);
    const pins = (await loadPins()).filter((p) => !shown.has(p.key));
    for (const p of pins) shown.add(p.key);
    if (pins.length > 0) {
      blocks.push(heading("PINNED"));
      blocks.push(zk.ui.items({ id: "pinned", style: "row", items: pins }));
    }

    const inbox = zk.settings.inbox;
    if (inbox) {
      const unread = (await findInbox(inbox)).filter((i) => !shown.has(i.key));
      if (unread.length > 0) {
        blocks.push(heading(`NEW IN INBOX (${unread.length})`));
        blocks.push(
          zk.ui.items({
            id: "inbox",
            style: "row",
            items: unread.map((i) => ({ key: i.key, library: i.libraryId })),
          }),
        );
      }
    }

    if (blocks.length === 0) blocks.push(zk.ui.text("Nothing to continue yet. Open a book or pin an item.", { style: "meta" }));
    return zk.ui.column(blocks, { gap: "medium" });
  },
});

export {};
