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

/* fetch the shared data file (cache-busted) */
function loadData(){
  return fetch("data.json?_="+Date.now())
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(data=>{
      /* viewership ranking (current is sorted) — used to pick chart focus */
      window.__VIEW_RANK = Object.fromEntries(
        (data.current||[]).map((c,i)=>[c.category,i]));
      return data;
    });
}

/* update the "updated X ago" status pill if the page has one */
function setUpdated(data){
  const el=document.getElementById("updated");
  if(el) el.textContent = "updated "+timeAgo(data.latest_snapshot||data.generated_at);
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

  if (IS_MOBILE) {
    const L = Chart.defaults.plugins.legend.labels;
    L.boxWidth = 8; L.boxHeight = 8; L.padding = 8;
    L.font = {family:"IBM Plex Sans", size:10};
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


/* ---- range pills + category chips, injected above every line chart ---- */
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
      if (isTime) {
        let mx = 0;
        chart.data.datasets.forEach(d => d.data.forEach(p => {
          const t = +new Date(p.x); if (t > mx) mx = t;
        }));
        chart.$mx = mx;
      } else {
        chart.$L = chart.data.labels.slice();
        chart.$D = chart.data.datasets.map(d => d.data.slice());
      }

      function setRange(m){
        if (isTime) {
          chart.options.scales.x.min =
            m ? new Date(chart.$mx - m*30.44*864e5).toISOString() : undefined;
        } else {
          const n = m || chart.$L.length;
          chart.data.labels = chart.$L.slice(-n);
          chart.data.datasets.forEach((d,i) => d.data = chart.$D[i].slice(-n));
        }
        chart.update();
      }

      const ctl = document.createElement("div"); ctl.className = "chartctl";
      const pills = document.createElement("div"); pills.className = "pills";
      const def = isTime ? 6 : 0;
      [["3M",3],["6M",6],["1Y",12],["All",0]].forEach(([t,m]) => {
        const b = document.createElement("button");
        b.className = "cpill" + (m===def ? " on" : "");
        b.textContent = t;
        b.onclick = () => {
          pills.querySelectorAll(".cpill").forEach(x => x.classList.remove("on"));
          b.classList.add("on");
          setRange(m);
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
      if (def) setRange(def);
    }
  });
}
