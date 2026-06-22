import { SPORT_CONFIG } from './config.js';
import { haversineDistance, compassBearing, angleDiff, trueWindAngle, signedTWA,
         pointOfSail, vmgUpwind, vmgDownwind,
         movingAvg, circularMovingAvg, bestWindowAvgKts, MIN_DIST_M, MAX_SPEED_KTS, M_S_TO_KTS, M_PER_NM } from './geo.js';

export function enrichTrack(rawPts, windDir, sport) {
  const { upMax, dwnMin } = SPORT_CONFIG[sport];
  const pts = rawPts.map(p=>({...p}));

  // Pass 1: distance, bearing, raw speed
  pts.forEach((p,i) => {
    if (i===0) { p.distM=0; p.dtSec=0; p.speedRaw=0; p.bearing=0; return; }
    const prev = pts[i-1];
    p.distM = haversineDistance(prev, p);
    p.dtSec = (p.time&&prev.time) ? (p.time-prev.time)/1000 : 0;
    p.speedRaw = (p.speedGPS!=null&&p.speedGPS>=0)
      ? p.speedGPS
      : (p.dtSec>0.1 ? p.distM/p.dtSec : (prev.speedRaw||0));
    p.bearing = (p.distM>MIN_DIST_M) ? compassBearing(prev,p) : (prev.bearing||0);
  });

  // Pass 2: smooth speed + bearing (removes GPS noise spikes)
  const sSpd = movingAvg(pts.map(p=>p.speedRaw), 4);
  const sBrg = circularMovingAvg(pts.map(p=>p.bearing), 5);
  pts.forEach((p,i) => {
    p.speedMS       = Math.min(sSpd[i], MAX_SPEED_KTS/M_S_TO_KTS);
    p.speedKts      = p.speedMS * M_S_TO_KTS;
    p.bearingSmooth = sBrg[i];
  });

  // Pass 3: wind physics
  pts.forEach(p => {
    p.twa     = trueWindAngle(p.bearingSmooth, windDir);
    p.twaSign = signedTWA(p.bearingSmooth, windDir);
    p.pos     = pointOfSail(p.twa, upMax, dwnMin);
    p.vmgUp   = vmgUpwind(p.speedKts,   p.twa);
    p.vmgDown = vmgDownwind(p.speedKts, p.twa);
  });

  const dist = {upwind:0, reach:0, downwind:0};
  pts.forEach(p => dist[p.pos]++);
  console.table(dist);
  console.log(
    'TWA sample (every 20th pt):',
    pts.filter((_,i)=>i%20===0).map(p=>Math.round(p.twa))
  );

  return pts;
}


/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — MANEUVER DETECTION
   Watches for tack-side flips (sign change in twaSign).
   Each maneuver records BOTH quality metrics so the UI can choose:
     quality        → % speed kept (windsurf/yacht)
     transitionSec  → duration in seconds (kite)
     transitionDistM → distance drifted during the maneuver (kite)
═══════════════════════════════════════════════════════════════ */

const MIN_SPEED_KTS = 3;
const QUALITY_WIN   = 12;
const POST_SKIP     = 8;

export function detectManeuvers(pts, windDir) {
  const maneuvers = [];
  let prevSide = null;

  for (let i=3; i<pts.length-3; i++) {
    const p = pts[i];
    if (p.speedKts < MIN_SPEED_KTS) { prevSide=null; continue; }

    const side = p.twaSign >= 0 ? 'stbd' : 'port';
    if (prevSide !== null && side !== prevSide) {

      const slice  = pts.slice(Math.max(0,i-4), Math.min(pts.length,i+4));
      const avgTWA = slice.reduce((s,q)=>s+q.twa,0)/slice.length;
      const type   = avgTWA < 90 ? 'tack' : 'gybe';

      // Speed quality (sail sports)
      const before  = pts.slice(Math.max(0,i-QUALITY_WIN), i);
      const after   = pts.slice(i+1, Math.min(pts.length,i+1+QUALITY_WIN));
      const avgSpd  = arr => arr.length ? arr.reduce((s,q)=>s+q.speedKts,0)/arr.length : 0;
      const spBefore = avgSpd(before), spAfter = avgSpd(after);
      const quality  = spBefore > 1 ? Math.min(100,Math.round((spAfter/spBefore)*100)) : null;

      // Transition metrics (kite sports avec projection sur l'axe du vent)
      const bPt = pts[Math.max(0,i-POST_SKIP)];
      const aPt = pts[Math.min(pts.length-1,i+POST_SKIP)];
      const transitionSec = (bPt.time&&aPt.time) ? Math.round((aPt.time-bPt.time)/1000) : null;

      // 1. Distance brute entre l'entrée et la sortie
      const distRaw = haversineDistance(bPt, aPt);
      // 2. Cap du déplacement global pendant la transition
      const bearingGlobal = compassBearing(bPt, aPt);
      // 3. Récupération de la direction du vent courante
      // const wDir = parseFloat(document.getElementById('wind-dir').value) || 0;
      // 4. Angle du déplacement par rapport au vent (0 = face au vent, 180 = vent arrière)
      const twaGlobal = trueWindAngle(bearingGlobal, windDir);

      // 5. Projection : positif si on descend le vent (dérive), négatif si on remonte
      // On utilise -cos pour que : vers le vent = négatif (gain), sous le vent = positif (perte)
      const transitionDistM = Math.round(-distRaw * Math.cos(twaGlobal * Math.PI / 180));

      maneuvers.push({
        type, index:i, lat:p.lat, lon:p.lon, time:p.time,
        speedBefore:Math.round(spBefore*10)/10,
        speedAfter: Math.round(spAfter*10)/10,
        quality, transitionSec, transitionDistM,
      });

      i += POST_SKIP;
      prevSide = null;
      continue;
    }
    prevSide = side;
  }
  return maneuvers;
}


/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — STATISTICS ENGINE
   Aggregates enriched points + maneuvers → flat stats object.
═══════════════════════════════════════════════════════════════ */

const MOVING_KTS = 2.5;

export function computeStats(pts, maneuvers) {
  const movPts = pts.filter(p=>p.speedKts>MOVING_KTS);
  const speeds = movPts.map(p=>p.speedKts);

  const topSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? speeds.reduce((a,b)=>a+b,0)/speeds.length : 0;

  const best10s = bestWindowAvgKts(movPts, 10);
  const best30s = bestWindowAvgKts(movPts, 30);
  const best60s = bestWindowAvgKts(movPts, 60);

  const totalNM = pts.reduce((s,p)=>s+(p.distM||0),0) / M_PER_NM;
  const timed   = pts.filter(p=>p.time);
  const durSec  = timed.length>=2 ? (timed[timed.length-1].time-timed[0].time)/1000 : 0;

  const counts = { upwind:0, reach:0, downwind:0 };
  movPts.forEach(p=>counts[p.pos]++);
  const N = movPts.length||1;
  const sailPct = {
    upwind:  Math.round(counts.upwind  /N*100),
    reach:   Math.round(counts.reach   /N*100),
    downwind:Math.round(counts.downwind/N*100),
  };

  const upPts  = movPts.filter(p=>p.pos==='upwind');
  const dwnPts = movPts.filter(p=>p.pos==='downwind');
  const bestVMGUp   = upPts.length  ? Math.max(...upPts.map(p=>p.vmgUp))    : 0;
  const bestVMGDown = dwnPts.length ? Math.max(...dwnPts.map(p=>p.vmgDown)) : 0;
  const bestUpAngle  = upPts.length  ? Math.round(upPts.reduce((a,b)=>a.vmgUp>b.vmgUp?a:b).twa)     : null;
  const bestDwnAngle = dwnPts.length ? Math.round(dwnPts.reduce((a,b)=>a.vmgDown>b.vmgDown?a:b).twa) : null;

  const tacks = maneuvers.filter(m=>m.type==='tack');
  const gybes = maneuvers.filter(m=>m.type==='gybe');
  const mean  = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
  const avgTackQ     = mean(tacks.map(t=>t.quality).filter(q=>q!=null));
  const avgGybeQ     = mean(gybes.map(g=>g.quality).filter(q=>q!=null));
  const avgTransSec  = mean(maneuvers.map(m=>m.transitionSec).filter(v=>v!=null));
  const avgTransDst  = mean(maneuvers.map(m=>m.transitionDistM));

  return {
    topSpeed:    Math.round(topSpeed*10)/10,
    avgSpeed:    Math.round(avgSpeed*10)/10,
    best10s, best30s, best60s,
    totalNM:     Math.round(totalNM*10)/10,
    durSec, sailPct,
    bestVMGUp:   Math.round(bestVMGUp*10)/10,
    bestVMGDown: Math.round(bestVMGDown*10)/10,
    bestUpAngle, bestDwnAngle,
    tackCount:tacks.length, gybeCount:gybes.length,
    transCount:maneuvers.length,
    avgTackQ, avgGybeQ, avgTransSec, avgTransDst,
  };
}