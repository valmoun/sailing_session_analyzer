# 🪁 Sailing Session Analyzer

A lightweight, high-performance, and **100% client-side** web application designed to analyze nautical GPS telemetry. Built specifically for boardsports and sailing, it translates raw GPX data into rich performance metrics, tactical wind physics, and map visualizations.

---

## ⚡ Key Features

* **Complete Privacy:** Zero server uploads. All processing happens entirely on the main thread inside your browser. It runs seamlessly offline via `file://`.
* **GDPR-Compliant Assets:** Map tiles are powered by CartoDB and OpenSeaMap. Typography is served via European-hosted, GAFAM-free Bunny Fonts.
* **Smart Window Averaging:** Computes noise-resistant peak speeds over consecutive sliding windows (10s, 30s, 1min) instead of relying on fragile single-point GPS peaks.
* **Wind Physics Engine:** Dynamically calculates True Wind Angle (TWA), Points of Sail distributions, and Velocity Made Good ($VMG$) relative to manually defined wind directions.
* **Maneuver Detection:** Automatically flags shifts in your tack side to isolate tacks, gybes, or kite transitions, logging transition drift and speed retention scores.

---

## 🎨 Sport Modes Supported

The analytics engine alters its physics thresholds and algorithms dynamically depending on your discipline:

| Sport | Emoji | Upwind Threshold | Downwind Threshold | Maneuver Target |
| --- | --- | --- | --- | --- |
| **Kitesurfing** | 🪁 | $60^\circ$ | $130^\circ$ | Unified Transitions |
| **Kitefoiling** | 🦅 | $46^\circ$ | $135^\circ$ | Unified Transitions |
| **Windsurfing** | 🏄 | $55^\circ$ | $130^\circ$ | Distinct Tacks/Gybes |
| **Yacht** | ⛵ | $45^\circ$ | $140^\circ$ | Distinct Tacks/Gybes |

---

## 🛠️ Architecture & Tech Stack

```
[ Raw GPX File ] ──> DOMParser (XML) ──> Physics Enrichment Engine ──> Leaflet Render (Canvas)
                                                  │
                                                  └──> Maneuver & Stats Aggregator

```

* **Frontend:** Vanilla HTML5, CSS3 Custom Properties (Design Tokens), and modern ES6+ JavaScript.
* **Map Engine:** Leaflet.js 1.9 rendering synchronously via SVG/Canvas layers for rapid performance.
* **Nautical Overlay:** Integrated **OpenSeaMap** tile selector to overlay navigation markers, buoys, and lights on top of CartoDB Voyager base maps.

---

## ⚙️ Mathematical Underpinnings

### Smooth Bearings

Traditional heading computations suffer from severe noise at slow speeds. This application mitigates boundary issues at $0^\circ/360^\circ$ by passing trigonometric unit components through a localized moving average before computing the arc-tangent:

$$\theta_{\text{smooth}} = \operatorname{atan2}\left(\overline{\sin\theta}, \overline{\cos\theta}\right)$$

### Velocity Made Good ($VMG$)

The app determines your efficiency directly toward or away from the wind source using the following formulas:

$$\text{VMG}_{\text{Upwind}} = \text{Speed} \times \cos(\text{TWA})$$

$$\text{VMG}_{\text{Downwind}} = \text{Speed} \times \cos(180^\circ - \text{TWA})$$

---

## 🚀 Getting Started

1. Save the code into an `index.html` file.
2. Double-click the file to open it in any modern browser.
3. Drag and drop up to 6 `.gpx` tracks into the drop zone.
4. Input the current wind origin angle (e.g., `270` for a West wind), choose your sport, and click **Analyse All Sessions**.
