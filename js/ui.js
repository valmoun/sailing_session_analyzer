import { SPORT_CONFIG }     from './config.js';
import { generateInsights } from './insights.js';

// ── Helpers ──────────────────────────────────────────────────
const setText = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.textContent = (v != null && v !== '') ? v : '—';
};

export function fmtDuration(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600),
        m = Math.floor((sec % 3600) / 60),
        s = sec % 60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function cardinalName(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][
    Math.round(((deg % 360) + 360) % 360 / 45) % 8
  ];
}

// ── Session list ─────────────────────────────────────────────
export function renderSessionList(sessions, activeId) {
  const list = document.getElementById('session-list');
  list.style.display = sessions.length ? 'flex' : 'none';
  list.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sess-item' + (s.id === activeId ? ' active' : '');
    item.dataset.id = s.id;           // needed for event delegation in app.js
    item.innerHTML = `
      <div class="sess-dot" style="background:${s.color}"></div>
      <div class="sess-name" title="${s.name}">${s.name}</div>
      <button class="sess-btn" title="${s.visible ? 'Hide' : 'Show'}">${s.visible ? '👁' : '🙈'}</button>
      <button class="sess-btn" title="Remove">✕</button>`;
    list.appendChild(item);
  });
}

// ── Compass ──────────────────────────────────────────────────
export function updateCompass(windDir) {
  const d = ((windDir % 360) + 360) % 360;
  document.getElementById('compass-arrow').style.transform =
    `translateX(-50%) translateY(-100%) rotate(${d}deg)`;
  document.getElementById('compass-from').textContent = cardinalName(d);
  document.getElementById('compass-to').textContent   = cardinalName((d + 180) % 360);
}

// ── Main stats panel ─────────────────────────────────────────
export function updateUI(stats, maneuvers, currentSport) {
  document.getElementById('stats-panel').style.display = 'block';
  const cfg = SPORT_CONFIG[currentSport];

  setText('s-top',  stats.topSpeed);
  setText('s-avg',  stats.avgSpeed);
  setText('s-b10',  stats.best10s);
  setText('s-b30',  stats.best30s);
  setText('s-b60',  stats.best60s);
  setText('s-dist', stats.totalNM);
  setText('s-dur',  fmtDuration(stats.durSec));

  document.getElementById('sb-up').style.width  = stats.sailPct.upwind   + '%';
  document.getElementById('sb-rch').style.width = stats.sailPct.reach    + '%';
  document.getElementById('sb-dwn').style.width = stats.sailPct.downwind + '%';
  setText('sp-up',  stats.sailPct.upwind);
  setText('sp-rch', stats.sailPct.reach);
  setText('sp-dwn', stats.sailPct.downwind);
  setText('s-vmgu', stats.bestVMGUp);
  setText('s-vmgd', stats.bestVMGDown);
  setText('s-ua',   stats.bestUpAngle);
  setText('s-da',   stats.bestDwnAngle);

  const kE = document.getElementById('man-kite');
  const tE = document.getElementById('man-tack');
  const gE = document.getElementById('man-gybe');

  if (cfg.kiteMode) {
    kE.style.display = 'block'; tE.style.display = gE.style.display = 'none';
    setText('man-kite-lbl',  cfg.manLabel);
    setText('s-trans',       stats.transCount);
    setText('s-trans-dur',   stats.avgTransSec);
    setText('s-trans-drift', stats.avgTransDst);
  } else {
    kE.style.display = 'none'; tE.style.display = gE.style.display = 'block';
    setText('s-tacks', stats.tackCount);
    setText('s-gybes', stats.gybeCount);
    setText('s-tq', stats.avgTackQ != null ? `avg ${stats.avgTackQ}% speed kept` : '');
    setText('s-gq', stats.avgGybeQ != null ? `avg ${stats.avgGybeQ}% speed kept` : '');
  }

  const manNote = cfg.kiteMode ? '🔄 Transitions' : '🔵 Tacks · 🟠 Gybes';
  setText('map-note', `🟢 Start · 🔴 End · ${manNote}`);

  // Insights
  const tips = generateInsights(stats, currentSport);
  const wrap = document.getElementById('insights-wrap');
  wrap.innerHTML = '';
  tips.forEach(tip => {
    const d = document.createElement('div');
    d.className = `insight ${tip.level}`;
    d.textContent = tip.text;
    wrap.appendChild(d);
  });
}

export function updateColorModeUI (mode) {
  document.getElementById('tgl-speed').classList.toggle('active', mode==='speed');
  document.getElementById('tgl-pos').classList.toggle('active',   mode==='pos');
  document.getElementById('leg-speed').style.display = mode==='speed' ? 'flex' : 'none';
  document.getElementById('leg-pos').style.display   = mode==='pos'   ? 'flex' : 'none';
}