# Sailing Session Analyzer

A browser-based tool for analysing sailing and board-sport GPX tracks. No data leaves your device — everything runs locally in the browser.

---

## Supported Sport Modes

| Sport | Upwind TWA | Downwind TWA | Maneuvers |
|---|---|---|---|
| Kitesurfing | < 87° | > 100° | Transitions (drift / air-time) |
| Kitefoiling | < 46° | > 135° | Transitions (drift / air-time) |
| Windsurfing | < 45° | > 140° | Tacks & Gybes (speed quality) |
| Yacht | < 45° | > 140° | Tacks & Gybes (speed quality) |

*Upwind TWA and Downwind TWA are the angles that bound the reaching zone. Tack/gybe classification uses the mean TWA of the maneuver (≤ 90° = tack, > 90° = gybe).*

---

## Features

**Privacy first** — All processing is done in-browser. No server, no uploads, no tracking.

**Wind physics engine** — Provide the wind direction (degrees, from which the wind blows) and speed (knots) in the sidebar. The app derives True Wind Angle (TWA), point of sail (upwind / reach / downwind), and VMG for every track point.

**Sliding-window peak speeds** — The best average over 10 s, 30 s, and 60 s is computed across all moving points and shown in the stats panel.

**Maneuver detection** — Each time the boat or board flips from one side of the wind to the other (sign change in TWA sign), a maneuver is recorded. Sail sports (windsurfing, yacht) report the speed quality ratio before/after. Kite sports (kitesurfing, kitefoiling) report the transition duration in seconds and the distance drifted during the jump.

**Coaching insights** — Sport-aware tips are generated from the session statistics (speed, angles, maneuver quality).

**Map coloring** — Track segments are colored by speed or by point of sail, selectable via the toggle at the top of the stats panel.

---

## Technical Notes

### Bearing smoothing

Track bearings are smoothed with a circular moving average to prevent discontinuities at 0°/360°.

```js
circularMovingAvg(bearings, halfWindow)
```

### VMG calculations

```
VMG_upwind   = speed × cos(TWA)
VMG_downwind = speed × cos(180° − TWA)
```

VMG_upwind is positive when sailing toward the wind; VMG_downwind is positive when sailing away.

---

## Getting Started

1. Save all files (`index.html`, `js/*.js`, `css/*.css`) into one folder.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge).
3. Drag-and-drop one or more GPX files onto the drop zone, or click it to select files.
4. Set your **sport mode** using the tab bar.
5. Enter the **wind direction** (from °) and **wind speed** (knots) in the Wind Conditions panel.
6. Click **Analyse All**.

---

## Architecture

```
gpx.js       — GPX XML parsing: extracts time, lat, lon, ele, GPS speed
geo.js       — Haversine distance, compass bearing, TWA, point-of-sail classification,
               circular bearing smoothing, sliding-window best-average
analysis.js  — Track enrichment pipeline, maneuver detection, statistics aggregation
insights.js  — Sport-aware coaching tip generation
state.js     — Client-side session registry, active session, wind/sport state
ui.js        — DOM updates, stat card rendering, insight rendering
app.js       — Event wiring, analysis orchestration, map rendering
map.js       — Leaflet map, session polylines, color mode, map bounds
config.js    — Sport thresholds, speed limits, palette
```

The app uses **Leaflet** for the map, **SunCalc** for solar metadata, and **Bunny Fonts** for typography. No build step, no dependencies to install.

---

## Data Flow

```
GPX file
  └─► parseGPX()          → raw track points [time, lat, lon, ele, speedGPS]
       └─► enrichTrack()  → enriched points [dist, bearing, bearingSmooth,
       │                     speedKts, twa, twaSign, pos, vmgUp, vmgDown]
       │       ├─► detectManeuvers() → [type, speedBefore, speedAfter,
       │       │                       quality/transitionSec, transitionDistM]
       │       └─► computeStats()   → session statistics object
       └─► renderSession() → coloured polylines on the map
```