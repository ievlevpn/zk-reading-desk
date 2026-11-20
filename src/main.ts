// Reading Desk — a Home written by a plugin, composed only from the app's primitives (zk.ui:
// rows, columns, text, boxes, covers, bars, items, grids). Nothing on it is drawn by
// Reading-Desk-specific code in the app.
//
//   home.ts       Home's body (screen `desk`): the book and the paper being read, a row of pins,
//                 the inbox or a passage from your highlights; trimmed to the page, never paged
//   desk.ts       Your desk (screen `all`): Reading · Pinned · Inbox, a paged grid of covers
//   settings.ts   Plugins → Reading Desk (inbox, passage, pins), the inbox picker, the pin action
//   pieces.ts     the composed pieces: a label, a heading with a link, the pair's side, a row of
//                 covers, text lines, a segmented switch, a grid of captioned covers
//   data.ts       storage, the walks over the library, the passage, bylines and dates
//
// Permissions: "library:read" (the items, the collections) and "annotations:read" (the passage).

import { registerDesk } from "./desk";
import { registerHome } from "./home";
import { registerSettings } from "./settings";

registerHome();
registerDesk();
registerSettings();
