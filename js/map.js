import { SPORT_CONFIG } from './config.js';

// ── Tile layers ──────────────────────────────────────────────
const cartoVoyager = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  { attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd', maxZoom: 20 }
);
const seaMap = L.tileLayer(
  'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
  { attribution: '© OpenSeaMap', maxZoom: 18, opacity: 0.8 }
);

export const map = L.map('map', {
  center: [40, 0], zoom: 3, layers: [cartoVoyager, seaMap]
});

const trackLayer  = L.layerGroup().addTo(map);
const arrowLayer  = L.layerGroup().addTo(map);
const markerLayer = L.layerGroup().addTo(map);

let colorMode = 'speed';

// ── Color helpers ────────────────────────────────────────────
const POS_COLOR = { upwind: '#38bdf8', reach: '#a78bfa', downwind: '#fb923c' };

function speedColor(t) {
  t = Math.max(0, Math.min(1, t));
  const s = [[59,130,246],[34,197,94],[245,158,11],[239,68,68]];
  const x = t * (s.length - 1), lo = Math.floor(x),
        hi = Math.min(s.length - 1, lo + 1), f = x - lo;
  return 'rgb(' + s[lo].map((c, j) => Math.round(c + f * (s[hi][j] - c))).join(',') + ')';
}

function trackColor(pt, minSpd, spdRange) {
  return colorMode === 'pos'
    ? (POS_COLOR[pt.pos] || '#888')
    : speedColor((pt.speedKts - minSpd) / spdRange);
}

// ── Arrow rendering ──────────────────────────────────────────
const ARROW_EVERY_M = 80;

function renderArrows(pts, minSpd, spdRange) {
  let distAcc = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    distAcc += pts[i].distM || 0;
    if (distAcc < ARROW_EVERY_M) continue;
    if (pts[i].speedKts < 2.5) { distAcc = 0; continue; }
    distAcc = 0;
    const color   = trackColor(pts[i], minSpd, spdRange);
    const bearing = pts[i].bearingSmooth;
    L.marker([pts[i].lat, pts[i].lon], {
      icon: L.divIcon({
        html: `<svg style="pointer-events:none;transform:rotate(${bearing}deg);display:block"
                 width="8" height="12" viewBox="0 0 8 12">
                 <polygon points="4,0 7.5,12 4,9 0.5,12" fill="${color}" opacity="0.82"/>
               </svg>`,
        className: 'arrow-icon', iconSize: [8,12], iconAnchor: [4,6],
      }),
      keyboard: false,
    }).addTo(arrowLayer);
  }
}

// ── Marker helper ────────────────────────────────────────────
function addDot(lat, lon, color, tipHtml, radius = 6) {
  L.circleMarker([lat, lon], {
    radius, color, fillColor: color, fillOpacity: 0.9, weight: 1.5
  }).bindPopup(tipHtml).addTo(markerLayer);
}

// ── Main render ──────────────────────────────────────────────
export function renderAllSessions(state) {
  trackLayer.clearLayers();
  arrowLayer.clearLayers();
  markerLayer.clearLayers();

  const { sessions, activeSessionId, currentSport } = state;
  const cfg = SPORT_CONFIG[currentSport];

  sessions.forEach(sess => {
    if (!sess.visible || !sess.pts) return;
    const pts      = sess.pts;
    const speeds   = pts.map(p => p.speedKts);
    const minSpd   = Math.min(...speeds);
    const spdRange = (Math.max(...speeds) - minSpd) || 1;

    // Track polyline segments colored per point
    for (let i = 1; i < pts.length; i++) {
      L.polyline(
        [[pts[i-1].lat, pts[i-1].lon], [pts[i].lat, pts[i].lon]],
        { color: trackColor(pts[i], minSpd, spdRange), weight: 3, opacity: 0.85 }
      ).addTo(trackLayer);
    }

    renderArrows(pts, minSpd, spdRange);

    // Start / end markers
    if (pts.length) {
      addDot(pts[0].lat,                pts[0].lon,                '#22c55e', '🟢 Start');
      addDot(pts[pts.length-1].lat, pts[pts.length-1].lon, '#ef4444', '🔴 End');
    }

    // Maneuver dots (only for active session to avoid clutter)
    if (sess.id !== activeSessionId) return;
    (sess.maneuvers || []).forEach((m, idx) => {
      const isTack  = m.type === 'tack';
      const color   = isTack ? '#38bdf8' : '#fb923c';
      const label   = cfg.kiteMode
        ? `🔄 Transition #${idx+1}`
        : (isTack ? `🔵 Tack #${idx+1}` : `🟠 Gybe #${idx+1}`);

      let driftText = '?';
      if (m.transitionDistM != null) {
        const colorSpan = m.transitionDistM > 0 ? 'color:#ef4444' : 'color:#22c55e';
        driftText = `<span style="${colorSpan};font-weight:bold">${m.transitionDistM}m</span>`;
      }

      const tip = label
        + (m.time ? `<br>🕐 ${m.time.toLocaleTimeString()}` : '')
        + (cfg.kiteMode
          ? `<br>Duration: ${m.transitionSec ?? '?'}s · Drift: ${driftText}`
          : `<br>${m.speedBefore} kts → ${m.speedAfter} kts · Quality: ${m.quality ?? '?'}%`);

      addDot(m.lat, m.lon, color, tip, 6);
    });
  });
}

// ── Utilities for app.js ─────────────────────────────────────
export function fitMapToBounds(pts) {
  map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lon])), { padding: [30, 30] });
}

export function addRawPreview(rawPts, color) {
  L.polyline(rawPts.map(p => [p.lat, p.lon]),
    { color, weight: 2, opacity: 0.5 }).addTo(trackLayer);
}

export function setColorMode(mode) {
  colorMode = mode;
  document.getElementById('tgl-speed').classList.toggle('active', mode === 'speed');
  document.getElementById('tgl-pos').classList.toggle('active',   mode === 'pos');
  document.getElementById('leg-speed').style.display = mode === 'speed' ? 'flex' : 'none';
  document.getElementById('leg-pos').style.display   = mode === 'pos'   ? 'flex' : 'none';
  // caller passes state so we can re-render
}
