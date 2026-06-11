export const state = {
  sessions: [],
  activeSessionId: null,
  sessionIdCounter: 0,
  currentSport: 'kitesurfing',
  windDir: 0,
};



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

export function addSession(name, rawPts) {
  if (state.sessions.length >= 6) return null;

  const id = state.sessionIdCounter++;
  const color = PALETTE[state.sessions.length % PALETTE.length];

  const sess = {
    id,
    name,
    color,
    rawPoints: rawPts,
    pts: null,
    maneuvers: null,
    stats: null,
    visible: true
  };

  state.sessions.push(sess);
  state.activeSessionId = id;

  return sess;
}

export function removeSession(id) {
  const idx = state.sessions.findIndex(s => s.id === id);
  if (idx < 0) return null;

  state.sessions.splice(idx, 1);

  if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions.length
      ? state.sessions[state.sessions.length - 1].id
      : null;
  }

  return state.activeSessionId;
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
