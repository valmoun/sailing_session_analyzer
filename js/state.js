/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — SPORT CONFIGURATION
   All sport-specific constants live here.  The rest of the code
   reads from SPORT_CONFIG[sport] rather than scattering if/else.

   kiteMode:true  → maneuvers called "transitions", show duration+drift
   kiteMode:false → separate tack/gybe with speed-quality metric
═══════════════════════════════════════════════════════════════ */

const SPORT_CONFIG = {
  // Twin-tip/Wave: Upwind is harder (~60°). Downwind requires crossing at angles (~140°).
  kitesurfing: { label:'Kitesurfing', emoji:'🪁', upMax:60,  dwnMin:130, kiteMode:true,  manLabel:'Transitions', speedMax:35 },
  
  // Kitefoil: Elite hydrofoils point insanely high (~42°) and push ultra deep downwind (~140°).
  kitefoiling: { label:'Kitefoiling', emoji:'🦅', upMax:46,  dwnMin:135, kiteMode:true,  manLabel:'Transitions', speedMax:48 },
  
  // Windsurfing (Slalom/Freeride): Can't pinch high upwind (~58°). Broad reaches deeply downwind (~135°).
  windsurfing: { label:'Windsurfing', emoji:'🏄', upMax:55,  dwnMin:130, kiteMode:false, manLabel:'Tacks & Gybes', speedMax:45 },
  
  // Yacht (Performance Monohull): Upwind targets are tight (~43°). Downwind asymmetric angles hover around 142°.
  yacht:       { label:'Yacht',       emoji:'⛵', upMax:45,  dwnMin:140, kiteMode:false, manLabel:'Tacks & Gybes', speedMax:15 },
};

let currentSport = 'kitesurfing';

/* ═══════════════════════════════════════════════════════════════
   SECTION 10 — SESSION MANAGEMENT
   In-memory store — everything gone when the tab closes.
   No data ever leaves the browser.

   Up to 6 sessions, each with a unique palette colour.
   Clicking a session row in the sidebar makes it "active"
   (stats panel and markers update to reflect it).
═══════════════════════════════════════════════════════════════ */

const PALETTE = ['#00c4ff','#fb923c','#a78bfa','#22c55e','#f472b6','#facc15'];
const sessions = [];
let activeSessionId  = null;
let sessionIdCounter = 0;

function getActiveSession() { return sessions.find(s=>s.id===activeSessionId)??null; }

function addSession(name, rawPts) {
  if (sessions.length >= 6) { alert('Maximum 6 sessions — remove one first.'); return null; }
  const id    = sessionIdCounter++;
  const color = PALETTE[sessions.length % PALETTE.length];
  const sess  = { id, name, color, rawPoints:rawPts, pts:null, maneuvers:null, stats:null, visible:true };
  sessions.push(sess);
  activeSessionId = id;
  renderSessionList();
  return sess;
}

function removeSession(id) {
  const idx = sessions.findIndex(s=>s.id===id);
  if (idx<0) return;
  sessions.splice(idx,1);
  if (activeSessionId===id) activeSessionId = sessions.length ? sessions[sessions.length-1].id : null;
  renderSessionList(); renderAllSessions();
  const act = getActiveSession();
  if (act?.stats) updateUI(act.stats, act.maneuvers);
  else document.getElementById('stats-panel').style.display = 'none';
}

function toggleSessionVis(id) {
  const s = sessions.find(s=>s.id===id);
  if (s) { s.visible=!s.visible; renderSessionList(); renderAllSessions(); }
}

function setActiveSession(id) {
  activeSessionId = id;
  renderSessionList(); renderAllSessions();
  const act = getActiveSession();
  if (act?.stats) updateUI(act.stats, act.maneuvers);
}

function renderSessionList() {
  const list = document.getElementById('session-list');
  list.style.display = sessions.length ? 'flex' : 'none';
  list.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sess-item'+(s.id===activeSessionId?' active':'');
    item.innerHTML = `
      <div class="sess-dot" style="background:${s.color}"></div>
      <div class="sess-name" title="${s.name}">${s.name}</div>
      <button class="sess-btn" title="${s.visible?'Hide':'Show'}">${s.visible?'👁':'🙈'}</button>
      <button class="sess-btn" title="Remove">✕</button>`;
    item.addEventListener('click', e=>{ if(!e.target.closest('button')) setActiveSession(s.id); });
    const [vBtn,dBtn] = item.querySelectorAll('.sess-btn');
    vBtn.addEventListener('click',e=>{e.stopPropagation();toggleSessionVis(s.id);});
    dBtn.addEventListener('click',e=>{e.stopPropagation();removeSession(s.id);});
    list.appendChild(item);
  });
}

/*
export const state = {
  sessions: [],
  currentSport: 'kitesurfing',
  windDir: 0,
  colorMode: 'speed'
};
*/
