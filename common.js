/* common.js — shared helpers + data loader for all dashboard pages */

const PALETTE = ["#a970ff","#13e3c5","#ff7eb6","#ffb347","#5aa9ff","#9dff6e","#ff6b6b","#c08bff","#46d6a8","#ffd166"];

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
    .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
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
