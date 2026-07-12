// ==UserScript==
// @name         D&D Beyond — Content Library Filters
// @namespace    https://claude.ai/dndbeyond-content-library
// @version      1.0.0
// @description  Adds search, type/status filters, and sortable columns to a campaign's Content Management page
// @author       you
// @match        https://www.dndbeyond.com/campaigns/*/content-management*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const BAR_ID = "cml-bar";
  const ROW_SELECTOR = "tr.listing__list-item";
  const NAME_SELECTOR = ".listing__list-item__column--name";
  const TYPE_SELECTOR = ".listing__list-item__column--type";
  const STATUS_SELECTOR = ".listing__list-item__column--status";

  const STYLE = `
    #${BAR_ID} {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      background: #fff;
      border: 1px solid #ddd6c6;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 0 0 14px;
      font-family: inherit;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    #${BAR_ID} .cml-search {
      flex: 1 1 200px;
      padding: 7px 10px;
      border: 1px solid #c9c2ac;
      border-radius: 6px;
      font-size: 14px;
    }
    #${BAR_ID} .cml-search:focus-visible { outline: 2px solid #7c5f2e; outline-offset: 1px; }
    #${BAR_ID} .cml-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    #${BAR_ID} .cml-chip {
      border: 1px solid #c9c2ac;
      background: #f6f2e6;
      color: #55503f;
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 12.5px;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    #${BAR_ID} .cml-chip:hover { border-color: #9c7a3f; }
    #${BAR_ID} .cml-chip[aria-pressed="true"] {
      background: #7c5f2e;
      border-color: #7c5f2e;
      color: #fff;
      font-weight: 600;
    }
    #${BAR_ID} .cml-count {
      font-size: 12.5px;
      color: #6b6555;
      white-space: nowrap;
      margin-left: auto;
    }
    #${BAR_ID} .cml-count b { color: #23261f; }
    .listing__column-heading__label.cml-sortable { cursor: pointer; }
    .cml-arrow { margin-left: 4px; font-size: 10px; opacity: 0.75; }
    tr.listing__list-item.cml-hidden { display: none !important; }
  `;

  function injectStyle() {
    if (document.getElementById("cml-style")) return;
    const style = document.createElement("style");
    style.id = "cml-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function getRows() {
    return Array.from(document.querySelectorAll(ROW_SELECTOR));
  }

  function cellText(row, selector) {
    const el = row.querySelector(selector);
    return el ? el.textContent.trim() : "";
  }

  function buildBar(anchor) {
    const bar = document.createElement("div");
    bar.id = BAR_ID;

    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Search by name…";
    search.className = "cml-search";
    search.autocomplete = "off";

    const typeChips = document.createElement("div");
    typeChips.className = "cml-chips";
    const statusChips = document.createElement("div");
    statusChips.className = "cml-chips";

    const count = document.createElement("span");
    count.className = "cml-count";

    bar.append(search, typeChips, statusChips, count);
    anchor.parentElement.insertBefore(bar, anchor);

    return { bar, search, typeChips, statusChips, count };
  }

  function renderChips(container, options, current, onPick) {
    container.innerHTML = "";
    options.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cml-chip";
      b.textContent = opt;
      b.setAttribute("aria-pressed", String(opt === current));
      b.addEventListener("click", () => onPick(opt));
      container.appendChild(b);
    });
  }

  function setupSortableHeaders(state, apply) {
    const map = {
      name: document.querySelector(".listing__column-heading--name button"),
      type: document.querySelector(".listing__column-heading--type button"),
      status: document.querySelector(".listing__column-heading--status button"),
    };
    Object.entries(map).forEach(([key, btn]) => {
      if (!btn || btn.dataset.cmlBound) return;
      btn.dataset.cmlBound = "1";
      btn.classList.add("cml-sortable");
      const arrow = document.createElement("span");
      arrow.className = "cml-arrow";
      btn.appendChild(arrow);
      btn.addEventListener("click", () => {
        if (state.sortKey === key) state.sortDir *= -1;
        else {
          state.sortKey = key;
          state.sortDir = 1;
        }
        apply();
      });
    });
    return map;
  }

  function updateArrows(state, headerButtons) {
    Object.entries(headerButtons).forEach(([key, btn]) => {
      if (!btn) return;
      const arrow = btn.querySelector(".cml-arrow");
      if (!arrow) return;
      arrow.textContent = key === state.sortKey ? (state.sortDir === 1 ? "▲" : "▼") : "";
    });
  }

  function init() {
    if (document.getElementById(BAR_ID)) return;
    const tbody = document.querySelector(".listing__items");
    const table = document.querySelector(".listing table");
    if (!tbody || !table) return;
    if (tbody.querySelectorAll(ROW_SELECTOR).length === 0) return;

    injectStyle();

    const state = { query: "", type: "All", status: "All", sortKey: null, sortDir: 1 };
    const rows = getRows();
    const typeOptions = ["All", ...Array.from(new Set(rows.map((r) => cellText(r, TYPE_SELECTOR)))).sort()];
    const statusOptions = ["All", ...Array.from(new Set(rows.map((r) => cellText(r, STATUS_SELECTOR)))).sort()];

    const { search, typeChips, statusChips, count } = buildBar(table);

    function apply() {
      const allRows = getRows();
      const q = state.query.trim().toLowerCase();
      let visible = 0;

      allRows.forEach((row) => {
        const name = cellText(row, NAME_SELECTOR);
        const type = cellText(row, TYPE_SELECTOR);
        const status = cellText(row, STATUS_SELECTOR);
        const match =
          (!q || name.toLowerCase().includes(q)) &&
          (state.type === "All" || type === state.type) &&
          (state.status === "All" || status === state.status);
        row.classList.toggle("cml-hidden", !match);
        if (match) visible++;
      });

      if (state.sortKey) {
        const sorted = allRows.slice().sort((a, b) => {
          const sel = state.sortKey === "name" ? NAME_SELECTOR : state.sortKey === "type" ? TYPE_SELECTOR : STATUS_SELECTOR;
          const av = cellText(a, sel).toLowerCase();
          const bv = cellText(b, sel).toLowerCase();
          return av < bv ? -1 * state.sortDir : av > bv ? 1 * state.sortDir : 0;
        });
        sorted.forEach((row) => tbody.appendChild(row));
      }

      const parts = [];
      if (state.query) parts.push(`matching "${state.query}"`);
      if (state.type !== "All") parts.push(`type: ${state.type}`);
      if (state.status !== "All") parts.push(`status: ${state.status}`);
      count.innerHTML = parts.length
        ? `<b>${visible}</b> of ${allRows.length} — ${parts.join(", ")}`
        : `<b>${allRows.length}</b> total`;

      updateArrows(state, headerButtons);
    }

    search.addEventListener("input", (e) => {
      state.query = e.target.value;
      apply();
    });
    function pickType(v) {
      state.type = v;
      renderChips(typeChips, typeOptions, state.type, pickType);
      apply();
    }
    function pickStatus(v) {
      state.status = v;
      renderChips(statusChips, statusOptions, state.status, pickStatus);
      apply();
    }
    renderChips(typeChips, typeOptions, state.type, pickType);
    renderChips(statusChips, statusOptions, state.status, pickStatus);

    const headerButtons = setupSortableHeaders(state, apply);

    apply();
  }

  init();
  new MutationObserver(init).observe(document.body, { childList: true, subtree: true });
})();
