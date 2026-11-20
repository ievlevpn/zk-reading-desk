// Your desk (screen `all`, opened from Home's All ›): a switch Reading · Pinned · Inbox n over a
// grid of covers that pages, the only place Reading Desk pages. The tab is the screen's param (the
// All › tapped), changed by the switch while the screen is open, and never stored.

import {
  READING_WALK,
  authorsOf,
  countOf,
  inProgress,
  inboxItems,
  inboxOf,
  loadPins,
  loadPrefs,
  percentOf,
  pinnedItems,
} from "./data";
import { LARGE, coverGrid, pageWidth, perRow, segmented } from "./pieces";

type Tab = "reading" | "pinned" | "inbox";
const TABS: Tab[] = ["reading", "pinned", "inbox"];

const EMPTY: Record<Tab, string> = {
  reading: "Books and papers you open show up here.",
  pinned: "Nothing pinned yet. Long-press an item → More… → Pin to Home / Unpin.",
  inbox: "Nothing new in the inbox.",
};

/** A tile about 220 px wide: 4 a row on a Paperwhite or a basic Kindle, 6 on a Scribe. */
const columns = () => perRow(220, pageWidth(), LARGE);

/** "Austen · 42%", "Austen · Read", "Austen" (never opened). */
function caption(i: zk.Item): string {
  return [authorsOf(i, { most: 1 }), i.read ? "Read" : percentOf(i)].filter(Boolean).join(" · ");
}

/** The tab the switch picked on the open screen; null: the param's. */
let picked: Tab | null = null;

export function registerDesk() {
  zk.screen<{ tab?: Tab } | undefined>("all", {
    title: "Your desk",
    render: async (params) => {
      const inbox = inboxOf(await loadPrefs());
      const unread = inbox ? await inboxItems(inbox) : null;
      const asked = picked ?? params?.tab ?? "reading";
      const tab: Tab = TABS.includes(asked) && (asked !== "inbox" || unread) ? asked : "reading";

      const items =
        tab === "reading" ? await inProgress(READING_WALK) : tab === "pinned" ? await pinnedItems(await loadPins()) : unread!;
      const segments = [
        { id: "tab-reading", text: "Reading" },
        { id: "tab-pinned", text: "Pinned" },
        unread && { id: "tab-inbox", text: `Inbox ${countOf(unread.length, unread.length)}` },
      ].filter((s): s is { id: string; text: string } => !!s);
      return zk.ui.column(
        [
          segmented(segments, `tab-${tab}`),
          items.length > 0
            ? coverGrid(items.map((item) => ({ item, caption: caption(item) })), columns())
            : zk.ui.text(EMPTY[tab], { tone: "secondary" }),
        ],
        { gap: "large" },
      );
    },
    onEvent: (e) => {
      if (e.kind === "open" || e.kind === "back") picked = null;
      else if (e.kind === "tap" && e.id.startsWith("tab-")) {
        const tab = e.id.slice(4) as Tab;
        if (TABS.includes(tab)) picked = tab;
      }
    },
  });
}
