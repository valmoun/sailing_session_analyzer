// Main analysis pipeline — runs on all sessions
function runAnalysis() {
  if (!sessions.length) return;
  const windDir = parseFloat(document.getElementById('wind-dir').value)||0;
  document.getElementById('loading').style.display = 'flex';

  requestAnimationFrame(()=>setTimeout(()=>{
    try {
      sessions.forEach(sess => {
        if (!sess.rawPoints) return;
        sess.pts       = enrichTrack(sess.rawPoints, windDir, currentSport);
        sess.maneuvers = detectManeuvers(sess.pts);
        sess.stats     = computeStats(sess.pts, sess.maneuvers);
      });
      renderAllSessions();
      const act = getActiveSession();
      if (act?.stats) updateUI(act.stats, act.maneuvers);
      const allPts = sessions.flatMap(s=>s.visible&&s.pts?s.pts:[]);
      if (allPts.length) map.fitBounds(L.latLngBounds(allPts.map(p=>[p.lat,p.lon])),{padding:[30,30]});
    } catch(err) {
      alert('Analysis error: '+err.message);
      console.error('[Sailing Analyzer]',err);
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  }, 30));
}

// File loading
function loadGPXFile(file) {
  const reader = new FileReader();
  reader.onerror = ()=>alert('Could not read: '+file.name);
  reader.onload = e => {
    try {
      const rawPts = parseGPX(e.target.result);
      const sess   = addSession(file.name, rawPts);
      if (!sess) return;
      document.getElementById('analyze-btn').disabled = false;
      // Quick preview before analysis
      L.polyline(rawPts.map(p=>[p.lat,p.lon]),{color:sess.color,weight:2,opacity:0.5}).addTo(trackLayer);
      map.fitBounds(L.latLngBounds(rawPts.map(p=>[p.lat,p.lon])),{padding:[30,30]});
    } catch(err) { alert(`Could not load ${file.name}: ${err.message}`); }
  };
  reader.readAsText(file);
}

// Event listeners
document.getElementById('file-input').addEventListener('change', e=>{
  [...e.target.files].forEach(loadGPXFile);
  e.target.value='';
});

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',  e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave', ()=>dz.classList.remove('over'));
dz.addEventListener('drop', e=>{
  e.preventDefault(); dz.classList.remove('over');
  const gpxFiles = [...e.dataTransfer.files].filter(f=>/\.(gpx|xml)$/i.test(f.name));
  if (!gpxFiles.length) { alert('Please drop .gpx files.'); return; }
  gpxFiles.forEach(loadGPXFile);
});

document.getElementById('analyze-btn').addEventListener('click', runAnalysis);

['wind-dir','wind-speed'].forEach(id=>{
  document.getElementById(id).addEventListener('change',()=>{
    if (sessions.some(s=>s.rawPoints)) runAnalysis();
  });
});