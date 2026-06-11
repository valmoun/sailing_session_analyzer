/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — GPX PARSER
   Reads a GPX XML string → array of raw track points.
   { lat, lon, time, ele, speedGPS }   speedGPS in m/s or null.
═══════════════════════════════════════════════════════════════ */

function parseGPX(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('Invalid XML — not a valid GPX file.');
  const trkpts = xml.querySelectorAll('trkpt');
  if (!trkpts.length) throw new Error('No <trkpt> elements — is this a track file?');

  const pts = [];
  trkpts.forEach(pt => {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    if (isNaN(lat) || isNaN(lon)) return;
    const timeEl  = pt.querySelector('time');
    const eleEl   = pt.querySelector('ele');
    const speedEl = pt.querySelector('speed') || pt.querySelector('gpxtpx\\:speed') || pt.querySelector('ns3\\:speed');
    pts.push({
      lat, lon,
      time:     timeEl  ? new Date(timeEl.textContent.trim()) : null,
      ele:      eleEl   ? parseFloat(eleEl.textContent)       : null,
      speedGPS: speedEl ? parseFloat(speedEl.textContent)     : null,
    });
  });
  if (pts.length < 2) throw new Error('Need at least 2 valid track points.');
  return pts;
}