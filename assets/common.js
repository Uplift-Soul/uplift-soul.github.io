/* common.js — shared helpers + data loader for all dashboard pages */

/* Google Analytics 4 (gtag.js) — installed once here so every page (and any future
   page that loads common.js) is covered automatically. */
(function(){
  var GA_ID = "G-3WCRTR4K5N";
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };

  /* Consent Mode v2 (GDPR/PECR) — analytics off by default. gtag.js still loads,
     but with analytics_storage "denied" it stores no cookies and sends only
     cookieless pings until the visitor accepts. A previously stored "granted"
     choice is restored here so returning consenters get full analytics on load
     and never see the banner again. Must run before gtag('config'). */
  var consent = null;
  try { consent = localStorage.getItem("invst-consent"); } catch(e){}
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: consent === "granted" ? "granted" : "denied"
  });
  window.__consent = consent;   // read by the consent banner below

  gtag("js", new Date());
  gtag("config", GA_ID);

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(s);
})();

/* GA4 click events — which hub cards / nav links pull people in. Event delegation so it
   covers every page (and any future page) automatically; gtag's default beacon transport
   sends the hit reliably even as the click navigates away. */
(function(){
  var pid = p => (p.split("#")[0].split("?")[0].replace(/^.*\//,"").replace(/\.html$/,"") || "index");
  document.addEventListener("click", function(e){
    if(typeof window.gtag !== "function" || !e.target.closest) return;
    var card = e.target.closest(".hubcard");
    if(card){
      gtag("event", "hub_card_click", {
        destination: pid(card.getAttribute("href") || ""),
        link_text: ((card.querySelector(".hubname") || {}).textContent || "").trim()
      });
      return;
    }
    var nav = e.target.closest("nav.nav a");
    if(nav){
      gtag("event", "nav_click", {
        destination: pid(nav.getAttribute("href") || ""),
        link_text: (nav.textContent || "").trim(),
        from_page: pid(location.pathname)
      });
    }
  }, true);
})();

/* small gtag wrapper — safe no-op if GA didn't load (adblockers, offline). Used
   for the interaction events fired from the chart controls, palette, etc. */
function track(name, params){
  if (typeof window.gtag === "function") gtag("event", name, params || {});
}

/* Ledger categorical palette — validated colorblind-safe (dataviz skill:
   lightness band, chroma floor, adjacent-pair CVD separation, contrast all pass).
   Assigned in fixed order, never cycled; the first five carry the default focus set. */
const PALETTE = ["#1aa87d","#b67e2b","#7d5ae0","#3f86d6","#d15f92","#2dd4a0","#e6b45a","#5aa9ff","#c77dff","#ff9db1"];

const fmt = n => {
  n = Number(n)||0;
  if (n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,'')+"M";
  if (n>=1e3) return (n/1e3).toFixed(n>=1e4?0:1).replace(/\.0$/,'')+"K";
  return String(n);
};
const fullNum = n => (Number(n)||0).toLocaleString("en-GB");

/* escape a string before it goes into innerHTML — covers element text and
   double-quoted attribute values, so names/URLs from data.json (Twitch/IGDB,
   some of it community-editable) can't inject markup. Use at every innerHTML
   sink that interpolates data. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

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
  /* Chart animations are disabled. Chart.js 4.4.1's animator throws
     "this._fn is not a function" (Animation.tick → Animator._update) when our
     line charts transition: the range pills swap in datasets with different
     point counts and the gap-break logic inserts null points, which trips the
     interpolator. The thrown tick kills the animation loop, after which every
     update() changed the data but never repainted — so charts froze after a
     scroll and controls looked dead. Rendering without animation sidesteps the
     bug entirely and applies control changes instantly. */
  Chart.defaults.animation = false;

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
          track("chart_range_select", { range: t, chart: chart.canvas.id });
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
          const vis = !chart.isDatasetVisible(i);
          chart.setDatasetVisibility(i, vis);
          chart.update(); paint();
          track("chart_series_toggle", { series: d.label, visible: vis ? "show" : "hide", chart: chart.canvas.id });
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
      e.target.style.transitionDelay = (i * 55) + "ms";
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


/* --- nav tools (⌘K) + command palette + scroll-collapse burger ------------- */
(() => {
  const ICON_SEARCH =
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const ICON_BURGER =
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="2.5" y1="4.5" x2="13.5" y2="4.5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/><line x1="2.5" y1="11.5" x2="13.5" y2="11.5"/></g></svg>';

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ---- palette ---- */
  let root, input, list, items = [], active = 0, open = false;
  const PAGES = [
    {label:"Overview",   hint:"Trends & concentration", href:"/"},
    {label:"Live",       hint:"Top categories now",     href:"/live"},
    {label:"Trending",   hint:"New entrants",           href:"/trending"},
    {label:"Publishers", hint:"Attention share",        href:"/publishers"},
    {label:"Historical", hint:"Rankings & movers",      href:"/historical"},
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

  const allItems = () => PAGES.concat((window.__CATS || []).map(c =>
    ({label:c, hint:"Open on Live", href:"/live#"+encodeURIComponent(c), cat:true})));

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

  /* normalise any path/href to a page id so same-page detection works whether the
     URL is "/live", "/live.html" or "/" (root → "index") */
  const pageId = p => (p.split("#")[0].split("?")[0].replace(/^.*\//,"").replace(/\.html$/,"") || "index");

  const activate = i => {
    const it = items[i]; if(!it) return;
    track("palette_select", { selection: it.label, selection_type: it.cat ? "category" : "page", query: input.value.trim() });
    close();
    const hash = it.href.split("#")[1];
    if(pageId(it.href) === pageId(location.pathname)){ if(hash) location.hash = hash; return; }  // same page → just set hash
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
    track("palette_open");
  };
  function close(){ if(root){ open=false; root.classList.remove("on"); } }

  document.addEventListener("keydown", e => {
    if((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K")){ e.preventDefault(); open ? close() : openPalette(); }
  });

  /* ---- inject the ⌘K search button into the full bar ---- */
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
    tools.appendChild(search);
    nav.appendChild(tools);
  };

  /* ---- scroll-collapse burger: a mini bar (burger + search) that fades in as the
     full nav fades out on scroll. The burger opens a dropdown of the pages, built
     from PAGES so it stays in sync; the search button opens the ⌘K palette. ---- */
  const buildBurger = () => {
    if (document.querySelector(".navmini")) return;
    const here = pageId(location.pathname);

    const menu = document.createElement("nav");
    menu.className = "navmenu"; menu.setAttribute("aria-label", "Pages");
    menu.innerHTML = PAGES.map(p =>
      `<a href="${p.href}" class="navmenu-item${pageId(p.href)===here?" active":""}">${esc(p.label)}</a>`
    ).join("");

    const mini = document.createElement("div"); mini.className = "navmini";
    const burger = document.createElement("button");
    burger.type = "button"; burger.className = "navtool burger";
    burger.setAttribute("aria-label", "Open menu"); burger.setAttribute("aria-expanded", "false");
    burger.innerHTML = ICON_BURGER;
    const search = document.createElement("button");
    search.type = "button"; search.className = "navtool";
    search.setAttribute("aria-label", "Search (press "+(isMac?"⌘":"Ctrl")+"K)");
    search.title = "Search · "+(isMac?"⌘":"Ctrl")+"K";
    search.innerHTML = ICON_SEARCH;
    search.onclick = openPalette;

    let menuOpen = false;
    const setMenu = o => {
      menuOpen = o; menu.classList.toggle("on", o); burger.classList.toggle("on", o);
      burger.setAttribute("aria-expanded", o ? "true" : "false");
    };
    burger.onclick = e => { e.stopPropagation(); setMenu(!menuOpen); };
    document.addEventListener("click", e => {
      if(menuOpen && !menu.contains(e.target) && !mini.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", e => { if(menuOpen && e.key==="Escape") setMenu(false); });
    /* keep nav analytics complete — the delegated nav_click listener only matches
       `nav.nav a`, which the burger menu isn't, so fire the event here too. */
    menu.addEventListener("click", e => {
      const a = e.target.closest("a"); if(!a) return;
      track("nav_click", { destination: pageId(a.getAttribute("href")||""),
        link_text: (a.textContent||"").trim(), from_page: here });
      setMenu(false);
    });

    mini.appendChild(burger); mini.appendChild(search);
    document.body.appendChild(menu); document.body.appendChild(mini);

    /* collapse once a top sentinel (80px down) scrolls out of view */
    const rootEl = document.documentElement;
    const collapse = on => { rootEl.classList.toggle("nav-collapsed", on); if(!on) setMenu(false); };
    if ("IntersectionObserver" in window) {
      const sentinel = document.createElement("div");
      sentinel.style.cssText = "position:absolute;top:80px;left:0;width:1px;height:1px;pointer-events:none";
      document.body.appendChild(sentinel);
      new IntersectionObserver(es => collapse(!es[0].isIntersecting)).observe(sentinel);
    } else {
      let last = false;
      addEventListener("scroll", () => {
        const on = (window.scrollY || rootEl.scrollTop) > 80;
        if(on !== last){ last = on; collapse(on); }
      }, { passive:true });
    }
  };

  const init = () => { buildTools(); buildBurger(); };
  if(document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();


/* --- consent banner ----------------------------------------------------------
   Shown once, only until the visitor chooses. Accept flips Consent Mode's
   analytics_storage to granted (so cookies + full analytics turn on for this and
   future visits); Decline leaves it denied. Either way the choice is persisted,
   so the banner never reappears. Skipped entirely when a choice already exists. */
(() => {
  if (window.__consent === "granted" || window.__consent === "denied") return;
  const build = () => {
    if (document.querySelector(".consent")) return;
    const bar = document.createElement("div");
    bar.className = "consent";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Privacy choice");
    bar.innerHTML =
      '<p class="consent-msg">This site uses <b>Google Analytics</b> to see how it’s used — no ads, nothing sold on. Analytics cookies stay off until you accept.</p>' +
      '<div class="consent-acts">' +
        '<button class="consent-btn" type="button" data-consent="denied">Decline</button>' +
        '<button class="consent-btn ok" type="button" data-consent="granted">Accept</button>' +
      '</div>';
    const choose = v => {
      if (v === "granted" && typeof window.gtag === "function")
        gtag("consent", "update", { analytics_storage: "granted" });
      try { localStorage.setItem("invst-consent", v); } catch(e){}
      window.__consent = v;
      bar.remove();
    };
    bar.querySelectorAll("[data-consent]").forEach(b =>
      b.addEventListener("click", () => choose(b.getAttribute("data-consent"))));
    document.body.appendChild(bar);
  };
  if (document.readyState !== "loading") build();
  else document.addEventListener("DOMContentLoaded", build);
})();
