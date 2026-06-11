/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — GEOGRAPHIC UTILITIES
   Pure math — no side effects.
═══════════════════════════════════════════════════════════════ */

const EARTH_R_M     = 6_371_000;
const M_S_TO_KTS    = 1.94384;
const M_PER_NM      = 1852;
const MIN_DIST_M    = 1.5;
const MAX_SPEED_KTS = 65;

function haversineDistance(p1, p2) {
  const r = d => d * Math.PI / 180;
  const dLat = r(p2.lat-p1.lat), dLon = r(p2.lon-p1.lon);
  const a = Math.sin(dLat/2)**2 + Math.cos(r(p1.lat))*Math.cos(r(p2.lat))*Math.sin(dLon/2)**2;
  return EARTH_R_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function compassBearing(p1, p2) {
  const r = d => d*Math.PI/180;
  const dLon = r(p2.lon-p1.lon), la1=r(p1.lat), la2=r(p2.lat);
  return (Math.atan2(Math.sin(dLon)*Math.cos(la2),
          Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLon))*180/Math.PI+360)%360;
}

// Smallest signed angle from a to b, in (-180, 180]
function angleDiff(a, b) {
  let d = (b-a+360)%360;
  return d > 180 ? d-360 : d;
}