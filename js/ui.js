// SECTION 1 — MAP SETUP
//   CartoDB Voyager  — fond global, mer bleue, détail élevé jusqu'au zoom 20
//   OpenSeaMap       — marquages nautiques (toggle)

const cartoVoyager = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }
);

const seaMap = L.tileLayer(
  'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
  {
    attribution: '© <a href="https://www.openseamap.org">OpenSeaMap</a>',
    maxZoom: 18,
    opacity: 0.8,
  }
);

const map = L.map('map', { center:[40,0], zoom:3, layers:[cartoVoyager, seaMap] });

// Independent layer groups for clean clearing / redrawing
const trackLayer  = L.layerGroup().addTo(map); // session polylines
const arrowLayer  = L.layerGroup().addTo(map); // direction arrows (active session)
const markerLayer = L.layerGroup().addTo(map); // start/end/maneuver markers

let seaMapVisible = true;
function toggleSeaMap() {
  seaMapVisible = !seaMapVisible;
  seaMapVisible ? map.addLayer(seaMap) : map.removeLayer(seaMap);
  document.getElementById('osm-toggle').classList.toggle('active', seaMapVisible);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9 — MAP RENDERING  (Leaflet)

   renderAllSessions():
     Active session  → speed/POS-coloured segments + direction arrows + markers
     Other sessions  → solid polyline in session palette colour at 55% opacity

   Direction arrows:
     SVG upward triangle every ARROW_EVERY_M metres of track.
     CSS transform:rotate() aligns arrow with bearingSmooth.
     pointer-events:none so arrows don't block map interactions.
═══════════════════════════════════════════════════════════════ */

let colorMode = 'speed';
const POS_COLOR = { upwind:'#0ea5e9', reach:'#22c55e', downwind:'#f59e0b' };
const ARROW_EVERY_M = 130;

function speedColor(t) {
  t = Math.max(0,Math.min(1,t));
  const s = [[59,130,246],[34,197,94],[245,158,11],[239,68,68]];
  const x=t*(s.length-1), lo=Math.floor(x), hi=Math.min(s.length-1,lo+1), f=x-lo;
  return 'rgb('+s[lo].map((c,j)=>Math.round(c+f*(s[hi][j]-c))).join(',')+')';
}

function trackColor(pt, minSpd, spdRange) {
  return colorMode==='pos' ? (POS_COLOR[pt.pos]||'#888') : speedColor((pt.speedKts-minSpd)/spdRange);
}

/*
  Direction arrows: we place a small SVG arrowhead every ARROW_EVERY_M metres.
  Distance-based spacing avoids clustering in slow areas (which point-index
  spacing would cause). The SVG points north at 0 deg; CSS rotate() turns it
  to match the smoothed bearing, avoiding the 0/360 wraparound issue a
  manual sin/cos approach would need.
*/
function renderArrows(pts, minSpd, spdRange) {
  let distAcc = 0;
  for (let i=1; i<pts.length-1; i++) {
    distAcc += pts[i].distM || 0;
    if (distAcc < ARROW_EVERY_M) continue;
    if (pts[i].speedKts < 2.5)  { distAcc=0; continue; }
    distAcc = 0;

    const color   = trackColor(pts[i], minSpd, spdRange);
    const bearing = pts[i].bearingSmooth;

    L.marker([pts[i].lat, pts[i].lon], {
      icon: L.divIcon({
        html: `<svg style="pointer-events:none;transform:rotate(${bearing}deg);display:block"
                 width="8" height="12" viewBox="0 0 8 12">
                 <polygon points="4,0 7.5,12 4,9 0.5,12" fill="${color}" opacity="0.82"/>
               </svg>`,
        className: 'arrow-icon',
        iconSize:  [8,12],
        iconAnchor:[4,6],
      }),
      keyboard: false,
    }).addTo(arrowLayer);
  }
}

function renderAllSessions() {
  trackLayer.clearLayers();
  arrowLayer.clearLayers();
  markerLayer.clearLayers();

  sessions.forEach(sess => {
    if (!sess.visible || !sess.pts) return;
    const isActive = sess.id === activeSessionId;
    const pts = sess.pts;
    const speeds = pts.map(p=>p.speedKts);
    const minSpd  = Math.min(...speeds);
    const spdRange = (Math.max(...speeds)-minSpd) || 1;

    if (isActive) {
      // Active: per-segment colour + arrows
      for (let i=1; i<pts.length; i++) {
        L.polyline([[pts[i-1].lat,pts[i-1].lon],[pts[i].lat,pts[i].lon]], {
          color: trackColor(pts[i],minSpd,spdRange), weight:3.5, opacity:0.92, smoothFactor:1,
        }).addTo(trackLayer);
      }
      renderArrows(pts, minSpd, spdRange);
    } else {
      // Inactive: solid session-colour polyline
      L.polyline(pts.map(p=>[p.lat,p.lon]),
        { color:sess.color, weight:2.5, opacity:0.55, smoothFactor:1 }
      ).addTo(trackLayer);
    }
  });

  // Markers for active session only
  const active = getActiveSession();
  if (!active?.pts) return;

  const addDot = (lat,lon,color,tip,r=8) =>
    L.circleMarker([lat,lon],{radius:r,color,fillColor:color,fillOpacity:1,weight:2})
     .bindTooltip(tip,{direction:'top'}).addTo(markerLayer);

  addDot(active.pts[0].lat, active.pts[0].lon, '#22c55e','🟢 Start', 9);
  addDot(active.pts[active.pts.length-1].lat, active.pts[active.pts.length-1].lon, '#ef4444','🔴 End', 9);

  const cfg = SPORT_CONFIG[currentSport];
  (active.maneuvers||[]).forEach((m,idx) => {
    const isTack = m.type==='tack';
    const color  = isTack ? '#38bdf8' : '#fb923c';
    const label  = cfg.kiteMode ? `🔄 Transition #${idx+1}` : (isTack?`🔵 Tack #${idx+1}`:`🟠 Gybe #${idx+1}`);
    let driftText = '?';
    if (m.transitionDistM != null) {
      // Si la dérive est positive : perte de terrain (Rouge). Si négative : gain (Vert).
      const colorSpan = m.transitionDistM > 0 ? 'color:#ef4444' : 'color:#22c55e';
      driftText = `<span style="${colorSpan}; font-weight:bold;">${m.transitionDistM}m</span>`;
    }

    const tip = label +
      (m.time ? `<br>🕐 ${m.time.toLocaleTimeString()}` : '') +
      (cfg.kiteMode
        ? `<br>Duration: ${m.transitionSec??'?'} s · Drift: ${driftText}`
        : `<br>${m.speedBefore} kts → ${m.speedAfter} kts · Quality: ${m.quality??'?'}%`);
    addDot(m.lat, m.lon, color, tip, 6);
  });
}

function setColorMode(mode) {
  colorMode = mode;
  document.getElementById('tgl-speed').classList.toggle('active', mode==='speed');
  document.getElementById('tgl-pos').classList.toggle('active',   mode==='pos');
  document.getElementById('leg-speed').style.display = mode==='speed' ? 'flex' : 'none';
  document.getElementById('leg-pos').style.display   = mode==='pos'   ? 'flex' : 'none';
  renderAllSessions();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11 — UI CONTROLLER
   Wires DOM events → analysis pipeline → visual output.
═══════════════════════════════════════════════════════════════ */

const setText = (id, v) => {
  const el = document.getElementById(id);
  if (el) el.textContent = (v!=null&&v!=='') ? v : '—';
};

function fmtDuration(sec) {
  sec = Math.round(sec);
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  return h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function cardinalName(deg) {
  return ['N','NE','E','SE','S','SW','W','NW'][Math.round(((deg%360)+360)%360/45)%8];
}

// Wind compass visual
function updateCompass(windDir) {
  const d = ((windDir%360)+360)%360;
  document.getElementById('compass-arrow').style.transform = `translateX(-50%) translateY(-100%) rotate(${d}deg)`;
  document.getElementById('compass-from').textContent = cardinalName(d);
  document.getElementById('compass-to').textContent   = cardinalName((d+180)%360);
}
document.getElementById('wind-dir').addEventListener('input', e=>updateCompass(parseFloat(e.target.value)||0));
updateCompass(270);

// Sport tab clicks
document.querySelectorAll('.sport-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sport-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentSport = btn.dataset.sport;
    const cfg = SPORT_CONFIG[currentSport];
    document.getElementById('app-title').textContent = `${cfg.emoji} ${cfg.label} Analyzer`;
    if (sessions.some(s=>s.rawPoints)) runAnalysis();
  });
});

// Update all stat cards
function updateUI(stats, maneuvers) {
  document.getElementById('stats-panel').style.display = 'block';
  const cfg = SPORT_CONFIG[currentSport];
  setText('active-sess-name', getActiveSession()?.name??'');

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
    setText('s-tq', stats.avgTackQ!=null ? `avg ${stats.avgTackQ}% speed kept` : '');
    setText('s-gq', stats.avgGybeQ!=null ? `avg ${stats.avgGybeQ}% speed kept` : '');
  }

  const manNote = cfg.kiteMode ? '🔄 Transitions' : '🔵 Tacks · 🟠 Gybes';
  setText('map-note', `🟢 Start · 🔴 End · ${manNote}`);

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

// Main analysis pipeline — runs on all sessions
function runAnalysis() {
  if (!sessions.length) return;
  const windDir = parseFloat(document.getElementById('wind-dir').value)||0;
  document.getElementById('loading').style.display = 'flex';

  requestAnimationFrame(()=>setTimeout(()=>{
    try {
      sessions.forEach(sess => {
        if (!sess.rawPoints) return;
        sess.pts       = enrichTrack(sess.rawPoints, windDir, currentSport);
        sess.maneuvers = detectManeuvers(sess.pts);
        sess.stats     = computeStats(sess.pts, sess.maneuvers);
      });
      renderAllSessions();
      const act = getActiveSession();
      if (act?.stats) updateUI(act.stats, act.maneuvers);
      const allPts = sessions.flatMap(s=>s.visible&&s.pts?s.pts:[]);
      if (allPts.length) map.fitBounds(L.latLngBounds(allPts.map(p=>[p.lat,p.lon])),{padding:[30,30]});
    } catch(err) {
      alert('Analysis error: '+err.message);
      console.error('[Sailing Analyzer]',err);
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  }, 30));
}

// File loading
function loadGPXFile(file) {
  const reader = new FileReader();
  reader.onerror = ()=>alert('Could not read: '+file.name);
  reader.onload = e => {
    try {
      const rawPts = parseGPX(e.target.result);
      const sess   = addSession(file.name, rawPts);
      if (!sess) return;
      document.getElementById('analyze-btn').disabled = false;
      // Quick preview before analysis
      L.polyline(rawPts.map(p=>[p.lat,p.lon]),{color:sess.color,weight:2,opacity:0.5}).addTo(trackLayer);
      map.fitBounds(L.latLngBounds(rawPts.map(p=>[p.lat,p.lon])),{padding:[30,30]});
    } catch(err) { alert(`Could not load ${file.name}: ${err.message}`); }
  };
  reader.readAsText(file);
}

// Event listeners
document.getElementById('file-input').addEventListener('change', e=>{
  [...e.target.files].forEach(loadGPXFile);
  e.target.value='';
});

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',  e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave', ()=>dz.classList.remove('over'));
dz.addEventListener('drop', e=>{
  e.preventDefault(); dz.classList.remove('over');
  const gpxFiles = [...e.dataTransfer.files].filter(f=>/\.(gpx|xml)$/i.test(f.name));
  if (!gpxFiles.length) { alert('Please drop .gpx files.'); return; }
  gpxFiles.forEach(loadGPXFile);
});

document.getElementById('analyze-btn').addEventListener('click', runAnalysis);

['wind-dir','wind-speed'].forEach(id=>{
  document.getElementById(id).addEventListener('change',()=>{
    if (sessions.some(s=>s.rawPoints)) runAnalysis();
  });
});