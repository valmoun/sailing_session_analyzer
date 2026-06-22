import { state, addSession, removeSession,
         toggleSessionVis, setActiveSession,
         getActiveSession }             from './state.js';
import { SPORT_CONFIG }                 from './config.js';
import { parseGPX }                     from './gpx.js';
import { enrichTrack, detectManeuvers,
         computeStats }                 from './analysis.js';
import { renderSessionList, updateUI, 
         updateCompass, updateColorModeUI } from './ui.js';
import { renderAllSessions,
         fitMapToBounds, addRawPreview,
         setColorMode }                 from './map.js';

// Analysis pipeline
export function runAnalysis() {
  if (!state.sessions.length) return;
  document.getElementById('loading').style.display = 'flex';

  requestAnimationFrame(() => setTimeout(() => {
    try {
      state.sessions.forEach(sess => {
        if (!sess.rawPoints) return;
        sess.pts       = enrichTrack(sess.rawPoints);
        sess.maneuvers = detectManeuvers(sess.pts);
        sess.stats     = computeStats(sess.pts, sess.maneuvers);
      });

      renderAllSessions(state);
      const act = getActiveSession();
      if (act?.stats) updateUI(act.stats, act.maneuvers, state.currentSport);

      const allPts = state.sessions.flatMap(s => s.visible && s.pts ? s.pts : []);
      if (allPts.length) fitMapToBounds(allPts);
    } catch (err) {
      alert('Analysis error: ' + err.message);
      console.error('[Sailing Analyzer]', err);
    } finally {
      document.getElementById('loading').style.display = 'none';
    }
  }, 30));
}

// File loading
function loadGPXFile(file) {
  const reader = new FileReader();
  reader.onerror = () => alert('Could not read: ' + file.name);
  reader.onload  = e => {
    try {
      const rawPts = parseGPX(e.target.result);
      const sess   = addSession(file.name, rawPts);
      if (!sess) { alert('Maximum 6 sessions reached.'); return; }

      renderSessionList(state.sessions, state.activeSessionId);
      document.getElementById('analyze-btn').disabled = false;
      addRawPreview(rawPts, sess.color);
      fitMapToBounds(rawPts);
    } catch (err) {
      alert(`Could not load ${file.name}: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// ── Event wiring ─────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', e => {
  [...e.target.files].forEach(loadGPXFile);
  e.target.value = '';
});

const dz = document.getElementById('drop-zone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', ()  => dz.classList.remove('over'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('over');
  const gpxFiles = [...e.dataTransfer.files].filter(f => /\.(gpx|xml)$/i.test(f.name));
  if (!gpxFiles.length) { alert('Please drop .gpx files.'); return; }
  gpxFiles.forEach(loadGPXFile);
});

document.getElementById('analyze-btn')
  .addEventListener('click', runAnalysis);

document.getElementById('wind-dir').addEventListener('input', e => {
  state.windDir = Number(e.target.value) || 0;
  updateCompass(state.windDir);           // UI-only, instant feedback
  if (state.sessions.some(s => s.rawPoints)) runAnalysis();
});

document.getElementById('wind-speed').addEventListener('change', e => {
  state.windSpeed = Number(e.target.value) || 0;
  if (state.sessions.some(s => s.rawPoints)) runAnalysis();
});

document.querySelectorAll('.sport-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sport-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentSport = btn.dataset.sport;
    const cfg = SPORT_CONFIG[state.currentSport];
    document.getElementById('app-title').textContent = `${cfg.emoji} ${cfg.label} Analyzer`;
    if (state.sessions.some(s => s.rawPoints)) runAnalysis();
  });
});

// Color mode toggles
document.getElementById('tgl-speed').addEventListener('click', () => {
  setColorMode('speed');
  updateColorModeUI('speed');
});
document.getElementById('tgl-pos').addEventListener('click', () => {
  setColorMode('pos');
  updateColorModeUI('pos');
});

// Session list interactions — delegated to avoid re-binding on each render
document.getElementById('session-list').addEventListener('click', e => {
  const item = e.target.closest('.sess-item');
  if (!item) return;
  const id = Number(item.dataset.id);

  if (e.target.matches('.sess-btn[title="Remove"]')) {
    removeSession(id);
  } else if (e.target.matches('.sess-btn')) {
    toggleSessionVis(id);
  } else {
    setActiveSession(id);
    const act = getActiveSession();
    if (act?.stats) updateUI(act.stats, act.maneuvers, state.currentSport);
  }

  renderSessionList(state.sessions, state.activeSessionId);
  renderAllSessions(state);
});

// ── Init ─────────────────────────────────────────────────────
state.windDir = Number(document.getElementById('wind-dir').value) || 0;
updateCompass(state.windDir);
