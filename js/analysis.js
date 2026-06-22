import { SPORT_CONFIG } from './config.js';
import { state } from './state.js';
import { haversineDistance, compassBearing, angleDiff, trueWindAngle, signedTWA,
         pointOfSail, vmgUpwind, vmgDownwind,
         movingAvg, circularMovingAvg, bestWindowAvgKts, MIN_DIST_M, MAX_SPEED_KTS, M_S_TO_KTS, M_PER_NM } from './geo.js';

// Constants for analysis
// Speed threshold for movement detection (to ignore GPS noise when stationary)
const MIN_SPEED_KTS = 3;
// Window size for speed quality calculation around maneuvers (in points)
const QUALITY_WIN   = 12;
// Number of points to skip after a maneuver to avoid counting the maneuver itself in transition metrics
const POST_SKIP     = 8;
// Consider removing, redundancy with MIN_SPEED_KTS, but can be useful to have a separate threshold for maneuver detection vs general movement analysis
const MOVING_KTS = 2.5;
const MAX_UPWIND_TRANSITION_M = 10; // Maximum distance gain considered for upwind transitions (for quality scoring)
const MAX_DOWNWIND_TRANSITION_M = 40; // Maximum distance loss considered for downwind transitions (for quality scoring)

// Enriches a track with additional computed properties
export function enrichTrack(rawPts) {
  const { upMax, dwnMin } = SPORT_CONFIG[state.currentSport];
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
    p.twa     = trueWindAngle(p.bearingSmooth, state.windDir);
    p.twaSign = signedTWA(p.bearingSmooth, state.windDir);
    p.pos     = pointOfSail(p.twa, upMax, dwnMin);
    p.vmgUp   = vmgUpwind(p.speedKts,   p.twa);
    p.vmgDown = vmgDownwind(p.speedKts, p.twa);
  });

  // Log des points pour debug les angles upwind/reach/downwind
  /*
  const dist = {upwind:0, reach:0, downwind:0};
  pts.forEach(p => dist[p.pos]++);
  console.table(dist);
  console.log(
    'TWA sample (every 20th pt):',
    pts.filter((_,i)=>i%20===0).map(p=>Math.round(p.twa))
  );
  */
  return pts;
}

// Detection and analysis of maneuvers (tacks and gybes)
export function detectManeuvers(pts) {
  const maneuvers = [];
  let prevSide = null;
  let side = null;
  let quality = null;

  for (let i=3; i<pts.length-3; i++) {
    const p = pts[i];

    // Ignore low-speed points for maneuver detection
    if (p.speedKts > MIN_SPEED_KTS) {
          const side = p.twaSign >= 0 ? 'stbd' : 'port';
    }

    // Detect a change of direction (tack/gybe)
    if (prevSide !== null && side !== prevSide) {
      // Look at reduced window of points around the maneuver
      const slice  = pts.slice(Math.max(0,i-4), Math.min(pts.length,i+4));
      // Calculation of average angle of maneuver
      const avgTWA = slice.reduce((s,q)=>s+q.twa,0)/slice.length;
      // Detection of type: tack if average TWA < 90°, gybe if average TWA > 90°
      const type   = avgTWA < 90 ? 'tack' : 'gybe';

      /*---------Speed quality (sail sports)---------*/
      const before  = pts.slice(Math.max(0,i-QUALITY_WIN), i);
      const after   = pts.slice(i+1, Math.min(pts.length,i+1+QUALITY_WIN));
      const avgSpd  = arr => arr.length ? arr.reduce((s,q)=>s+q.speedKts,0)/arr.length : 0;
      const spBefore = avgSpd(before), spAfter = avgSpd(after);
      //const quality  = spBefore > 1 ? Math.min(100,Math.round((spAfter/spBefore)*100)) : null;
      const spdRatio = spBefore > 1 ? (spAfter-spBefore)/spBefore*100 : null;

      /*---------Transition duration---------
      const entryPt = pts[Math.max(0,i-POST_SKIP)];
      const exitPt = pts[Math.min(pts.length-1,i+POST_SKIP)];
      const transitionSec = (entryPt.time&&exitPt.time) ? Math.round((exitPt.time-entryPt.time)/1000) : null;*/

      /*---------Lost/won distance along the wind axis---------*/
      // Earlier point before maneuver, because maneuver detection takes a few points to confirm the change of direction
      const entryPt = pts[Math.max(0,i-2*POST_SKIP)];
      const exitPt = pts[Math.min(pts.length-1,i+POST_SKIP)];
      // Raw distance between the two points, in meters
      const distRaw = haversineDistance(entryPt, exitPt);
      // Rough bearing between entry and exit points of the maneuver, in degrees
      const bearingGlobal = compassBearing(entryPt, exitPt);
      // True wind angle of the "maneuver", in degrees
      // const angleToWind = trueWindAngle(bearingGlobal, state.windDir);
      // Wind-relative angle between the maneuver and the wind direction, in degrees
      const angleToWind = angleDiff(state.windDir, bearingGlobal);
      // Distance along the wind axis, in meters (negative if lost distance, positive if gained)
      // const transitionDistM = Math.round(-distRaw * Math.cos(angleToWind * Math.PI / 180));
      const transitionDistM = Math.round(
        -distRaw * Math.cos(angleToWind * Math.PI / 180)
      );

      /*---------Calculate "quality score"---------*/
      if (state.currentSport === 'kitesurfing') {
        // Scale from 10m gain to 40m loss, with 0% at -40m and 100% at +10m
        const score = Math.round(100 * (MAX_UPWIND_TRANSITION_M - transitionDistM) / (MAX_UPWIND_TRANSITION_M + MAX_DOWNWIND_TRANSITION_M));
        quality = Math.max(0, Math.min(100, score));
      }
      else {
        // For sail sports, quality is based on speed ratio
        quality = spBefore > 1 ? Math.max(0, Math.min(100, Math.round((spAfter / spBefore) * 100))): null;
      }

      maneuvers.push({
        type, index:i, lat:p.lat, lon:p.lon, time:p.time,
        speedBefore:Math.round(spBefore*10)/10,
        speedAfter: Math.round(spAfter*10)/10,
        quality,
        speedRatio: Math.round(spdRatio),
        //transitionSec,
        transitionDistM,
      });

      i += POST_SKIP;
      prevSide = null;
      continue;
    }
    prevSide = side;
  }
  return maneuvers;
}

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