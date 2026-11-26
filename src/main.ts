// Reading Desk — a Home written by a plugin, composed only from the app's primitives (zk.ui).
// Offers three selectable Home layouts in Plugins → Reading Desk → Home layout:
//   - Folio        — editorial broadsheet with ink hero, last highlight recall, shaded companion
//                    paper, inline shelf tabs, numbered catalog, and commonplace quote
//   - Index Desk   — Swiss typographic cards (zero covers): black/white diptych, telemetry bar
//                    with Surprise me, 2×2/3×2 index card grid, and shaded excerpt
//   - Reading Room — full-width Book|Paper spotlight, captioned cover shelf, side-by-side Inbox
//                    + Commonplace, and one-tap collection drawers
//
// Permissions: "library:read" (items, collections) and "annotations:read" (highlights & passage).

import { registerHighlightWatchers } from "./data";
import { registerDesk } from "./desk";
import { registerHome } from "./home";
import { registerSettings } from "./settings";

registerHighlightWatchers();
registerHome();
registerDesk();
registerSettings();
