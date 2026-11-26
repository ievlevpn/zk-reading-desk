// Home's body (screen `desk`, keeping the screen id so existing users' Settings → Home choice
// keeps working). Loads the library overview and dispatches to the layout chosen in Settings
// (Folio, Index Desk, or Reading Room).

import {
  cyclePassage,
  inboxItems,
  inboxOf,
  isBook,
  keptHighlightSummary,
  keptPassage,
  layoutOf,
  loadPins,
  loadPrefs,
  openPassage,
  openedOverview,
  pickSurpriseItem,
  pinnedItems,
  ref,
} from "./data";
import { type AtelierMode, type AtelierShelf, type FolioTab, type HomeModel, type HomeState, type IndexFilter, renderAtelier, renderFolio, renderIndex } from "./layouts";

const state: HomeState = {
  folioTab: "pinned",
  indexFilter: "all",
  atelierMode: "book",
  atelierShelf: "pinned",
};

/** Last rendered active keys (so Surprise Me avoids opening what's already on the desk). */
let lastActiveKeys = new Set<string>();
/** Last seen collections (so tapping a Drawer chip knows its name without a second query). */
let lastCollections: zk.Collection[] = [];

export function registerHome() {
  zk.screen("desk", {
    title: "Reading Desk",
    home: true,
    render: async () => {
      const prefs = await loadPrefs();
      const layout = layoutOf(prefs);
      const inbox = inboxOf(prefs);
      const [opened, pins, unread, collections, hl, passage] = await Promise.all([
        openedOverview(20),
        loadPins(),
        inbox ? inboxItems(inbox) : Promise.resolve(null),
        zk.library.collections(),
        keptHighlightSummary(),
        prefs.passage === false ? Promise.resolve(undefined) : keptPassage(),
      ]);
      const pinned = await pinnedItems(pins);

      // Fill missing book/paper slot from the first unstarted, unread pin of that kind
      const upNext = (book: boolean) => pinned.find((i) => isBook(i) === book && i.openedAt === null && !i.read);
      const book = opened.book ?? upNext(true);
      const paper = opened.paper ?? upNext(false);
      const hero = opened.recent[0] ?? book ?? paper;

      lastActiveKeys = new Set([book?.key, paper?.key, hero?.key].filter((k): k is string => !!k));
      lastCollections = collections;

      const model: HomeModel = {
        book,
        paper,
        hero,
        recent: opened.recent,
        pinned,
        inbox: unread,
        collections,
        colByKey: new Map(collections.map((c) => [c.key, c])),
        hl,
        passage,
      };

      if (layout === "index") return renderIndex(model, state);
      if (layout === "atelier") return renderAtelier(model, state);
      return renderFolio(model, state);
    },
    onEvent: async (e) => {
      if (e.kind !== "tap") return;
      const id = e.id;
      if (id === "ft-pinned" || id === "ft-inbox" || id === "ft-reading") {
        state.folioTab = id.slice(3) as FolioTab;
      } else if (id === "if-all" || id === "if-pinned" || id === "if-inbox") {
        state.indexFilter = id.slice(3) as IndexFilter;
      } else if (id === "am-book" || id === "am-paper") {
        state.atelierMode = id.slice(3) as AtelierMode;
      } else if (id === "as-pinned" || id === "as-recent") {
        state.atelierShelf = id.slice(3) as AtelierShelf;
      } else if (id === "next-passage") {
        await cyclePassage();
      } else if (id === "passage") {
        await openPassage();
      } else if (id === "surprise") {
        const pick = await pickSurpriseItem(lastActiveKeys);
        if (pick) {
          try {
            await zk.library.open(ref(pick));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!msg.includes("Cancelled")) console.warn("surprise item didn't open:", msg);
          }
        }
      } else if (id === "all-pinned") {
        zk.ui.open("all", { tab: "pinned" });
      } else if (id === "all-inbox") {
        zk.ui.open("all", { tab: "inbox" });
      } else if (id === "all-reading") {
        zk.ui.open("all", { tab: "reading" });
      } else if (id.startsWith("col:")) {
        const rest = id.slice(4);
        const colon = rest.indexOf(":");
        if (colon > 0) {
          const library = Number(rest.slice(0, colon));
          const key = rest.slice(colon + 1);
          const col = lastCollections.find((c) => c.libraryId === library && c.key === key);
          zk.ui.open("all", { collection: { key, library, name: col?.name ?? "Collection" } });
        }
      }
    },
  });
}
