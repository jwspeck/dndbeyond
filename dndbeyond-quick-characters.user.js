// ==UserScript==
// @name         D&D Beyond — Quick Character Switcher
// @namespace    https://claude.ai/dndbeyond-toolkit
// @version      3.0.0
// @description  Adds a favoritable, collapsible quick-launch character list to the D&D Beyond home page
// @author       you
// @match        https://www.dndbeyond.com/en*
// @match        https://www.dndbeyond.com/
// @match        https://www.dndbeyond.com/characters
// @match        https://www.dndbeyond.com/characters/
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const PANEL_ID = "ddb-qcs-panel";
  const CACHE_KEY = "ddbQcsCharacterCache_v1";
  const FAV_KEY = "ddbQcsFavorites_v1";
  const COLLAPSE_KEY = "ddbQcsCollapsed_v1";
  const SECTION_STATE_KEY = "ddbQcsSectionState_v1";

  // The character list has no public API — it's rendered client-side from
  // account data. So this script syncs a cache whenever you visit your own
  // /characters page, and the home page just reads that cache. Selectors
  // below are D&D Beyond's own DOM.
  const CARD_SELECTOR = ".ddb-campaigns-character-card-wrapper";
  const NAME_SELECTOR = "h2";
  const META_SELECTOR = ".ddb-campaigns-character-card-header-upper-character-info-secondary";
  const AVATAR_SELECTOR = ".image.user-selected-avatar";

  function getFavorites() {
    try {
      return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
    } catch {
      return new Set();
    }
  }
  function saveFavorites(set) {
    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set)));
  }
  function getCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch {
      return null;
    }
  }
  function saveCache(characters) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ characters, scrapedAt: Date.now() }));
  }
  function getSectionState() {
    try {
      return Object.assign({ favorites: true, other: false }, JSON.parse(localStorage.getItem(SECTION_STATE_KEY) || "{}"));
    } catch {
      return { favorites: true, other: false };
    }
  }
  function saveSectionState(state) {
    localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(state));
  }

  function extractCharacters(doc) {
    const cards = Array.from(doc.querySelectorAll(CARD_SELECTOR));
    function bgUrl(el) {
      if (!el || !el.style || !el.style.backgroundImage) return null;
      const m = el.style.backgroundImage.match(/url\((['"]?)(.*?)\1\)/);
      return m ? m[2] : null;
    }
    return cards
      .map((card) => {
        const link = card.querySelector('a[href*="/characters/"]');
        const idMatch = link ? link.href.match(/\/characters\/(\d+)/) : null;
        const nameEl = card.querySelector(NAME_SELECTOR);
        if (!idMatch || !nameEl) return null;
        const metaEl = card.querySelector(META_SELECTOR);
        const avatarEl = card.querySelector(AVATAR_SELECTOR);
        return {
          id: idMatch[1],
          name: nameEl.textContent.trim(),
          meta: metaEl ? metaEl.textContent.trim() : "",
          avatar: bgUrl(avatarEl),
        };
      })
      .filter(Boolean);
  }

  function relativeTime(ts) {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  }

  // ---- Runs on the Characters list page: silently syncs the cache ----
  function runListPageSync() {
    let lastCount = -1;
    let stableTicks = 0;
    const poll = setInterval(() => {
      const count = document.querySelectorAll(CARD_SELECTOR).length;
      if (count === 0) return;
      if (count === lastCount) stableTicks++;
      else {
        stableTicks = 0;
        lastCount = count;
      }
      if (stableTicks >= 2) {
        clearInterval(poll);
        saveCache(extractCharacters(document));
        showSyncToast(lastCount);
      }
    }, 350);
    setTimeout(() => clearInterval(poll), 20000);
  }

  function showSyncToast(count) {
    const toast = document.createElement("div");
    toast.textContent = `✓ Quick Character Switcher synced ${count} character${count === 1 ? "" : "s"}`;
    toast.style.cssText = `
      position: fixed; bottom: 18px; right: 18px; z-index: 9999;
      background: #191c22; color: #f2efe6; border: 1px solid rgba(201,164,99,0.4);
      padding: 9px 14px; border-radius: 8px; font: 12.5px ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35); opacity: 0; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ---- Runs on the home page: renders the quick-switcher panel ----
  const STYLE = `
    #${PANEL_ID} {
      position: fixed; right: 0; width: 268px; max-width: calc(100vw - 16px);
      background: #191c22; border: 1px solid rgba(201,164,99,0.35); border-right: none;
      border-radius: 10px 0 0 10px; box-shadow: -4px 0 18px rgba(0,0,0,0.35);
      font-family: ui-sans-serif, "Segoe UI", system-ui, sans-serif; color: #f2efe6;
      z-index: 900; display: flex; flex-direction: column; transition: width 0.15s ease;
    }
    @media (prefers-reduced-motion: reduce) { #${PANEL_ID} { transition: none; } }
    #${PANEL_ID}.qcs-collapsed { width: 40px; overflow: hidden; }
    #${PANEL_ID} .qcs-header {
      display: flex; align-items: center; gap: 6px; padding: 10px 10px;
      border-bottom: 1px solid rgba(201,164,99,0.25); flex-shrink: 0;
    }
    #${PANEL_ID} .qcs-title {
      font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
      color: #c9a463; white-space: nowrap; overflow: hidden; flex: 1;
    }
    #${PANEL_ID}.qcs-collapsed .qcs-title { visibility: hidden; }
    #${PANEL_ID} .qcs-iconbtn {
      background: none; border: none; color: #c9a463; cursor: pointer; font-size: 14px;
      line-height: 1; padding: 4px 6px; border-radius: 4px; flex-shrink: 0;
    }
    #${PANEL_ID} .qcs-iconbtn:hover { background: rgba(201,164,99,0.15); }
    #${PANEL_ID} .qcs-iconbtn:focus-visible { outline: 2px solid #c9a463; outline-offset: 1px; }
    #${PANEL_ID} .qcs-body { overflow-y: auto; overflow-x: hidden; }
    #${PANEL_ID}.qcs-collapsed .qcs-body { display: none; }
    #${PANEL_ID} .qcs-status { padding: 14px 12px; font-size: 12.5px; color: #9b9686; line-height: 1.5; }
    #${PANEL_ID} .qcs-status a { color: #c9a463; }
    #${PANEL_ID} .qcs-section + .qcs-section { border-top: 1px solid rgba(201,164,99,0.15); }
    #${PANEL_ID} .qcs-section-toggle {
      all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 7px;
      cursor: pointer; padding: 9px 10px; font-family: inherit; text-align: left;
    }
    #${PANEL_ID} .qcs-section-toggle:hover { background: rgba(255,255,255,0.04); }
    #${PANEL_ID} .qcs-section-toggle:focus-visible { outline: 2px solid #c9a463; outline-offset: -2px; }
    #${PANEL_ID} .qcs-arrow { color: #c9a463; font-size: 10px; width: 10px; flex-shrink: 0; }
    #${PANEL_ID} .qcs-section-title { font-size: 12.5px; font-weight: 700; color: #f2efe6; }
    #${PANEL_ID} .qcs-section-subtitle {
      font-size: 11px; color: #6a6656; font-weight: 400; font-style: italic;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #${PANEL_ID} .qcs-section-count {
      margin-left: auto; font-size: 11px; color: #6a6656; font-variant-numeric: tabular-nums; flex-shrink: 0;
    }
    #${PANEL_ID} .qcs-section-list { list-style: none; margin: 0; padding: 0 0 4px; }
    #${PANEL_ID} .qcs-section-hint { padding: 2px 10px 10px; font-size: 11.5px; color: #6a6656; }
    #${PANEL_ID} .qcs-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    #${PANEL_ID} .qcs-row:hover { background: rgba(255,255,255,0.05); }
    #${PANEL_ID} .qcs-section-list li.qcs-row:last-child { border-bottom: none; }
    #${PANEL_ID} .qcs-star {
      all: unset; cursor: pointer; font-size: 15px; color: #6a6656; padding: 2px; flex-shrink: 0;
    }
    #${PANEL_ID} .qcs-star[aria-pressed="true"] { color: #e8c07d; }
    #${PANEL_ID} .qcs-star:hover { color: #e8c07d; }
    #${PANEL_ID} .qcs-avatar {
      width: 34px; height: 34px; border-radius: 50%; background-color: #2a2e37;
      background-size: cover; background-position: center; flex-shrink: 0;
      border: 1px solid rgba(201,164,99,0.3);
    }
    #${PANEL_ID} .qcs-info { min-width: 0; flex: 1; }
    #${PANEL_ID} .qcs-name {
      font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${PANEL_ID} .qcs-meta {
      font-size: 11px; color: #9b9686; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${PANEL_ID} .qcs-footer {
      padding: 7px 10px; font-size: 11px; color: #6a6656; border-top: 1px solid rgba(255,255,255,0.05);
      display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
    }
    #${PANEL_ID} .qcs-footer a { color: #9b9686; text-decoration: none; }
    #${PANEL_ID} .qcs-footer a:hover { color: #c9a463; }
  `;

  function injectStyle() {
    if (document.getElementById("ddb-qcs-style")) return;
    const style = document.createElement("style");
    style.id = "ddb-qcs-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "qcs-header";
    const title = document.createElement("span");
    title.className = "qcs-title";
    title.textContent = "My Characters";
    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "qcs-iconbtn";
    collapseBtn.title = "Collapse";
    collapseBtn.textContent = "›";
    header.append(title, collapseBtn);

    const body = document.createElement("div");
    body.className = "qcs-body";
    const status = document.createElement("div");
    status.className = "qcs-status";
    status.hidden = true;
    const sections = document.createElement("div");
    sections.className = "qcs-sections";
    body.append(status, sections);

    const footer = document.createElement("div");
    footer.className = "qcs-footer";
    const synced = document.createElement("span");
    const resync = document.createElement("a");
    resync.href = "https://www.dndbeyond.com/characters";
    resync.textContent = "Resync ↻";
    footer.append(synced, resync);

    panel.append(header, body, footer);
    return { panel, status, sections, collapseBtn, footer, synced };
  }

  function buildRow(c, favorites, panelEls, cache) {
    const li = document.createElement("li");
    li.className = "qcs-row";

    const star = document.createElement("button");
    star.type = "button";
    star.className = "qcs-star";
    const isFav = favorites.has(c.id);
    star.textContent = isFav ? "★" : "☆";
    star.setAttribute("aria-pressed", String(isFav));
    star.title = isFav ? "Unfavorite" : "Favorite";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      if (favorites.has(c.id)) favorites.delete(c.id);
      else favorites.add(c.id);
      saveFavorites(favorites);
      render(panelEls, cache, favorites);
    });

    const avatar = document.createElement("div");
    avatar.className = "qcs-avatar";
    if (c.avatar) avatar.style.backgroundImage = `url("${c.avatar}")`;

    const info = document.createElement("div");
    info.className = "qcs-info";
    const nameEl = document.createElement("div");
    nameEl.className = "qcs-name";
    nameEl.textContent = c.name;
    const metaEl = document.createElement("div");
    metaEl.className = "qcs-meta";
    metaEl.textContent = c.meta;
    info.append(nameEl, metaEl);

    li.append(star, avatar, info);
    li.addEventListener("click", () => {
      window.location.href = `https://www.dndbeyond.com/characters/${c.id}`;
    });
    return li;
  }

  function buildSection(key, title, subtitle, characters, expanded, emptyHint, panelEls, cache, favorites, sectionState) {
    const section = document.createElement("div");
    section.className = "qcs-section";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "qcs-section-toggle";
    toggle.setAttribute("aria-expanded", String(expanded));

    const arrow = document.createElement("span");
    arrow.className = "qcs-arrow";
    arrow.textContent = expanded ? "▾" : "▸";
    const titleEl = document.createElement("span");
    titleEl.className = "qcs-section-title";
    titleEl.textContent = title;
    const count = document.createElement("span");
    count.className = "qcs-section-count";
    count.textContent = String(characters.length);

    toggle.append(arrow, titleEl);
    if (subtitle) {
      const subtitleEl = document.createElement("span");
      subtitleEl.className = "qcs-section-subtitle";
      subtitleEl.textContent = subtitle;
      toggle.append(subtitleEl);
    }
    toggle.append(count);

    toggle.addEventListener("click", () => {
      sectionState[key] = !sectionState[key];
      saveSectionState(sectionState);
      render(panelEls, cache, favorites);
    });

    const ul = document.createElement("ul");
    ul.className = "qcs-section-list";
    ul.hidden = !expanded;

    if (characters.length === 0 && emptyHint) {
      const hint = document.createElement("li");
      hint.className = "qcs-section-hint";
      hint.textContent = emptyHint;
      ul.appendChild(hint);
    } else {
      characters.forEach((c) => ul.appendChild(buildRow(c, favorites, panelEls, cache)));
    }

    section.append(toggle, ul);
    return section;
  }

  function render(panelEls, cache, favorites) {
    const { status, sections, footer, synced } = panelEls;
    sections.innerHTML = "";

    const characters = cache ? cache.characters : null;
    if (!characters || characters.length === 0) {
      footer.hidden = true;
      status.innerHTML = `No characters synced yet. Visit your <a href="https://www.dndbeyond.com/characters">Characters page</a> once to build this list.`;
      status.hidden = false;
      return;
    }
    status.hidden = true;
    footer.hidden = false;
    synced.textContent = `Synced ${relativeTime(cache.scrapedAt)}`;

    const favList = characters.filter((c) => favorites.has(c.id));
    const otherList = characters.filter((c) => !favorites.has(c.id));
    const sectionState = getSectionState();

    sections.appendChild(
      buildSection(
        "favorites",
        "Favorites",
        null,
        favList,
        sectionState.favorites,
        "Click ☆ next to a character to pin it here.",
        panelEls,
        cache,
        favorites,
        sectionState
      )
    );
    sections.appendChild(
      buildSection(
        "other",
        "Other",
        "(but we love you all equally)",
        otherList,
        sectionState.other,
        null,
        panelEls,
        cache,
        favorites,
        sectionState
      )
    );
  }

  function positionPanel(panel) {
    const header = document.querySelector("header");
    const top = header ? header.getBoundingClientRect().bottom + 12 : 130;
    panel.style.top = top + "px";
    panel.style.maxHeight = Math.max(160, window.innerHeight - top - 16) + "px";
  }

  function runHomePanel() {
    if (document.getElementById(PANEL_ID)) return;
    injectStyle();

    const panelEls = buildPanel();
    document.body.appendChild(panelEls.panel);

    positionPanel(panelEls.panel);
    window.addEventListener("resize", () => positionPanel(panelEls.panel));
    const header = document.querySelector("header");
    if (header && window.ResizeObserver) {
      new ResizeObserver(() => positionPanel(panelEls.panel)).observe(header);
    }

    if (localStorage.getItem(COLLAPSE_KEY) === "1") panelEls.panel.classList.add("qcs-collapsed");
    panelEls.collapseBtn.addEventListener("click", () => {
      const collapsed = panelEls.panel.classList.toggle("qcs-collapsed");
      panelEls.collapseBtn.textContent = collapsed ? "‹" : "›";
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    });
    if (panelEls.panel.classList.contains("qcs-collapsed")) panelEls.collapseBtn.textContent = "‹";

    render(panelEls, getCache(), getFavorites());
  }

  const path = window.location.pathname;
  if (path === "/characters" || path === "/characters/") {
    runListPageSync();
  } else if (path === "/en" || path === "/") {
    runHomePanel();
  }
})();
