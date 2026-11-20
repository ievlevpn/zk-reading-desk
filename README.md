# Reading Desk

A Home for [Zotero for Kindle](https://github.com/ievlevpn/zotero-for-kindle): the book and the paper
you are in, side by side; a row of your pins; what is new in an inbox, or a passage from your
highlights each day; and Your desk one tap away. It is built only from the app's primitives —
rows with widths and alignment, `spacer`, `box`, styled `text`, `cover`, `progress`, `item`, `grid`
and a Home body's `fit: "trim"` (see
[Composing screens from primitives](https://github.com/ievlevpn/zotero-for-kindle/blob/master/docs/plugins/composing.md));
the pieces it is made of are in `src/pieces.ts`.

![Reading Desk on a Paperwhite](screenshot.png)

## Install

On the Kindle (Zotero for Kindle 0.12.0 or later): *Settings → Plugins → Get plugins → Reading Desk →
Install*, turn it on, then *Settings → Home → Reading Desk — Reading Desk*. To go back, choose *Built-in*
there; if the plugin stops, Home goes back by itself.

## Home

Three bands, and never a pager: the body's root column is trimmed to the page, so what doesn't
fit is left out from the end (first the passage, then inbox lines, then the row of pins).

- **The pair** — **BOOK** on the left, **PAPER** on the right: the most recently opened item of
  each kind not marked read, its cover, title, authors, a bar and "13% · today". A book is item
  type `book` or `bookSection`, or an EPUB file; everything else is a paper. A kind with nothing
  opened shows its first pin never opened and not read, **UP NEXT**, "Not started". A kind with
  nothing at all: the other side takes the whole width; neither: no pair. A Paperwhite or a basic
  Kindle turned: smaller covers and titles in 2 lines, so the row of pins fits under the pair.
- **Pinned** — **All n ›** (every pin) and one row of covers in pin order, minus the pair: 5 on a
  Paperwhite, 4 on a basic Kindle, 7 on a Scribe (covers are about as wide on every Kindle, so a
  wider screen holds more). A bar under a cover once it was opened.
- **Inbox · n new** — **All ›** and the newest unread items of the inbox collection as lines:
  title, "authors · year", and when it was added ("today", "yesterday", "Mon", "Nov 12"). 2 lines,
  up to 5 on a Scribe; minus the pair (n counts every unread item, as Your desk's Inbox n). At most the newest 100 are looked at ("99+").
- **A passage** — one of your highlights (40–400 characters, from the newest 300), picked once a
  day and the same all day, in the inbox's band when there is no inbox or nothing new in it, and
  under the inbox on a Scribe. The pick runs after Home has drawn (it then refreshes); until then
  yesterday's shows. Tap it: the reader opens at that highlight (the highlight deleted: the item
  where you left it; the item gone: another passage is picked). Off in the settings.

First use (nothing opened, no pins, no inbox): a line on how to start, and the passage.

Taps open items; long-press shows the library's item menu; **All ›** opens Your desk. When Home
has no All › (no pins in the row, no inbox band), a quiet **Your desk ›** under the pair leads there.

## Your desk

A switch **Reading · Pinned · Inbox n** (Inbox only with an inbox), on the tab of the All ›
tapped, over a grid of covers that pages (4 a row, 6 on a Scribe): each with its bar once opened,
its title and "author · 42%" ("Read" once marked read).

- **Reading**: opened and not marked read, books and papers together, most recent first (60).
- **Pinned**: every pin, in pin order.
- **Inbox**: unread inbox items, newest added first (100).

## Pins

Long-press an item → **More…** → **Pin to Home / Unpin**. The action toggles and says which it
did. At most 50 pins.

## Settings

Plugins → **Reading Desk**:

- **Inbox collection** — a searchable list of your collections, or *None*.
- **A passage each day** — on or off.
- **Pinned** — your pins; tap one, then **Unpin**.

0.1's `settings.json` (`{ "inbox": "ABCD2345" }`, see `settings.example.json`) is still read
until you pick an inbox (or *None*) there.

## Permissions

`library:read`, for the items and collections; `annotations:read`, for the passage. What it keeps
is in the plugin's own storage: `pins` (`{ key, library }[]`), `prefs` and the day's `passage`.
(0.2's `tab` is no longer written, and ignored.)

## Build

```sh
npm install
node build.mjs        # dist/reading-desk/ — copy it to zotero/plugins/ on the Kindle
npx tsc -p .          # type-check
```

`types/zk.d.ts` is the plugin API from the app's `sdk/types/`. The sources are the app's
`sdk/examples/reading-desk/`.
