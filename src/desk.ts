// Your desk (screen `all`, opened from Home's All › / Desk › / Drawer pills):
// Either a switch Reading · Pinned · Inbox n over a paged cover grid, or a single collection
// drawer opened from Reading Room's Drawers strip.

import {
  READING_WALK,
  authorsOf,
  collectionItems,
  countOf,
  inProgress,
  inboxItems,
  inboxOf,
  loadPins,
  loadPrefs,
  percentOf,
  pinnedItems,
} from "./data";
import { LARGE, coverGrid, kicker, pageWidth, perRow, pill, segmented } from "./pieces";

type Tab = "reading" | "pinned" | "inbox";
const TABS: Tab[] = ["reading", "pinned", "inbox"];

export interface DeskParams {
  tab?: Tab;
  collection?: { key: string; library: number; name: string };
}

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
/** Whether the user dismissed the drawer filter back to the full desk tabs. */
let clearedDrawer = false;

export function registerDesk() {
  zk.screen<DeskParams | undefined>("all", {
    title: "Your desk",
    render: async (params) => {
      // Opened from a Reading Room Drawer pill: show that collection's covers with a quick exit pill
      if (params?.collection && !clearedDrawer) {
        const col = params.collection;
        const items = await collectionItems({ key: col.key, library: col.library });
        return zk.ui.column(
          [
            zk.ui.row(
              [
                kicker(`DRAWER · ${col.name} (${countOf(items.length, items.length)})`),
                pill("All tabs ›", { id: "exit-drawer", radius: "round" }),
              ],
              { align: "center" },
            ),
            items.length > 0
              ? coverGrid(items.map((item) => ({ item, caption: caption(item) })), columns())
              : zk.ui.text("Nothing in this collection.", { tone: "secondary" }),
          ],
          { gap: "large" },
        );
      }

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
      if (e.kind === "open" || e.kind === "back") {
        picked = null;
        clearedDrawer = false;
      } else if (e.kind === "tap" && e.id === "exit-drawer") {
        clearedDrawer = true;
      } else if (e.kind === "tap" && e.id.startsWith("tab-")) {
        const tab = e.id.slice(4) as Tab;
        if (TABS.includes(tab)) picked = tab;
      }
    },
  });
}
