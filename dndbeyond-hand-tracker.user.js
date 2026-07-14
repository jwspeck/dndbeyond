// ==UserScript==
// @name         D&D Beyond — Hand Tracker
// @namespace    https://claude.ai/dndbeyond-toolkit
// @version      1.0.0
// @description  Tracks what's in each hand on a character sheet, plus the once-per-turn object interaction and attack-linked draw/stow
// @author       you
// @match        https://www.dndbeyond.com/characters/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const PANEL_ID = "ddb-ht-panel";
  const TWO_HANDED = "Greatsword";
  const OPTIONS = ["Empty", "Shield", "Flail", "Longsword", "Greatsword"];
  const ICONS = { Empty: "✋", Shield: "🛡", Flail: "⛓", Longsword: "🗡", Greatsword: "⚔️" };

  const charIdMatch = window.location.pathname.match(/\/characters\/(\d+)/);
  if (!charIdMatch) return;
  const STORAGE_KEY = `ddbHandTracker_${charIdMatch[1]}`;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && parsed.hands) return parsed;
    } catch {}
    return { hands: { left: "Empty", right: "Empty" }, turn: { objectUsed: false, attackUsed: false }, log: [] };
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const STYLE = `
    #${PANEL_ID} {
      position: fixed; right: 16px; bottom: 16px; width: 250px; max-width: calc(100vw - 32px);
      background: #191c22; border: 1px solid rgba(201,164,99,0.35); border-radius: 10px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4); font-family: ui-sans-serif, "Segoe UI", system-ui, sans-serif;
      color: #f2efe6; z-index: 900;
    }
    #${PANEL_ID}.ht-collapsed .ht-body { display: none; }
    #${PANEL_ID} .ht-header {
      display: flex; align-items: center; gap: 6px; padding: 9px 10px;
      border-bottom: 1px solid rgba(201,164,99,0.25); cursor: pointer;
    }
    #${PANEL_ID}.ht-collapsed .ht-header { border-bottom: none; }
    #${PANEL_ID} .ht-title {
      font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #c9a463; flex: 1;
    }
    #${PANEL_ID} .ht-caret { color: #c9a463; font-size: 11px; transition: transform 0.15s ease; }
    @media (prefers-reduced-motion: reduce) { #${PANEL_ID} .ht-caret { transition: none; } }
    #${PANEL_ID}.ht-collapsed .ht-caret { transform: rotate(180deg); }
    #${PANEL_ID} .ht-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    #${PANEL_ID} .ht-hand { border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px; }
    #${PANEL_ID} .ht-hand-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    #${PANEL_ID} .ht-hand-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #9b9686; }
    #${PANEL_ID} .ht-hand-current { font-size: 13px; font-weight: 600; }
    #${PANEL_ID} .ht-options { display: flex; flex-wrap: wrap; gap: 5px; }
    #${PANEL_ID} .ht-opt {
      all: unset; cursor: pointer; font-size: 11.5px; padding: 4px 8px; border-radius: 999px;
      background: rgba(255,255,255,0.05); color: #cfcabb; border: 1px solid rgba(255,255,255,0.08);
    }
    #${PANEL_ID} .ht-opt:hover { border-color: #c9a463; color: #f2efe6; }
    #${PANEL_ID} .ht-opt[aria-pressed="true"] { background: #c9a463; color: #191c22; font-weight: 700; border-color: #c9a463; }
    #${PANEL_ID} .ht-tagprompt { display: flex; flex-direction: column; gap: 5px; }
    #${PANEL_ID} .ht-tagprompt-label { font-size: 11px; color: #9b9686; }
    #${PANEL_ID} .ht-tagbtn {
      all: unset; cursor: pointer; font-size: 11.5px; padding: 5px 8px; border-radius: 6px;
      background: rgba(201,164,99,0.12); color: #e8c07d; border: 1px solid rgba(201,164,99,0.3); text-align: left;
    }
    #${PANEL_ID} .ht-tagbtn:hover { background: rgba(201,164,99,0.22); }
    #${PANEL_ID} .ht-tagbtn.ht-cancel { color: #9b9686; background: none; border-color: rgba(255,255,255,0.1); }
    #${PANEL_ID} .ht-turn { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    #${PANEL_ID} .ht-turn-row { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }
    #${PANEL_ID} .ht-resource {
      all: unset; cursor: pointer; font-size: 11px; padding: 3px 9px; border-radius: 999px; font-weight: 600;
    }
    #${PANEL_ID} .ht-resource.ht-available { background: rgba(111,191,149,0.18); color: #6fbf95; }
    #${PANEL_ID} .ht-resource.ht-used { background: rgba(217,130,102,0.15); color: #9b9686; }
    #${PANEL_ID} .ht-newturn {
      all: unset; cursor: pointer; text-align: center; font-size: 11.5px; padding: 6px; border-radius: 6px;
      background: rgba(255,255,255,0.05); color: #cfcabb; border: 1px solid rgba(255,255,255,0.08);
    }
    #${PANEL_ID} .ht-newturn:hover { border-color: #c9a463; color: #f2efe6; }
    #${PANEL_ID} .ht-log { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px; }
    #${PANEL_ID} .ht-log-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #9b9686; margin-bottom: 4px; }
    #${PANEL_ID} .ht-log-list { list-style: none; margin: 0; padding: 0; max-height: 110px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
    #${PANEL_ID} .ht-log-list li { font-size: 11px; color: #9b9686; line-height: 1.4; }
    #${PANEL_ID} .ht-log-list li b { color: #cfcabb; font-weight: 600; }
    #${PANEL_ID} .ht-empty { font-size: 11px; color: #6a6656; font-style: italic; }
  `;

  function injectStyle() {
    if (document.getElementById("ddb-ht-style")) return;
    const style = document.createElement("style");
    style.id = "ddb-ht-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function applyHandChange(state, hand, value) {
    if (value === TWO_HANDED) {
      state.hands.left = TWO_HANDED;
      state.hands.right = TWO_HANDED;
    } else {
      const other = hand === "left" ? "right" : "left";
      if (state.hands[other] === TWO_HANDED) state.hands[other] = "Empty";
      state.hands[hand] = value;
    }
  }

  function addLogEntry(state, text) {
    state.log.unshift({ text, ts: Date.now() });
    state.log = state.log.slice(0, 8);
  }

  function render(root, state) {
    root.innerHTML = "";

    ["left", "right"].forEach((hand) => {
      const card = document.createElement("div");
      card.className = "ht-hand";

      const top = document.createElement("div");
      top.className = "ht-hand-top";
      const label = document.createElement("span");
      label.className = "ht-hand-label";
      label.textContent = hand === "left" ? "Left Hand" : "Right Hand";
      const current = document.createElement("span");
      current.className = "ht-hand-current";
      const value = state.hands[hand];
      current.textContent = `${ICONS[value] || "❓"} ${value}`;
      top.append(label, current);
      card.appendChild(top);

      if (state.pending && state.pending.hand === hand) {
        const prompt = document.createElement("div");
        prompt.className = "ht-tagprompt";
        const promptLabel = document.createElement("div");
        promptLabel.className = "ht-tagprompt-label";
        promptLabel.textContent = `Switch to ${state.pending.value} using:`;
        prompt.appendChild(promptLabel);

        const tags = [
          { key: "object", label: "🎯 Object Interaction (once/turn)" },
          { key: "attack", label: "⚔️ Draw/stow with attack" },
          { key: "free", label: "✅ Free (no cost)" },
        ];
        tags.forEach((tag) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "ht-tagbtn";
          btn.textContent = tag.label;
          btn.addEventListener("click", () => {
            const from = state.hands[hand];
            const to = state.pending.value;
            applyHandChange(state, hand, to);
            if (tag.key === "object") state.turn.objectUsed = true;
            if (tag.key === "attack") state.turn.attackUsed = true;
            const tagText = tag.key === "object" ? "object interaction" : tag.key === "attack" ? "attack draw/stow" : "free";
            addLogEntry(state, `<b>${hand === "left" ? "Left" : "Right"}</b>: ${from} → ${to} (${tagText})`);
            state.pending = null;
            saveState(state);
            render(root, state);
          });
          prompt.appendChild(btn);
        });

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "ht-tagbtn ht-cancel";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => {
          state.pending = null;
          render(root, state);
        });
        prompt.appendChild(cancel);

        card.appendChild(prompt);
      } else {
        const options = document.createElement("div");
        options.className = "ht-options";
        OPTIONS.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "ht-opt";
          btn.textContent = `${ICONS[opt]} ${opt}`;
          btn.setAttribute("aria-pressed", String(state.hands[hand] === opt));
          btn.addEventListener("click", () => {
            if (state.hands[hand] === opt) return;
            state.pending = { hand, value: opt };
            render(root, state);
          });
          options.appendChild(btn);
        });
        card.appendChild(options);
      }

      root.appendChild(card);
    });

    const turn = document.createElement("div");
    turn.className = "ht-turn";

    const objRow = document.createElement("div");
    objRow.className = "ht-turn-row";
    const objLabel = document.createElement("span");
    objLabel.textContent = "Object Interaction";
    const objBtn = document.createElement("button");
    objBtn.type = "button";
    objBtn.className = `ht-resource ${state.turn.objectUsed ? "ht-used" : "ht-available"}`;
    objBtn.textContent = state.turn.objectUsed ? "Used" : "Available";
    objBtn.addEventListener("click", () => {
      state.turn.objectUsed = !state.turn.objectUsed;
      saveState(state);
      render(root, state);
    });
    objRow.append(objLabel, objBtn);

    const atkRow = document.createElement("div");
    atkRow.className = "ht-turn-row";
    const atkLabel = document.createElement("span");
    atkLabel.textContent = "Attack Draw/Stow";
    const atkBtn = document.createElement("button");
    atkBtn.type = "button";
    atkBtn.className = `ht-resource ${state.turn.attackUsed ? "ht-used" : "ht-available"}`;
    atkBtn.textContent = state.turn.attackUsed ? "Used" : "Available";
    atkBtn.addEventListener("click", () => {
      state.turn.attackUsed = !state.turn.attackUsed;
      saveState(state);
      render(root, state);
    });
    atkRow.append(atkLabel, atkBtn);

    const newTurnBtn = document.createElement("button");
    newTurnBtn.type = "button";
    newTurnBtn.className = "ht-newturn";
    newTurnBtn.textContent = "New Turn ↻";
    newTurnBtn.addEventListener("click", () => {
      state.turn.objectUsed = false;
      state.turn.attackUsed = false;
      saveState(state);
      render(root, state);
    });

    turn.append(objRow, atkRow, newTurnBtn);
    root.appendChild(turn);

    const log = document.createElement("div");
    log.className = "ht-log";
    const logTitle = document.createElement("div");
    logTitle.className = "ht-log-title";
    logTitle.textContent = "Recent";
    log.appendChild(logTitle);
    if (state.log.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ht-empty";
      empty.textContent = "No changes yet.";
      log.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "ht-log-list";
      state.log.forEach((entry) => {
        const li = document.createElement("li");
        li.innerHTML = entry.text;
        list.appendChild(li);
      });
      log.appendChild(list);
    }
    root.appendChild(log);
  }

  function init() {
    if (document.getElementById(PANEL_ID)) return;
    injectStyle();

    const state = loadState();
    state.pending = null;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "ht-header";
    const title = document.createElement("span");
    title.className = "ht-title";
    title.textContent = "Hands";
    const caret = document.createElement("span");
    caret.className = "ht-caret";
    caret.textContent = "▾";
    header.append(title, caret);
    header.addEventListener("click", () => {
      panel.classList.toggle("ht-collapsed");
      localStorage.setItem(STORAGE_KEY + "_collapsed", panel.classList.contains("ht-collapsed") ? "1" : "0");
    });

    const body = document.createElement("div");
    body.className = "ht-body";

    panel.append(header, body);
    document.body.appendChild(panel);

    if (localStorage.getItem(STORAGE_KEY + "_collapsed") === "1") panel.classList.add("ht-collapsed");

    render(body, state);
  }

  init();
})();
