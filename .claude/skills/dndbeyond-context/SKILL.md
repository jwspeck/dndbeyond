---
name: dndbeyond-context
description: Reference context for the D&D Beyond Tampermonkey scripts in this repo (dndbeyond-content-library-filters.user.js and dndbeyond-quick-characters.user.js) — the DOM selectors they depend on, why there's no public API to call instead, the localStorage caching design, and the browser-based workflow used to build and verify them against the live site. Consult this whenever editing either script, adding a new D&D Beyond userscript, debugging a selector that seems to have stopped matching, or doing anything in this project directory or its GitHub repo (jwspeck/dndbeyond) — even if the user just says something like "fix the character panel" or "add a feature to the filter script" without mentioning this skill by name.
---

# D&D Beyond userscripts — project context

This repo holds two standalone Tampermonkey userscripts for dndbeyond.com. Both were built by reverse-engineering the live site through browser automation (Chrome DevTools Protocol via the claude-in-chrome MCP), not from any documented API — because there isn't one. That reverse-engineering is the expensive part to redo, so this file captures what was learned.

## The scripts

**`dndbeyond-content-library-filters.user.js`** — adds search, type/status filters, and clickable column-sort to a campaign's Content Management page (`/campaigns/<id>/content-management`), which normally has none.

**`dndbeyond-quick-characters.user.js`** — adds a favoritable, collapsible "My Characters" quick-launch panel to the home page (`/en`), so you can jump straight to a character sheet without visiting the full character list first.

Both are self-contained (`@grant none`, no build step, no dependencies) so anyone can install them via Tampermonkey without trusting a remote update URL.

## Why there's no API call to make

Both the character list (`/characters`) and the content-management page render their data entirely client-side. A plain `fetch()` of either URL returns an HTML shell with no character/content data in it — confirmed by fetching the raw HTML and searching for known strings (a character name, a card's CSS class) and finding nothing. Watching network traffic while the page loads (via `read_network_requests`) shows no XHR/fetch call carrying the character or content data either — just analytics beacons. So the data isn't coming from a REST/GraphQL call you can intercept; it's most likely embedded in a client-side cache (IndexedDB/service worker) that never touches the network on repeat visits.

**Practical consequence:** don't go looking for a network request to call directly — there isn't one to find. Both scripts work by reading the DOM *after* D&D Beyond's own React app has rendered it, not by fetching data.

## Selectors these scripts depend on

D&D Beyond's markup mixes two kinds of class names: stable, hand-written BEM-style classes (e.g. `.ddb-campaigns-character-card-wrapper`, `.listing__list-item`), and hashed CSS-module classes that change per build (e.g. `styles_name__cxD14`). **Always prefer the stable classes.** They were found by inspecting the live DOM (`javascript_tool` + `querySelector`/`getBoundingClientRect`), not by reading source — if a selector below stops matching, re-inspect the live page the same way rather than guessing.

### Characters page (`/characters`)

| What | Selector |
|---|---|
| Each character card | `.ddb-campaigns-character-card-wrapper` |
| Name | first `h2` inside the card |
| Level / species / class line | `.ddb-campaigns-character-card-header-upper-character-info-secondary` |
| Avatar | `.image.user-selected-avatar` — a CSS `background-image`, **not** an `<img>` tag |
| Character ID | regex `/\/characters\/(\d+)/` on the `href` of `a[href*="/characters/"]` inside the card |

All cards render into the DOM at once (no pagination/virtualization observed, tested with 21 characters), but rendering is asynchronous after page load — poll for the card count to stop changing (2 stable checks, 350ms apart) before reading, rather than reading immediately or on a fixed delay.

### Content-management page (`/campaigns/<id>/content-management`)

| What | Selector |
|---|---|
| Each row | `tr.listing__list-item` inside `tbody.listing__items` |
| Name / Type / Status cells | `.listing__list-item__column--name` / `--type` / `--status` |
| Blocked vs Shared | the status `<td>` gets an extra `blocked` class when blocked; no extra class when shared — don't rely on the text alone if you need a CSS hook |
| Column header buttons | `.listing__column-heading--name button` etc. — these exist and are clickable-looking but ship with class `non-sortable-label` and no click handler; the filter script repurposes them for sorting |

## Why the character cache is built the way it is

The first version of the quick-characters panel scraped data live by loading `/characters` in a hidden `<iframe>` in the background and reading its DOM once rendered. It worked, but had real downsides: ~3-4s latency on cache miss, and every scrape fired D&D Beyond's own analytics beacons as a phantom page view.

The current design instead has the script run on **both** pages:
- On `/characters` (a page the user visits naturally anyway), it polls until the cards stabilize, scrapes them, and writes the result to `localStorage`.
- On the home page, the panel *only* reads that cache — it never scrapes itself.

This trades "always fresh" for "fresh as of your last visit to /characters," which is the right tradeoff here (per explicit user preference — see repo history) because it's simpler, has no background network/analytics side effects, and the character list doesn't change often enough to justify the complexity of live background scraping.

If you're asked to make the panel "always up to date," don't reach for the hidden-iframe approach again unless explicitly asked — it was deliberately removed.

## localStorage keys (quick-characters script)

| Key | Holds |
|---|---|
| `ddbQcsCharacterCache_v1` | `{ characters: [...], scrapedAt: <timestamp> }` — written by the `/characters` sync, read by the home panel |
| `ddbQcsFavorites_v1` | JSON array of favorited character IDs (strings) |
| `ddbQcsCollapsed_v1` | `"1"` if the whole panel is collapsed to its edge tab |
| `ddbQcsSectionState_v1` | `{ favorites: bool, other: bool }` — per-section expand/collapse state; defaults to favorites-open/other-closed if unset |

If you add a new persisted feature, bump the `_v1` suffix (e.g. `_v2`) only if the stored shape changes incompatibly — otherwise reuse the existing key so users don't lose data on update.

The filter/sort script (`dndbeyond-content-library-filters.user.js`) has no persistence — it only manipulates already-visible DOM state, so there's nothing to cache between visits.

## Dev workflow that worked

1. Use the **claude-in-chrome** MCP tools against the *live* dndbeyond.com, not a local mock — there's no local dev environment for this site.
2. Prototype changes by injecting the script body via `mcp__claude-in-chrome__javascript_tool` directly into the live page first, and confirm behavior (click things, read back DOM state, screenshot) before writing the final version to the `.user.js` file. This catches selector drift and layout issues immediately instead of after install.
3. When inspecting the DOM, avoid dumping full `outerHTML` of large subtrees — if it contains anything that looks like a query string or cookie value (e.g. signed avatar image URLs), the tool call gets blocked by a content filter. Query targeted properties instead (`className`, `textContent`, `getBoundingClientRect()`, specific attributes).
4. Always take a screenshot (and/or re-query the live DOM state) after a change to confirm it visually, rather than trusting the code alone — this project has caught real bugs this way (e.g. a stale cached `<style>` tag from an earlier test run silently shadowing new CSS).
5. **Tampermonkey does not watch the file on disk.** After editing a `.user.js` file, the user has to re-import it in Tampermonkey's dashboard (or paste the new contents into its editor) and reload any open D&D Beyond tabs — editing the repo file alone does nothing until that happens. Say this explicitly when handing off a change.

## Where things live

- Local repo: `C:\Users\gamer\Claude projects\dndbeyond`
- GitHub: [github.com/jwspeck/dndbeyond](https://github.com/jwspeck/dndbeyond) (public)
- `gh` CLI is installed and authenticated as `jwspeck` on this machine — repo operations (push, PR, etc.) can be done directly, no need to re-auth.
- The user also keeps working copies in `C:\Users\gamer\Downloads\` for easy Tampermonkey import — when you change a script, update both the repo copy and, if asked to hand it to the user directly, the Downloads copy.
