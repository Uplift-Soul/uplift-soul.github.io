/* common.js — shared helpers + data loader for all dashboard pages */

const PALETTE = ["#2dd4a0","#a970ff","#ff7eb6","#ffb347","#5aa9ff","#9dff6e","#ff5c7a","#c08bff","#13e3c5","#ffd166"];

const fmt = n => {
  n = Number(n)||0;
  if (n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')+"M";
  if (n>=1e3) return (n/1e3).toFixed(n>=1e4?0:1).replace(/\.0$/,'')+"K";
  return String(n);
};
const fullNum = n => (Number(n)||0).toLocaleString("en-GB");

function timeAgo(iso){
  if(!iso) return "unknown";
  const d=new Date(iso), now=new Date(), mins=Math.round((now-d)/60000);
  if(mins<60) return mins<=1?"just now":mins+" min ago";
  const h=Math.round(mins/60); if(h<24) return h+"h ago";
  return Math.round(h/24)+"d ago";
}

/* Fetch a page's data slice (live/overview/history.json), falling back to the
   full data.json if the slice isn't published yet — so the site keeps working
   before the backend starts emitting the split files. The buster is bucketed to
   5 minutes so pages share a cached copy while still catching the 3-hourly refresh. */
function loadData(primary){
  const bust = Math.floor(Date.now()/3e5);
  const grab = f => fetch(f+"?_="+bust)
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
  let p = grab(primary || "data.json");
  if(primary) p = p.catch(()=>grab("data.json"));
  return p.then(data=>{
    /* viewership ranking (current is sorted) — used to pick chart focus */
    window.__VIEW_RANK = Object.fromEntries(
      (data.current||[]).map((c,i)=>[c.category,i]));
    /* category list for the command palette (empty on pages without `current`) */
    if((data.current||[]).length) window.__CATS = data.current.map(c=>c.category);
    return data;
  });
}

/* update the "updated X ago" status pill if the page has one,
   and keep it ticking so a left-open tab stays honest */
function setUpdated(data){
  const el=document.getElementById("updated");
  if(!el) return;
  const paint=()=>el.textContent = "updated "+timeAgo(data.latest_snapshot||data.generated_at);
  paint();
  clearInterval(setUpdated._t);
  setUpdated._t=setInterval(paint, 60000);
}

/* on failure: mark the status unavailable and fill any error slots */
function showError(e){
  const el=document.getElementById("updated");
  if(el) el.textContent = "data unavailable";
  document.querySelectorAll(".js-err").forEach(x=>{
    x.innerHTML = '<div class="error">Couldn\'t load data.json ('+e.message+').</div>';
  });
}


/* ---- chart focus & mobile behaviour (auto-applies to every Chart.js chart) ---- */
const IS_MOBILE = window.matchMedia && window.matchMedia("(max-width:760px)").matches;

if (window.Chart) {

  /* coordinated chart entrance that matches the site's easing, so canvases
     ease in with the panels around them instead of snapping. Disabled under
     reduced motion. */
  const REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  Chart.defaults.animation = REDUCE ? false : { duration: 900, easing: "easeOutQuart" };

  if (IS_MOBILE) {
    const L = Chart.defaults.plugins.legend.labels;
    L.boxWidth = 8; L.boxHeight = 8; L.padding = 8;
    L.font = {family:"Inter", size:10};
  }

  /* start focused: only the 5 categories with the highest current
     viewership are visible; the rest wait one tap away in the legend.
     Bump charts (reversed y = ranks) are exempt. */
  Chart.register({
    id: "invstFocus",
    afterInit(chart){
      if (chart.$focusDone) return;
      chart.$focusDone = true;
      const sets = chart.data.datasets || [];
      if (IS_MOBILE) sets.forEach(d => {
        if (d.type !== "bar") { d.pointRadius = 0; d.borderWidth = 1.4; }
      });
      const reversed = chart.options && chart.options.scales &&
                       chart.options.scales.y && chart.options.scales.y.reverse;
      if (sets.length > 5 && !reversed) {
        const rank = window.__VIEW_RANK || {};
        const score = (d,i) => (d.label in rank) ? rank[d.label] : 1000 + i;
        [...sets.keys()]
          .sort((a,b) => score(sets[a],a) - score(sets[b],b))
          .slice(5)
          .forEach(i => chart.setDatasetVisibility(i, false));
      }
    }
  });

  /* legend behaviour:
     tap a visible item  -> solo it (everything else hides)
     tap a greyed item   -> add it to the view
     tap the soloed item -> restore exactly what was visible before */
  Chart.defaults.plugins.legend.onClick = (e, item, legend) => {
    const chart = legend.chart, i = item.datasetIndex;
    if (chart.$solo === i) {
      chart.$soloPrev.forEach((v,k) => chart.setDatasetVisibility(k, v));
      chart.$solo = null; chart.$soloPrev = null;
    } else if (!chart.isDatasetVisible(i)) {
      chart.setDatasetVisibility(i, true);
    } else {
      if (chart.$solo == null)
        chart.$soloPrev = chart.data.datasets.map((_,k) => chart.isDatasetVisible(k));
      chart.data.datasets.forEach((_,k) => chart.setDatasetVisibility(k, k === i));
      chart.$solo = i;
    }
    chart.update();
  };
}


/* ---- era-aware range pills + category chips, injected above every line chart.
   Pills derive from the data itself: with two data islands you get
   Archive / Live / All; duration pills (3M/6M/1Y) appear automatically
   once the live era is long enough to make them meaningful. ---- */
if (window.Chart) {
  Chart.register({
    id: "invstControls",
    afterInit(chart){
      const xs = chart.options.scales && chart.options.scales.x;
      const box = chart.canvas.closest(".chartbox");
      if (!xs || !box || chart.$ctl) return;
      chart.$ctl = true;
      chart.options.plugins.legend.display = false;
      const isTime = xs.type === "time";
      const DAY = 864e5;
      const ranges = [];

      if (isTime) {
        const days = [...new Set([].concat(...chart.data.datasets.map(
          d => d.data.map(p => +new Date(p.x))
        )))].sort((a,b) => a-b);
        const isl = [];
        days.forEach(t => {
          const last = isl[isl.length-1];
          if (!last || t - last[1] > 45*DAY) isl.push([t,t]); else last[1] = t;
        });
        const mx = days[days.length-1] || 0;
        const span = (a,b) => () => {
          const o = chart.options.scales.x;
          o.min = new Date(a - 2*DAY).toISOString();
          o.max = new Date(b + 2*DAY).toISOString();
        };
        if (isl.length > 1) {
          ranges.push(["Archive", span(isl[0][0], isl[isl.length-2][1])]);
          ranges.push(["Live",    span(isl[isl.length-1][0], mx)]);
        }
        const liveLen = isl.length ? isl[isl.length-1][1] - isl[isl.length-1][0] : 0;
        if (liveLen >=  95*DAY) ranges.push(["3M", span(mx -  91*DAY, mx)]);
        if (liveLen >= 185*DAY) ranges.push(["6M", span(mx - 183*DAY, mx)]);
        if (liveLen >= 370*DAY) ranges.push(["1Y", span(mx - 365*DAY, mx)]);
        ranges.push(["All", () => {
          const o = chart.options.scales.x;
          delete o.min; delete o.max;
        }]);
      } else {
        const L = chart.data.labels.slice();
        const D = chart.data.datasets.map(d => d.data.slice());
        const has = i => D.some(d => d[i] != null);
        const isl = [];
        for (let i = 0; i < L.length; i++) if (has(i)) {
          const last = isl[isl.length-1];
          if (last && last[1] === i-1) last[1] = i; else isl.push([i,i]);
        }
        const slice = (a,b) => () => {
          chart.data.labels = L.slice(a, b+1);
          chart.data.datasets.forEach((d,k) => d.data = D[k].slice(a, b+1));
        };
        if (isl.length > 1) {
          ranges.push(["Archive", slice(isl[0][0], isl[isl.length-2][1])]);
          ranges.push(["Live",    slice(isl[isl.length-1][0], isl[isl.length-1][1])]);
        }
        const liveRun = isl.length ? isl[isl.length-1][1] - isl[isl.length-1][0] + 1 : 0;
        const end = L.length - 1;
        if (liveRun >=  3) ranges.push(["3M", slice(end-2,  end)]);
        if (liveRun >=  6) ranges.push(["6M", slice(end-5,  end)]);
        if (liveRun >= 12) ranges.push(["1Y", slice(end-11, end)]);
        ranges.push(["All", slice(0, end)]);
      }

      const ctl = document.createElement("div"); ctl.className = "chartctl";
      const pills = document.createElement("div"); pills.className = "pills";
      ranges.forEach(([t, apply], i) => {
        const b = document.createElement("button");
        b.className = "cpill" + (i === ranges.length-1 ? " on" : "");
        b.textContent = t;
        b.onclick = () => {
          pills.querySelectorAll(".cpill").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          apply(); chart.update();
        };
        pills.appendChild(b);
      });

      const chips = document.createElement("div"); chips.className = "chips";
      chart.data.datasets.forEach((d,i) => {
        const c = document.createElement("button");
        c.className = "chip";
        c.style.setProperty("--c", d.borderColor);
        c.innerHTML = '<span class="dotc"></span>' + d.label;
        const paint = () => c.classList.toggle("on", chart.isDatasetVisible(i));
        c.onclick = () => {
          chart.setDatasetVisibility(i, !chart.isDatasetVisible(i));
          chart.update(); paint();
        };
        paint();
        chips.appendChild(c);
      });

      ctl.appendChild(pills); ctl.appendChild(chips);
      box.parentNode.insertBefore(ctl, box);
    }
  });
}


/* ---- visual layer: scroll reveal (presentation only — no data logic).
   Panels and the footer fade/slide in as they enter the viewport, with a
   stagger when several arrive together. Hidden states are gated behind
   html.anim, so content stays fully visible without JS, and the whole
   effect is skipped for prefers-reduced-motion. ---- */
(() => {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("anim");
  const io = new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = (i * 90) + "ms";
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".panel, footer").forEach(el => {
    el.classList.add("rv");
    io.observe(el);
  });
})();


/* ============================================================================
   Terminal UX layer (presentation only): live auto-refresh, ⌘K command
   palette, and a comfortable/compact density toggle.
   ============================================================================ */

/* --- live auto-refresh -------------------------------------------------------
   Re-poll the page's data file on an interval; when a newer snapshot lands,
   update the "updated" pill and hand the fresh data to the page's renderer so
   an open tab stays live without a manual reload. No-op until the snapshot
   actually changes, so it's cheap between the 3-hourly data cycles. */
function startAutoRefresh(file, initial, onChange, intervalMs){
  let lastSnap = (initial && (initial.latest_snapshot || initial.generated_at)) || null;
  setInterval(() => {
    loadData(file).then(data => {
      const snap = data.latest_snapshot || data.generated_at;
      if (snap && snap !== lastSnap){
        lastSnap = snap;
        setUpdated(data);
        try { onChange(data); } catch(e){ /* keep polling even if a render throws */ }
      }
    }).catch(()=>{});
  }, intervalMs || 90000);
}

/* briefly highlight a value that just changed on refresh */
function flash(el){
  if(!el) return;
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}


/* --- density toggle (comfortable | compact), persisted ---------------------- */
(() => {
  const KEY = "invst-density", root = document.documentElement;
  const set = d => { root.setAttribute("data-density", d); try{ localStorage.setItem(KEY, d); }catch(e){} };
  let cur = "comfortable";
  try { cur = localStorage.getItem(KEY) || cur; } catch(e){}
  set(cur);                                   // applied before paint where possible
  window.__toggleDensity = () =>
    set(root.getAttribute("data-density") === "compact" ? "comfortable" : "compact");
})();


/* --- nav tools (⌘K trigger + density button) + command palette -------------- */
(() => {
  const ICON_SEARCH =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const ICON_DENSITY =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2.5" y1="4" x2="13.5" y2="4"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="12" x2="13.5" y2="12"/></g></svg>';

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ---- palette ---- */
  let root, input, list, items = [], active = 0, open = false;
  const PAGES = [
    {label:"Overview",   hint:"Trends & concentration", href:"index.html"},
    {label:"Live",       hint:"Top categories now",     href:"live.html"},
    {label:"Historical", hint:"Rankings & movers",      href:"historical.html"},
  ];

  const buildPalette = () => {
    root = document.createElement("div");
    root.className = "cmdk";
    root.innerHTML =
      '<div class="cmdk-backdrop"></div>'+
      '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">'+
        '<input class="cmdk-input" type="text" placeholder="Jump to a page or category…" aria-label="Search" autocomplete="off" spellcheck="false">'+
        '<div class="cmdk-list" role="listbox"></div>'+
        '<div class="cmdk-foot"><span><b>↑↓</b> navigate</span><span><b>↵</b> open</span><span><b>esc</b> close</span></div>'+
      '</div>';
    document.body.appendChild(root);
    input = root.querySelector(".cmdk-input");
    list  = root.querySelector(".cmdk-list");
    root.querySelector(".cmdk-backdrop").addEventListener("click", close);
    input.addEventListener("input", render);
    input.addEventListener("keydown", onKey);
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const allItems = () => PAGES.concat((window.__CATS || []).map(c =>
    ({label:c, hint:"Open on Live", href:"live.html#"+encodeURIComponent(c), cat:true})));

  const render = () => {
    const q = input.value.trim().toLowerCase();
    items = allItems().filter(it => !q || it.label.toLowerCase().includes(q));
    active = 0;
    list.innerHTML = items.map((it,i) =>
      `<div class="cmdk-item${i===0?" active":""}" data-i="${i}" role="option">
         <span class="cmdk-ic">${it.cat?"#":"›"}</span>
         <span class="cmdk-lbl">${esc(it.label)}</span>
         <span class="cmdk-hint">${esc(it.hint)}</span>
       </div>`).join("") || '<div class="cmdk-empty">No matches</div>';
    list.querySelectorAll(".cmdk-item").forEach(el => {
      el.addEventListener("mousemove", () => setActive(+el.dataset.i));
      el.addEventListener("click", () => activate(+el.dataset.i));
    });
  };

  const setActive = i => {
    active = i;
    const els = list.querySelectorAll(".cmdk-item");
    els.forEach((el,k) => el.classList.toggle("active", k===i));
    if(els[i]) els[i].scrollIntoView({block:"nearest"});
  };

  const activate = i => {
    const it = items[i]; if(!it) return;
    close();
    const here = location.pathname.split("/").pop() || "index.html";
    const [path, hash] = it.href.split("#");
    if(path === here){ if(hash) location.hash = hash; return; }   // same page → just set hash
    location.href = it.href;
  };

  const onKey = e => {
    if(e.key==="ArrowDown"){ e.preventDefault(); setActive(Math.min(items.length-1, active+1)); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); setActive(Math.max(0, active-1)); }
    else if(e.key==="Enter"){ e.preventDefault(); activate(active); }
    else if(e.key==="Escape"){ e.preventDefault(); close(); }
  };

  const openPalette = () => {
    if(!root) buildPalette();
    open = true; root.classList.add("on");
    input.value = ""; render(); input.focus();
  };
  function close(){ if(root){ open=false; root.classList.remove("on"); } }

  document.addEventListener("keydown", e => {
    if((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K")){ e.preventDefault(); open ? close() : openPalette(); }
  });

  /* ---- inject the nav tools (search + density) ---- */
  const buildTools = () => {
    const nav = document.querySelector(".nav");
    if(!nav || nav.querySelector(".navtools")) return;
    const tools = document.createElement("span");
    tools.className = "navtools";

    const search = document.createElement("button");
    search.type = "button"; search.className = "navtool";
    search.setAttribute("aria-label", "Search (press "+(isMac?"⌘":"Ctrl")+"K)");
    search.title = "Search · "+(isMac?"⌘":"Ctrl")+"K";
    search.innerHTML = ICON_SEARCH + '<span class="kbd">'+(isMac?"⌘":"Ctrl")+'K</span>';
    search.onclick = openPalette;

    const dens = document.createElement("button");
    dens.type = "button"; dens.className = "navtool";
    const paintDens = () => {
      const d = document.documentElement.getAttribute("data-density");
      dens.setAttribute("aria-pressed", d === "compact" ? "true" : "false");
      dens.title = "Density: "+d;
      dens.setAttribute("aria-label", "Toggle density (currently "+d+")");
    };
    dens.innerHTML = ICON_DENSITY;
    dens.onclick = () => { window.__toggleDensity(); paintDens(); };
    paintDens();

    tools.appendChild(search); tools.appendChild(dens);
    nav.appendChild(tools);
  };

  if(document.readyState !== "loading") buildTools();
  else document.addEventListener("DOMContentLoaded", buildTools);
})();
