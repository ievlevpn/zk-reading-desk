# Reading Desk

A Home for [Zotero for Kindle](https://github.com/ievlevpn/zotero-for-kindle): the book and the
paper you are in the middle of, the items you pinned, and what is new in an inbox collection.
Papers no longer push your book off Home.

## Install

On the Kindle (Zotero for Kindle 0.10.0 or later): *Settings → Plugins → Get plugins → Reading
Desk → Install*, turn it on, then *Settings → Home → Reading Desk — Reading Desk*. To go back,
choose *Built-in* there. If the plugin is turned off or stops, Home goes back to the built-in one
by itself.

## What it shows

- **BOOK · CONTINUE** — the book you opened last and haven't marked read (item type *Book* or
  *Book Section*, or an EPUB file).
- **PAPER · CONTINUE** — the same for anything else.
- **PINNED** — items you pinned: long-press an item → **More…** → **Pin to Home / Unpin**. The
  action toggles and says which it did. An item already under Continue isn't repeated.
- **NEW IN INBOX (n)** — unread items of one collection, newest added first. Shown only when the
  `inbox` setting is set.

"Unread" is the read mark, not progress: a book at 100% stays under Continue until you mark it
read (long-press → *Mark as read*). A tap opens the item in the reader; a long-press shows its
menu. The app draws the items and keeps their progress current; the plugin only picks which ones.

Pins live on this Kindle (the plugin's storage), not in Zotero.

## Settings

Over USB, create `zotero/plugins/reading-desk/settings.json`:

```json
{ "inbox": "ABCD2345" }
```

`inbox` is the key of a collection: the eight characters after `/collections/` in its address on
zotero.org (open the collection in the web library). Subcollections are not included.

## Permissions

`library:read`, to find the items to show.

## Build

```sh
npm install
node build.mjs        # dist/reading-desk/ — copy it to zotero/plugins/ on the Kindle
npx tsc -p .          # type-check
```

`types/zk.d.ts` is the plugin API from the app's `sdk/types/`.
