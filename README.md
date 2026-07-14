# D&D Beyond Tampermonkey Scripts

A small collection of userscripts that make [D&D Beyond](https://www.dndbeyond.com) easier to use. Install with [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari, etc.).

## Scripts

### [dndbeyond-content-library-filters.user.js](dndbeyond-content-library-filters.user.js)

Adds search, type/status filters, and sortable columns to a campaign's **Content Management** page (`/campaigns/<id>/content-management`) — the page listing which sourcebooks and adventures are shared or blocked from players. That page is normally just a long, unsorted table.

- Live search by name
- Filter chips for content type (Adventure / Sourcebook / Subscription / etc.) and status (Shared / Blocked)
- Click the existing Name / Type / Status column headers to sort (they're inert on the live site)
- Doesn't touch the actual share/block toggle — only hides and reorders rows

### [dndbeyond-quick-characters.user.js](dndbeyond-quick-characters.user.js)

Adds a "My Characters" quick-launch panel to the D&D Beyond home page (`dndbeyond.com/en`), docked to the right edge, visible immediately with no clicks.

- One click on a character jumps straight to its character sheet
- Star a character to favorite it — favorites and others are grouped into separate collapsible sections, so the list stays short even with a big roster
- The character list has no public API, so this script builds a cache the natural way: whenever you visit your own `/characters` page, it silently reads the character cards already rendered there and saves them locally. Visit that page once after installing to populate the list.
- Works for any player who installs it — nothing is hardcoded per-account

### [dndbeyond-hand-tracker.user.js](dndbeyond-hand-tracker.user.js)

Adds a small "Hands" panel (docked bottom-right) to every character sheet, for tracking what's in each hand during play — Empty, Shield, Flail, Longsword, or Greatsword (which occupies both hands automatically).

- Changing a hand prompts you to tag *how* — once-per-turn Object Interaction, an attack-linked draw/stow, or free (no cost) — and logs the last few changes
- Separate "Object Interaction" / "Attack Draw/Stow" indicators you toggle Available ↔ Used, with a "New Turn" button to reset both
- State is saved per character (keyed by the character ID in the URL), so each character tracks their own loadout independently

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open a script file above, or download it from this repo.
3. In Tampermonkey's dashboard, go to **Utilities → Import from file** and select the `.js` file (or just open the raw file — Tampermonkey will offer to install it).

## Updating

All scripts are self-contained with no build step. To update after a change, re-import the file in Tampermonkey (or paste the new contents into the script's editor and save), then refresh any open D&D Beyond tabs.
