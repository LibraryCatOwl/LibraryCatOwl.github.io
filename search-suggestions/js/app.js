/*
 * UI for the search suggestions prototype: search box, dropdown, keyboard
 * handling, simulated network (debounce, client cache, edge cache, stale
 * request dropping) and the "Under the hood" panel.
 * Ranking lives in engine.js; sample data lives in ../data/*.json.
 */
(async function () {
  "use strict";

  const [qData, pData] = await Promise.all([
    fetch("data/queries.json").then((r) => r.json()),
    fetch("data/products.json").then((r) => r.json()),
  ]);
  const engine = SuggestEngine.create({
    queries: qData.queries,
    trending: qData.trending,
    products: pData.products,
    categories: pData.categories,
  });
  const norm = SuggestEngine.norm;

  // ---------- Rendering helpers ----------
  const SHAPES = {
    bowl: "M5 19h30a15 13 0 0 1-30 0zM8 16h24v3H8z",
    box: "M8 13l12-6 12 6v15l-12 6-12-6zM8 13l12 6 12-6M20 19v15",
    jar: "M13 6h14v5H13zM11 12h18v20a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z",
    bottle: "M17 5h6v5l3 4v20H14V14l3-4z",
    tube: "M15 5h10v4l2 2v24H13V11l2-2z",
    mask: "M8 10c4-3 20-3 24 0v14c0 6-6 10-12 10S8 30 8 24z",
    cup: "M8 14h24v14a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6zM10 10h20v3H10z",
  };
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const money = (n) => "$" + n.toFixed(2);
  const isHot = (p) => p.reviews >= 4000;
  const thumb = (p, s) =>
    `<svg class="th" width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="6" fill="hsl(${p.hue} 55% 92%)"/><path d="${SHAPES[p.shape] || SHAPES.box}" fill="hsl(${p.hue} 50% 48%)" stroke="hsl(${p.hue} 50% 34%)" stroke-width=".6" stroke-linejoin="round"/></svg>`;
  const I = {
    search: '<svg class="ico" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    fill: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M12 12L4.5 4.5M4 10V4h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };

  // Bold the part of each word the shopper hasn't typed yet.
  function highlight(text, q) {
    const toks = norm(q).trim().split(" ").filter(Boolean);
    return text
      .split(" ")
      .map((w) => {
        const k = toks.filter((t) => w.startsWith(t)).sort((a, b) => b.length - a.length)[0];
        if (!k) return "<b>" + esc(w) + "</b>";
        return esc(k) + (w.length > k.length ? "<b>" + esc(w.slice(k.length)) + "</b>" : "");
      })
      .join(" ");
  }

  // ---------- State ----------
  const $ = (id) => document.getElementById(id);
  const input = $("q"), dd = $("dd"), view = $("view"), dept = $("dept");
  const opts = { rows: 8, scope: true, prod: true, fuzzy: true, deb: 100, lat: 40, dept: "All" };
  const stats = { keys: 0, reqs: 0, client: 0, edge: 0, origin: 0, stale: 0 };
  const cache = new Map();
  const events = [];
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem("ky-recent") || "[]"); } catch (e) {}
  let typed = "", items = [], active = -1, timer = 0, seq = 0, lastRes = null;

  // ---------- Dropdown ----------
  function open(v) {
    dd.hidden = !v;
    input.setAttribute("aria-expanded", v ? "true" : "false");
    if (!v) { active = -1; input.removeAttribute("aria-activedescendant"); }
  }

  function row(it, i) {
    const id = "opt-" + i;
    if (it.kind === "product") {
      const p = engine.product(it.id);
      return `<li role="option" id="${id}" class="row prod" data-i="${i}" aria-selected="false">${thumb(p, 50)}<span class="pt">${esc(p.title)}</span><span class="pm"><span class="price">${money(p.price)}</span><br>★ ${p.rating}</span></li>`;
    }
    if (it.kind === "scope") {
      return `<li role="option" id="${id}" class="row scope" data-i="${i}" aria-selected="false"><span class="t">${it.brand ? "All of" : esc(it.query) + " in"} <b>${esc(it.label)}</b></span><span class="n">${it.count} ${it.count === 1 ? "item" : "items"}</span></li>`;
    }
    if (it.kind === "trend") {
      return `<li role="option" id="${id}" class="row" data-i="${i}" aria-selected="false">${esc(it.text)}</li>`;
    }
    const ic = it.kind === "recent" ? I.clock : I.search;
    const label = it.kind === "query" ? (it.fuzzy ? "<b>" + esc(it.text) + "</b>" : highlight(it.text, typed)) : esc(it.text);
    const badge = it.hot ? '<span class="hot">Hot</span>' : "";
    const tail = it.kind === "recent"
      ? `<button type="button" class="x" data-del="${esc(it.text)}" tabindex="-1" aria-label="Remove ${esc(it.text)} from recent searches">${I.x}</button>`
      : `<button type="button" class="fill" data-fill="${i}" tabindex="-1" aria-label="Fill ${esc(it.text)} into the search box">${I.fill}</button>`;
    return `<li role="option" id="${id}" class="row" data-i="${i}" aria-selected="false">${ic}<span class="t">${label}</span>${badge}${tail}</li>`;
  }

  const push = (it) => { items.push(it); return row(it, items.length - 1); };

  function renderZero() {
    items = [];
    let h = '<div class="col">';
    if (recent.length) {
      h += '<div class="sec">Recent searches<button type="button" id="clr">Clear all</button></div><ul role="listbox" aria-label="Recent searches">';
      recent.forEach((t) => { h += push({ kind: "recent", text: t }); });
      h += "</ul>";
    }
    h += '<div class="sec">Trending searches</div><ul class="chips" role="listbox" aria-label="Trending searches">';
    engine.trending.forEach((t) => { h += push({ kind: "trend", text: t }); });
    h += "</ul></div>";
    dd.className = "dd";
    dd.innerHTML = h;
    open(true);
    live(`${items.length} suggestions`);
  }

  function render(res) {
    items = [];
    let L = '<div class="col">';
    if (opts.dept !== "All") L += `<div class="note">Searching in <b>${esc(opts.dept)}</b></div>`;
    if (res.corrected) L += `<div class="note">No matches for “${esc(typed.trim())}”. Showing <b>${esc(res.corrected)}</b></div>`;
    if (res.queries.length) {
      L += '<ul role="listbox" aria-label="Search suggestions">';
      res.queries.forEach((q, k) => {
        L += push({ kind: "query", text: q.text, fuzzy: q.fuzzy, hot: q.hot });
        if (k === 0) res.scopes.forEach((s) => { L += push({ kind: "scope", ...s }); });
      });
      L += "</ul>";
    } else {
      L += `<div class="empty">No suggestions${opts.dept !== "All" ? " in " + esc(opts.dept) : ""}. Press Enter to search for “${esc(typed.trim())}”.</div>`;
    }
    L += "</div>";
    let R = "";
    if (res.products.length) {
      R = '<div class="col"><div class="sec">Products</div><ul role="listbox" aria-label="Product suggestions">';
      res.products.forEach((id) => { R += push({ kind: "product", id }); });
      R += "</ul></div>";
    }
    dd.className = "dd" + (R ? " two" : "");
    dd.innerHTML = L + R;
    open(true);
    live(`${items.length} suggestions`);
  }

  function setActive(i) {
    active = i;
    dd.querySelectorAll(".row").forEach((r) => {
      const on = +r.dataset.i === i;
      r.classList.toggle("on", on);
      r.setAttribute("aria-selected", on);
    });
    if (i < 0) { input.removeAttribute("aria-activedescendant"); input.value = typed; return; }
    input.setAttribute("aria-activedescendant", "opt-" + i);
    const it = items[i];
    if (it.kind === "product") input.value = typed;
    else input.value = it.kind === "scope" ? it.query || it.label : it.text;
    const el = $("opt-" + i);
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  // ---------- Simulated network: client cache -> edge cache -> suggest service ----------
  function request(q) {
    const id = ++seq;
    const key = norm(q) + "|" + JSON.stringify([opts.rows, opts.scope, opts.prod, opts.fuzzy, opts.dept]);
    if (cache.has(key)) { stats.client++; done(id, q, cache.get(key), 0, "client cache"); return; }
    stats.reqs++;
    const edge = norm(q).trim().length <= 3; // short prefixes are cached at the edge
    const ms = Math.round(edge ? 8 + Math.random() * 8 : opts.lat * (0.8 + Math.random() * 0.4));
    showStats();
    setTimeout(() => {
      if (id !== seq) { stats.stale++; showStats(); return; } // a newer keystroke won
      const res = engine.suggest(q, opts);
      cache.set(key, res);
      edge ? stats.edge++ : stats.origin++;
      done(id, q, res, ms, edge ? "edge cache" : "suggest service");
    }, ms);
  }

  function done(id, q, res, ms, src) {
    if (document.activeElement !== input && dd.hidden) return;
    lastRes = res;
    render(res);
    showStats();
    $("lastLat").innerHTML = `“${esc(q)}” served by <b>${src}</b> in ${ms} ms`;
    const out = {
      requestId: "r-" + id,
      q: norm(q).trim(),
      dept: opts.dept,
      queries: res.queries.map((x) => x.text + (x.fuzzy ? " (fuzzy)" : "")),
      scopes: res.scopes.map((s) => (s.brand ? "brand: " : "") + s.label),
      products: res.products.map((i) => engine.product(i).title),
    };
    $("json").textContent = JSON.stringify(out, null, 1);
  }

  function showStats() {
    $("sKeys").textContent = stats.keys;
    $("sReq").textContent = stats.reqs;
    $("sClient").textContent = stats.client;
    $("sEdge").textContent = stats.edge;
    $("sOrigin").textContent = stats.origin;
    $("sStale").textContent = stats.stale;
  }
  function log(k, v) {
    events.unshift([k, v]);
    events.length = Math.min(events.length, 6);
    $("log").innerHTML = events.map(([k, v]) => `<li><span class="k">${k}</span><span>${esc(v)}</span></li>`).join("");
  }
  function live(t) { $("live").textContent = t; }
  function saveRecent(t) {
    recent = [t, ...recent.filter((x) => x !== t)].slice(0, 5);
    try { localStorage.setItem("ky-recent", JSON.stringify(recent)); } catch (e) {}
  }

  // ---------- Selection, results and product pages ----------
  function choose(i) {
    const it = items[i];
    if (!it) return;
    const what = it.kind === "product" ? engine.product(it.id).title
      : it.kind === "scope" ? (it.query ? it.query + " in " : "") + it.label : it.text;
    log("select", `${it.kind} #${i + 1}: ${what} (typed “${typed.trim()}”)`);
    if (it.kind === "product") { open(false); input.value = typed; showPdp(engine.product(it.id)); return; }
    if (it.kind === "scope") {
      const q = it.brand ? it.label : it.query;
      input.value = q;
      search(q, it.brand ? { brand: it.label } : { scope: it.label });
      return;
    }
    input.value = it.text;
    search(it.text);
  }

  function search(q, f = {}) {
    q = q.trim();
    if (!q) return;
    open(false);
    typed = q;
    saveRecent(q);
    let list = f.brand ? engine.productsByBrand(f.brand) : engine.results(q, opts);
    let note = "";
    if (!list.length && opts.fuzzy) {
      const r = engine.suggest(q, opts);
      if (r.queries.length) {
        const c = r.queries[0].text;
        list = engine.results(c, opts);
        note = `No results for “${esc(q)}”. Showing results for <b>${esc(c)}</b>.`;
      }
    }
    if (f.scope) list = list.filter((p) => p.category === f.scope || p.brand === f.scope);
    const where = f.scope || (opts.dept !== "All" ? opts.dept : "");
    log("search", `“${q}”${where ? " in " + where : ""}${f.brand ? " (brand)" : ""} → ${list.length} results`);
    view.innerHTML =
      `<p class="crumb">Home › Search${where ? " › " + esc(where) : ""}${f.brand ? " › " + esc(f.brand) : ""}</p><h1>${list.length} ${list.length === 1 ? "result" : "results"} for “${esc(f.brand || q)}”</h1>${note ? `<p class="lede">${note}</p>` : ""}` +
      (list.length
        ? `<div class="grid">${list.map(card).join("")}</div>`
        : `<p class="lede">Nothing matches. This is the null-result page that suggestions are meant to prevent: they only offer queries that return results.</p>`);
    bindCards();
  }

  const card = (p) =>
    `<div class="card" data-p="${p.id}" role="link" tabindex="0" aria-label="${esc(p.title)}">${isHot(p) ? '<span class="hot">Best seller</span>' : ""}${thumb(p, 180)}<div class="pt">${esc(p.title)}</div><div class="price">${money(p.price)}</div><div class="meta">★ ${p.rating} (${p.reviews.toLocaleString()})</div></div>`;

  function bindCards() {
    view.querySelectorAll("[data-p]").forEach((b) => {
      b.style.cursor = "pointer";
      b.onclick = () => showPdp(engine.product(+b.dataset.p));
      b.onkeydown = (e) => { if (e.key === "Enter") showPdp(engine.product(+b.dataset.p)); };
    });
  }

  function showPdp(p) {
    log("product", p.title);
    view.innerHTML = `<p class="crumb">Home › ${esc(p.category)} › ${esc(p.brand)}</p><div class="pdp">${thumb(p, 260)}<div><h1>${esc(p.title)}</h1><p><span class="price" style="font-size:26px">${money(p.price)}</span></p><p class="pm" style="text-align:left">★ ${p.rating} from ${p.reviews.toLocaleString()} reviews · Free shipping on orders $49+</p><p class="lede">Reached straight from a product suggestion, with no results page in between. That is the known-item shortcut from the PRD.</p></div></div>`;
  }

  function home() {
    view.innerHTML = `<h1>Find it before you finish typing</h1><p class="lede">A working prototype of e-commerce query suggestions. Click into the search box to see recent and trending searches, then type. Pick a department to narrow suggestions. Use ↑ ↓ to move, Enter to choose, Tab to accept the top completion, Esc to close. The ↖ button copies a suggestion into the box without searching.</p><h2>Best sellers</h2><div class="grid">${[8, 3, 0, 19, 12, 17].map((i) => card(engine.product(i))).join("")}</div>`;
    bindCards();
  }

  // ---------- Header: trending tags, departments ----------
  $("tags").innerHTML = engine.trending.slice(0, 6).map((t) => `<button type="button" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
  $("cats").innerHTML =
    engine.categories.map((c) => `<a data-cat="${esc(c)}" tabindex="0">${esc(c)}</a>`).join("") +
    '<span class="sep">|</span><a>Best Sellers</a><a>New Arrivals</a><a>Sale<span class="new">HOT</span></a>';

  function setDept(v) {
    opts.dept = v;
    dept.value = v;
    document.querySelectorAll("#cats [data-cat]").forEach((a) => a.classList.toggle("on", a.dataset.cat === v));
    log("dept", v);
  }
  dept.addEventListener("change", () => {
    setDept(dept.value);
    input.focus();
    input.value.trim() ? request(input.value) : renderZero();
  });
  $("cats").addEventListener("click", (e) => {
    const a = e.target.closest("[data-cat]");
    if (!a) return;
    setDept(opts.dept === a.dataset.cat ? "All" : a.dataset.cat);
    input.focus();
    input.value.trim() ? request(input.value) : renderZero();
  });
  $("tags").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tag]");
    if (!b) return;
    input.value = typed = b.dataset.tag;
    log("select", "trending tag: " + b.dataset.tag);
    search(b.dataset.tag);
  });

  // ---------- Search box events ----------
  input.addEventListener("input", () => {
    typed = input.value;
    stats.keys++;
    showStats();
    active = -1;
    clearTimeout(timer);
    if (!typed.trim()) { seq++; renderZero(); return; }
    timer = setTimeout(() => request(typed), opts.deb);
  });
  input.addEventListener("focus", () => {
    if (!input.value.trim()) renderZero();
    else if (lastRes) render(lastRes);
  });
  input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input) open(false); }, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (dd.hidden) { input.value.trim() ? request(input.value) : renderZero(); return; }
      const n = items.length;
      if (!n) return;
      let i = active + (e.key === "ArrowDown" ? 1 : -1);
      if (i >= n) i = -1;
      if (i < -1) i = n - 1;
      setActive(i);
    } else if (e.key === "Escape") {
      if (!dd.hidden) { e.preventDefault(); input.value = typed; open(false); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active > -1 && !dd.hidden) choose(active);
      else search(input.value);
    } else if (
      ((e.key === "Tab" && !e.shiftKey) || (e.key === "ArrowRight" && input.selectionStart === input.value.length)) &&
      !dd.hidden && active < 0
    ) {
      const top = items.find((x) => x.kind === "query");
      if (top && top.text !== norm(input.value).trim()) {
        e.preventDefault();
        input.value = typed = top.text;
        log("accept", "Tab completion: " + top.text);
        request(top.text);
      }
    }
  });

  dd.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
  dd.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fill]"), d = e.target.closest("[data-del]"),
      c = e.target.closest("#clr"), r = e.target.closest(".row");
    if (c) {
      recent = [];
      try { localStorage.removeItem("ky-recent"); } catch (_) {}
      log("recent", "Cleared all");
      renderZero();
      return;
    }
    if (d) {
      recent = recent.filter((x) => x !== d.dataset.del);
      try { localStorage.setItem("ky-recent", JSON.stringify(recent)); } catch (_) {}
      log("recent", "Removed " + d.dataset.del);
      renderZero();
      return;
    }
    if (f) {
      const it = items[+f.dataset.fill];
      input.value = typed = it.text + " ";
      log("fill", it.text);
      input.focus();
      request(typed);
      return;
    }
    if (r) choose(+r.dataset.i);
  });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); search(input.value); });

  // ---------- Prototype controls ----------
  document.querySelectorAll("[data-try]").forEach((b) =>
    b.addEventListener("click", () => {
      input.focus();
      input.value = b.dataset.try;
      input.dispatchEvent(new Event("input"));
    })
  );
  const bind = (id, k, isMs) => {
    const el = $(id);
    el.addEventListener("input", () => {
      opts[k] = el.type === "checkbox" ? el.checked : +el.value;
      if (isMs) $(id + "V").textContent = el.value + " ms";
      else cache.clear(); // ranking options change the response
    });
  };
  bind("optScope", "scope");
  bind("optProd", "prod");
  bind("optFuzzy", "fuzzy");
  bind("deb", "deb", true);
  bind("lat", "lat", true);
  $("rows").addEventListener("change", () => { opts.rows = +$("rows").value; cache.clear(); });

  home();
  showStats();
})();
