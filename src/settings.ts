// The settings screen (Plugins → Reading Desk: the inbox, the passage on or off, the pins) and its
// inbox picker; and the item action that pins and unpins.

import { MAX_PINS, type Pin, inboxOf, loadPins, loadPrefs, ref, same, savePrefs } from "./data";

/** "Probability / SPDEs", with the group's name for a group's collection. */
const collectionName = (c: zk.Collection) => c.path.join(" / ") + (c.libraryId !== 0 ? ` (${c.libraryName})` : "");

const authorsLine = (i: zk.Item) => {
  const names = i.creators.map((c) => c.last ?? c.name ?? "").filter(Boolean);
  const who = names.length > 2 ? `${names[0]} et al.` : names.join(", ");
  return [who, i.year ?? ""].filter(Boolean).join(" · ");
};

const label = (text: string) => zk.ui.text(text, { style: "label" });

/** The pin the settings screen is asking about (its row id), if any. */
let unpinAsk: string | null = null;
const pinId = (p: Pin) => `${p.library}:${p.key}`;

/** The inbox picker's search. */
let inboxSearch = "";

export function registerSettings() {
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

  zk.screen("settings", {
    title: "Settings",
    main: true,
    render: async () => {
      const prefs = await loadPrefs();
      const inbox = inboxOf(prefs);
      let inboxName = "None: no inbox on Home";
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
                subtitle: "One of your highlights on Home, a new one each day",
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
              subtitle: items[n] ? authorsLine(items[n]) : undefined,
              meta: "Unpin…", // a tap asks first
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
            ...(words.length === 0 ? [{ id: "none", title: "None", subtitle: "No inbox on Home", selected: !inbox }] : []),
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
}
