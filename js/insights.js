/* ═══════════════════════════════════════════════════════════════
   SECTION 8 — COACHING INSIGHTS (sport-aware)
═══════════════════════════════════════════════════════════════ */
import { SPORT_CONFIG } from './config.js';

export function generateInsights(stats, sport) {
  const cfg  = SPORT_CONFIG[sport];
  const tips = [];
  const { topSpeed, avgSpeed, sailPct, bestUpAngle, bestDwnAngle,
          avgTackQ, avgGybeQ, avgTransSec, avgTransDst } = stats;

  // Speed
  if (topSpeed > cfg.speedMax*0.85)
    tips.push({level:'good',text:`🚀 Top speed ${topSpeed} kts — excellent power generation for ${cfg.label}!`});
  else if (topSpeed>0 && topSpeed<cfg.speedMax*0.4)
    tips.push({level:'warn',text:`🌬️ Top speed ${topSpeed} kts is low. Check equipment size vs wind conditions.`});

  if (avgSpeed>0 && topSpeed>0) {
    const r = avgSpeed/topSpeed;
    if (r>=0.65)  tips.push({level:'good',text:`🎯 Speed consistency: avg is ${Math.round(r*100)}% of top. Great session control.`});
    else if (r<0.42) tips.push({level:'info',text:`📉 Large gap avg (${avgSpeed}) vs top (${topSpeed} kts). Work on sustaining power.`});
  }

  // Angles
  if (bestUpAngle!==null) {
    if      (bestUpAngle<38) tips.push({level:'good',text:`⬆️ Upwind angle ${bestUpAngle}° — exceptional close-hauled pointing!`});
    else if (bestUpAngle<52) tips.push({level:'good',text:`⬆️ Upwind angle ${bestUpAngle}° is solid. Try depowering to point higher.`});
    else                     tips.push({level:'info',text:`⬆️ Upwind angle ${bestUpAngle}° is wide. Ease bar/sheet and rake back more.`});
  }
  if (bestDwnAngle!==null) {
    if (bestDwnAngle>155)    tips.push({level:'warn',text:`⬇️ Running very deep (${bestDwnAngle}°). ${cfg.kiteMode?'Kites':'Sails'} stall near dead downwind — gybe earlier for VMG.`});
    else if (bestDwnAngle<120) tips.push({level:'info',text:`⬇️ Downwind angle ${bestDwnAngle}° — try going deeper for better VMG.`});
    else                     tips.push({level:'good',text:`⬇️ Downwind angle ${bestDwnAngle}° — good VMG corridor.`});
  }

  // Maneuvers
  if (cfg.kiteMode) {
    if (avgTransSec!==null) {
      if      (avgTransSec<=3) tips.push({level:'good',text:`🔄 Avg transition ${avgTransSec} s — lightning fast!`});
      else if (avgTransSec<=6) tips.push({level:'info',text:`🔄 Avg transition ${avgTransSec} s. Tighten the kite arc through the window.`});
      else                     tips.push({level:'warn',text:`🔄 Avg transition ${avgTransSec} s is slow. Practice faster kite movements.`});
    }
    if (avgTransDst!==null && avgTransDst>30)
      tips.push({level:'info',text:`📐 Avg drift ${avgTransDst} m during transitions — work on tighter loops.`});
  } else {
    if (avgTackQ!==null) {
      if      (avgTackQ>=75) tips.push({level:'good',text:`🔵 Tack quality ${avgTackQ}% — great speed retention through tacks.`});
      else if (avgTackQ>=55) tips.push({level:'info',text:`🔵 Tack quality ${avgTackQ}% — focus on faster rig flip and weight shift.`});
      else                   tips.push({level:'warn',text:`🔵 Tack quality ${avgTackQ}% — significant loss. Stay powered longer before flipping.`});
    }
    if (avgGybeQ!==null) {
      if      (avgGybeQ>=80) tips.push({level:'good',text:`🟠 Gybe quality ${avgGybeQ}% — smooth, powerful gybes!`});
      else if (avgGybeQ>=60) tips.push({level:'info',text:`🟠 Gybe quality ${avgGybeQ}% — carve earlier and commit harder.`});
      else                   tips.push({level:'warn',text:`🟠 Gybe quality ${avgGybeQ}% — losing too much speed. Loop the boom/kite earlier.`});
    }
  }

  if (sailPct.upwind<15 && stats.transCount>=2)
    tips.push({level:'info',text:`📐 Only ${sailPct.upwind}% upwind time. Practise VMG beats to sharpen upwind technique.`});

  if (!tips.length)
    tips.push({level:'info',text:'📋 Set wind direction and click Analyse to see personalised tips.'});

  return tips;
}