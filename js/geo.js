/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — GEOGRAPHIC and PHYSICS UTILITIES
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

// 0° = dead upwind, 90° = beam reach, 180° = dead downwind
function trueWindAngle(heading, windDir)  { return Math.abs(angleDiff(heading, windDir)); }
// Positive = wind from starboard (right side)
function signedTWA(heading, windDir)      { return angleDiff(heading, windDir); }

function pointOfSail(twa, upMax, dwnMin) {
  if (twa < upMax)  return 'upwind';
  if (twa < dwnMin) return 'reach';
  return 'downwind';
}

function vmgUpwind(spd, twa)   { return spd * Math.cos(twa*Math.PI/180); }
function vmgDownwind(spd, twa) { return spd * Math.cos((180-twa)*Math.PI/180); }

function movingAvg(arr, half) {
  return arr.map((_,i) => {
    const lo=Math.max(0,i-half), hi=Math.min(arr.length-1,i+half);
    let s=0; for(let j=lo;j<=hi;j++) s+=arr[j]; return s/(hi-lo+1);
  });
}

// Circular moving average for bearings: averages via unit vectors
// to correctly handle the 0°/360° wraparound.
function circularMovingAvg(bearings, half) {
  const r = d => d*Math.PI/180;
  const sinA = movingAvg(bearings.map(b=>Math.sin(r(b))), half);
  const cosA = movingAvg(bearings.map(b=>Math.cos(r(b))), half);
  return bearings.map((_,i)=>(Math.atan2(sinA[i],cosA[i])*180/Math.PI+360)%360);
}

/*
  BEST WINDOW AVERAGE — two-pointer sliding window, O(n).
  Finds the highest mean speed over any consecutive Xs of data.
  More meaningful than a single-point top speed (which can be
  a GPS glitch). Speed-sailing competitions use the 500m / 10s formats.
*/
function bestWindowAvgKts(pts, windowSec) {
  if (!pts[0]?.time) return null;
  let best=0, lo=0, runSum=0;
  for (let hi=0; hi<pts.length; hi++) {
    runSum += pts[hi].speedKts;
    while ((pts[hi].time - pts[lo].time)/1000 > windowSec) { runSum -= pts[lo].speedKts; lo++; }
    best = Math.max(best, runSum/(hi-lo+1));
  }
  return best > 0 ? Math.round(best*10)/10 : null;
}