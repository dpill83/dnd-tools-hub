(function () {
  const SD = window.SpellDeck;
  const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const fileInput = document.getElementById("file");
  const app = document.getElementById("app");

  const state = {
    scene: "blank",
    error: "",
    snap: null,
    pool: [],
    always: [],
    deckIds: [],
    sideIds: [],
    cores: {},
    view: "level",
    handOffset: 0,
    selected: null,
    inspectId: null,
    library: false,
    query: "",
    dropHot: ""
  };

  let hold = null;
  let justDragged = false;
  let nativeDrag = false;

  function byId(id) {
    return state.pool.find((s) => s.id === id) || state.always.find((s) => s.id === id);
  }
  function deck() { return state.deckIds.map(byId).filter(Boolean); }
  function side() { return state.sideIds.map(byId).filter(Boolean); }
  function remaining() { return state.snap.budget - state.deckIds.length; }
  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function ord(level) { return ORD[(level || 1) - 1] || (level + "th"); }

  function cardHTML(spell, opts) {
    const o = opts || {};
    const role = SD.primaryRole(spell);
    const roles = SD.rolesFor(spell);
    const also = roles[1] ? ` style="--also:var(--${roles[1]})"` : "";
    const from = o.from || "mat";
    const drag = FINE && from !== "grant" ? " draggable=\"true\"" : "";
    const why = o.why ? `<p class="why">${esc(o.why)}</p>` : "";
    const free = spell.overlap && from !== "grant" ? `<p class="free">Also free · ${esc(SD.freeLabel(spell))}</p>` : "";
    const showLevel = o.showLevel || state.view === "role";
    return `<article class="card ${role}${o.held ? " held" : ""}${state.selected && state.selected.id === spell.id ? " selected" : ""}${spell.overlap ? " overlap" : ""}" data-id="${esc(spell.id)}" data-from="${from}"${drag}${also}>
      ${state.cores[spell.id] ? '<i class="core"></i>' : ""}
      ${roles[1] ? '<i class="also"></i>' : ""}
      <p class="name">${esc(spell.name)}</p>
      <p class="meta">${SD.ROLE_LABEL[role]}${SD.castTag(spell) ? " · " + SD.castTag(spell) : ""}</p>
      ${free}${why}
      ${showLevel ? `<span class="lvl">${esc(ord(spell.level))}</span>` : ""}
      <span class="wash"></span>
    </article>`;
  }

  function ghostHTML(spell) {
    return `<div class="ghost" data-id="${esc(spell.id)}" data-from="grant">
      <p class="name">${esc(spell.name)}</p>
      <p class="meta">${esc(SD.freeLabel(spell))}</p>
    </div>`;
  }

  function loadJson(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { state.error = "That file is not valid JSON."; render(); return; }
    try {
      const snap = SD.parseSnapshot(data);
      const parts = SD.classifySpells(snap.spells);
      state.snap = snap;
      state.pool = parts.pool;
      state.always = parts.always;
      state.deckIds = [];
      state.sideIds = [];
      state.cores = {};
      state.handOffset = 0;
      state.selected = null;
      state.error = "";
      state.scene = "choose";
    } catch (err) {
      state.error = err.message || "Could not read this Spell Pool export.";
    }
    render();
  }

  function begin(mode) {
    state.scene = "play";
    state.deckIds = mode === "continue"
      ? state.pool.filter((s) => s.countsAgainstPrep === true).map((s) => s.id)
      : [];
    state.sideIds = [];
    state.handOffset = 0;
    state.selected = null;
    render();
  }

  function moveTo(id, dest) {
    const spell = byId(id);
    if (!spell || !spell.inPool) return;
    if (dest === "mat") {
      if (state.deckIds.indexOf(id) >= 0) return;
      if (state.deckIds.length >= state.snap.budget) return;
      state.sideIds = state.sideIds.filter((x) => x !== id);
      state.deckIds.push(id);
    } else if (dest === "side") {
      state.deckIds = state.deckIds.filter((x) => x !== id);
      if (state.sideIds.indexOf(id) < 0) state.sideIds.push(id);
    } else if (dest === "pool") {
      state.deckIds = state.deckIds.filter((x) => x !== id);
      state.sideIds = state.sideIds.filter((x) => x !== id);
    }
    state.selected = null;
    state.inspectId = null;
  }

  function hand() {
    return SD.dealHand(state.pool, deck(), side(), state.handOffset);
  }

  function mixPips() {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const s of deck()) counts[s.level] += 1;
    const peak = Math.max(1, ...counts);
    const maxLv = Math.max(5, ...deck().map((s) => s.level || 0));
    let html = "";
    for (let lv = 1; lv <= Math.min(maxLv, 9); lv += 1) {
      const h = Math.max(6, Math.round((counts[lv] / peak) * 56));
      html += `<div class="pip" style="height:${h}px" title="${ord(lv)} · ${counts[lv]} prepared"><span class="lbl">${lv}</span></div>`;
    }
    return html;
  }

  function columns() {
    if (state.view === "role") {
      return SD.ROLE_ORDER.map((role) => ({
        key: role,
        title: SD.ROLE_LABEL[role],
        spells: deck().filter((s) => SD.primaryRole(s) === role)
      }));
    }
    const maxLv = Math.max(5, ...deck().map((s) => s.level || 0), 1);
    const cols = [];
    for (let lv = 1; lv <= Math.min(maxLv, 9); lv += 1) {
      cols.push({
        key: String(lv),
        title: ord(lv),
        spells: deck().filter((s) => s.level === lv)
      });
    }
    return cols;
  }

  function renderBlank() {
    return `<div id="stage"><div id="world">
      <div id="felt" data-drop="file">
        <button type="button" class="folio" data-act="browse">
          <p class="mark">Spell Pool</p>
          <p>Drop a D&amp;D Beyond export on the table, or tap to browse.</p>
        </button>
        ${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}
      </div>
    </div></div>
    <p class="hint">One character per table. Nothing is loaded until you bring a file.</p>`;
  }

  function renderChoose() {
    const s = state.snap;
    const used = state.pool.filter((x) => x.countsAgainstPrep).length;
    return `<div id="stage"><div id="world">
      <div id="felt">
        <div class="choose-note">
          <b>${esc(s.name)}</b>
          ${esc(s.classLine)} · ${s.budget} prepared picks · ${state.always.length} already on the table
        </div>
        <button type="button" class="pile continue" data-act="continue">
          <p class="mark">Continue</p>
          <p>From the character sheet · ${used} / ${s.budget} already prepared</p>
        </button>
        <button type="button" class="pile fresh" data-act="fresh">
          <p class="mark">Start Fresh</p>
          <p>Empty mat · 0 / ${s.budget} · granted magic still lies in back</p>
        </button>
      </div>
    </div></div>`;
  }

  function renderPlay() {
    const s = state.snap;
    const n = state.deckIds.length;
    const cols = columns();
    const granted = state.always.slice(0, 14);
    const cards = cols.map((col) => `<div class="col">
      <div class="col-h"><b>${esc(col.title)}</b><span>${col.spells.length}</span></div>
      ${col.spells.map((sp) => cardHTML(sp, { from: "mat", showLevel: state.view === "role" })).join("")}
    </div>`).join("");
    const handCards = hand().map((sp) => cardHTML(sp, { from: "hand", why: sp.why, showLevel: true })).join("");
    const sideCards = side().map((sp) => cardHTML(sp, { from: "side", showLevel: true })).join("");
    return `<header class="hud">
      <div>
        <h1>${esc(s.name)}</h1>
        <div class="sub">${esc(s.classLine)}</div>
        <div class="count">${n} / ${s.budget}${n >= s.budget ? "<small>Deck ready</small>" : remaining() === 1 ? "<small>One pick left</small>" : ""}</div>
      </div>
      <div class="toggles">
        <button type="button" class="${state.view === "role" ? "on" : ""}" data-act="view" data-id="role">By role</button>
        <button type="button" class="${state.view === "level" ? "on" : ""}" data-act="view" data-id="level">By level</button>
        <button type="button" data-act="library">Binder</button>
        <button type="button" data-act="reset">New file</button>
      </div>
    </header>
    <div id="stage"><div id="world">
      <div id="felt">
        <div class="granted-label">Always available · does not spend ${s.budget}</div>
        <div class="granted">${granted.map(ghostHTML).join("")}</div>
        <div class="mat${state.view === "role" ? " roles" : ""}${state.dropHot === "mat" ? " hot" : ""}" data-drop="mat">${cards}</div>
        <div class="side${state.dropHot === "side" ? " hot" : ""}" data-drop="side">
          <h2>Sideboard ${state.sideIds.length}</h2>
          <div class="stack">${sideCards || "<p class='sub'>Drag a card here to bench it.</p>"}</div>
        </div>
        <div class="hand">${handCards}</div>
        <div class="mix">${mixPips()}</div>
      </div>
    </div></div>
    <div class="hand-tools">
      <button type="button" data-act="more">More cards</button>
    </div>
    <p class="hint">${state.selected ? "Tap the mat or sideboard to move the selected card." : "Drag a card, or tap to select then tap the mat."}</p>
    ${renderInspect()}${renderLibrary()}`;
  }

  function renderInspect() {
    if (!state.inspectId) return "";
    const spell = byId(state.inspectId);
    if (!spell) return "";
    const inDeck = state.deckIds.indexOf(spell.id) >= 0;
    return `<div class="overlay" data-act="close"><div class="sheet detail" data-stop>
      ${cardHTML(spell, { from: inDeck ? "mat" : "hand", showLevel: true })}
      <p class="lead" style="margin-top:12px">${esc((spell.description || "").split("\n")[0] || "Prepared pool card.")}</p>
      ${spell.overlap ? `<p class="lead">Free access: ${esc(SD.freeLabel(spell))}.</p>` : ""}
      <div class="actions">
        <button type="button" class="primary" data-act="close">Keep</button>
        ${inDeck ? `<button type="button" data-act="to-side" data-id="${esc(spell.id)}">Sideboard</button>
          <button type="button" data-act="remove" data-id="${esc(spell.id)}">Remove</button>
          <button type="button" data-act="core" data-id="${esc(spell.id)}">${state.cores[spell.id] ? "Unmark Core" : "Mark Core"}</button>` : ""}
        ${!inDeck && spell.inPool ? `<button type="button" data-act="to-mat" data-id="${esc(spell.id)}">Put on mat</button>` : ""}
      </div>
    </div></div>`;
  }

  function renderLibrary() {
    if (!state.library) return "";
    const q = state.query.toLowerCase();
    const list = state.pool.filter((s) => !q || String(s.name).toLowerCase().indexOf(q) >= 0);
    return `<div class="overlay" data-act="close"><div class="sheet" data-stop>
      <h2>Spell binder</h2>
      <p class="lead">The full preparation pool. The hand stays small; this is the escape hatch.</p>
      <input class="search" data-act="query" type="search" value="${esc(state.query)}" placeholder="Search the pool">
      <div class="lib-grid">${list.map((s) => cardHTML(s, { from: "library", showLevel: true })).join("")}</div>
      <div class="actions"><button type="button" class="primary" data-act="close">Back to the table</button></div>
    </div></div>`;
  }

  function render() {
    app.innerHTML = state.scene === "blank" ? renderBlank()
      : state.scene === "choose" ? renderChoose()
      : renderPlay();
  }

  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return "";
    const hit = el.closest("[data-drop]");
    return hit ? hit.getAttribute("data-drop") : "";
  }

  function applyDrop(id, from, dest) {
    if (dest === "mat") moveTo(id, "mat");
    else if (dest === "side") moveTo(id, "side");
    else if (from === "mat" && dest === "file") return;
    render();
  }

  function onAct(act, id, el) {
    if (act === "browse") fileInput.click();
    else if (act === "continue") begin("continue");
    else if (act === "fresh") begin("fresh");
    else if (act === "view") { state.view = id; render(); }
    else if (act === "library") { state.library = true; render(); }
    else if (act === "reset") {
      state.scene = "blank"; state.snap = null; state.error = ""; state.library = false; render();
    }
    else if (act === "close") { state.inspectId = null; state.library = false; render(); }
    else if (act === "more") { state.handOffset += 4; render(); }
    else if (act === "to-mat") { moveTo(id, "mat"); render(); }
    else if (act === "to-side") { moveTo(id, "side"); render(); }
    else if (act === "remove") { moveTo(id, "pool"); render(); }
    else if (act === "core") { state.cores[id] = !state.cores[id]; render(); }
    else if (act === "query") return;
  }

  app.addEventListener("input", (e) => {
    if (e.target.getAttribute("data-act") === "query") {
      state.query = e.target.value;
      render();
      const box = app.querySelector(".search");
      if (box) { box.focus(); box.setSelectionRange(state.query.length, state.query.length); }
    }
  });

  app.addEventListener("click", (e) => {
    if (justDragged) { justDragged = false; return; }
    const overlay = e.target.closest(".overlay");
    if (overlay && e.target === overlay) { state.inspectId = null; state.library = false; render(); return; }
    const hit = e.target.closest("[data-act]");
    if (hit && hit.getAttribute("data-act") !== "query") {
      onAct(hit.getAttribute("data-act"), hit.getAttribute("data-id"), hit);
      return;
    }
    if (hold && hold.moved) return;
    const drop = e.target.closest("[data-drop]");
    if (state.selected && drop) {
      const dest = drop.getAttribute("data-drop");
      if (dest === "mat" || dest === "side") {
        applyDrop(state.selected.id, state.selected.from, dest);
        return;
      }
    }
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    const from = card.getAttribute("data-from");
    if (from === "grant") return;
    if (state.selected && state.selected.id === id) {
      state.inspectId = id;
      render();
      return;
    }
    state.selected = { id, from };
    render();
  });

  app.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".card[data-id]");
    if (!card || card.getAttribute("data-from") === "grant") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    hold = {
      id: card.getAttribute("data-id"),
      from: card.getAttribute("data-from"),
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointerId: e.pointerId
    };
    try { card.setPointerCapture(e.pointerId); } catch (err) {}
  });

  app.addEventListener("pointermove", (e) => {
    if (!hold) return;
    const dx = e.clientX - hold.x;
    const dy = e.clientY - hold.y;
    if (!hold.moved && dx * dx + dy * dy > 144) {
      hold.moved = true;
      const spell = byId(hold.id);
      const ghost = document.createElement("div");
      ghost.className = "ghost-drag";
      ghost.innerHTML = cardHTML(spell, { from: hold.from, showLevel: true });
      ghost.id = "ghost-drag";
      document.body.appendChild(ghost);
      const src = app.querySelector(`.card[data-id="${hold.id}"]`);
      if (src) src.classList.add("held");
    }
    const ghost = document.getElementById("ghost-drag");
    if (ghost) {
      ghost.style.left = e.clientX + "px";
      ghost.style.top = e.clientY + "px";
      state.dropHot = zoneAt(e.clientX, e.clientY);
      const mat = app.querySelector(".mat");
      const sideEl = app.querySelector(".side");
      if (mat) mat.classList.toggle("hot", state.dropHot === "mat");
      if (sideEl) sideEl.classList.toggle("hot", state.dropHot === "side");
    }
  });

  function endHold(e) {
    if (!hold) return;
    const ghost = document.getElementById("ghost-drag");
    if (ghost) ghost.remove();
    if (nativeDrag) { hold = null; state.dropHot = ""; return; }
    const moved = hold.moved;
    const id = hold.id;
    const from = hold.from;
    const dest = e ? zoneAt(e.clientX, e.clientY) : "";
    hold = null;
    state.dropHot = "";
    if (moved && (dest === "mat" || dest === "side")) {
      justDragged = true;
      applyDrop(id, from, dest);
    } else if (moved) {
      justDragged = true;
      render();
    }
  }

  app.addEventListener("pointerup", endHold);
  app.addEventListener("pointercancel", endHold);

  app.addEventListener("dragstart", (e) => {
    if (!FINE) { e.preventDefault(); return; }
    const card = e.target.closest(".card[data-id]");
    if (!card) return;
    const payload = JSON.stringify({ id: card.getAttribute("data-id"), from: card.getAttribute("data-from") });
    e.dataTransfer.setData("text/plain", payload);
    e.dataTransfer.effectAllowed = "move";
    nativeDrag = true;
    hold = { id: card.getAttribute("data-id"), from: card.getAttribute("data-from"), moved: true };
  });
  app.addEventListener("dragover", (e) => {
    const zone = e.target.closest("[data-drop]");
    if (!zone) return;
    e.preventDefault();
    state.dropHot = zone.getAttribute("data-drop");
    const mat = app.querySelector(".mat");
    const sideEl = app.querySelector(".side");
    if (mat) mat.classList.toggle("hot", state.dropHot === "mat");
    if (sideEl) sideEl.classList.toggle("hot", state.dropHot === "side");
  });
  app.addEventListener("drop", (e) => {
    const zone = e.target.closest("[data-drop]");
    if (!zone) return;
    e.preventDefault();
    let payload = { id: hold && hold.id, from: hold && hold.from };
    try { payload = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); } catch (err) {}
    const dest = zone.getAttribute("data-drop");
    if (dest === "file") return;
    if (payload.id) applyDrop(payload.id, payload.from, dest);
    hold = null;
    nativeDrag = false;
    justDragged = true;
  });

  function bindFileTarget(el) {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop-hot"); });
    el.addEventListener("dragleave", () => el.classList.remove("drop-hot"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drop-hot");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) file.text().then(loadJson);
    });
  }

  document.addEventListener("dragover", (e) => {
    if (state.scene !== "blank") return;
    e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (state.scene !== "blank") return;
    if (e.target.closest("[data-id]")) return;
    e.preventDefault();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) file.text().then(loadJson);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    file.text().then(loadJson);
    fileInput.value = "";
  });

  const observer = new MutationObserver(() => {
    const felt = document.getElementById("felt");
    if (felt && felt.getAttribute("data-drop") === "file" && !felt._bound) {
      felt._bound = true;
      bindFileTarget(felt);
    }
  });
  observer.observe(app, { childList: true, subtree: true });

  render();
}());
