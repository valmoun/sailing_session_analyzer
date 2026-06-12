export const SPORT_CONFIG = {
  // Twin-tip/Wave: Upwind is harder (~60°). Downwind requires crossing at angles (~140°).
  kitesurfing: { label:'Kitesurfing', emoji:'🪁', upMax:60,  dwnMin:130, kiteMode:true,  manLabel:'Transitions', speedMax:35 },
  
  // Kitefoil: Elite hydrofoils point insanely high (~42°) and push ultra deep downwind (~140°).
  kitefoiling: { label:'Kitefoiling', emoji:'🦅', upMax:46,  dwnMin:135, kiteMode:true,  manLabel:'Transitions', speedMax:48 },
  
  // Windsurfing (Slalom/Freeride): Can't pinch high upwind (~58°). Broad reaches deeply downwind (~135°).
  windsurfing: { label:'Windsurfing', emoji:'🏄', upMax:55,  dwnMin:130, kiteMode:false, manLabel:'Tacks & Gybes', speedMax:45 },
  
  // Yacht (Performance Monohull): Upwind targets are tight (~43°). Downwind asymmetric angles hover around 142°.
  yacht:       { label:'Yacht',       emoji:'⛵', upMax:45,  dwnMin:140, kiteMode:false, manLabel:'Tacks & Gybes', speedMax:15 },
};

const PALETTE = ['#00c4ff','#fb923c','#a78bfa','#22c55e','#f472b6','#facc15'];
