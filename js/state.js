import { PALETTE } from './config.js';

// Single source of truth
export const state = {
  sessions: [],
  activeSessionId: null,
  sessionIdCounter: 0,
  windDir: 0,
  windSpeed: 0,
  currentSport: 'kitesurfing',
};

export function getActiveSession() {
  return state.sessions.find(s => s.id === state.activeSessionId) ?? null;
}

export function addSession(name, rawPts) {
  if (state.sessions.length >= 6) return null;
  const id    = state.sessionIdCounter++;
  const color = PALETTE[state.sessions.length % PALETTE.length];
  const sess  = { id, name, color, rawPoints: rawPts,
                  pts: null, maneuvers: null, stats: null, visible: true };
  state.sessions.push(sess);
  state.activeSessionId = id;
  return sess;
}

export function removeSession(id) {
  const idx = state.sessions.findIndex(s => s.id === id);
  if (idx < 0) return;
  state.sessions.splice(idx, 1);
  if (state.activeSessionId === id) {
    state.activeSessionId = state.sessions.length
      ? state.sessions[state.sessions.length - 1].id
      : null;
  }
}

export function toggleSessionVis(id) {
  const s = state.sessions.find(s => s.id === id);
  if (s) s.visible = !s.visible;
}

export function setActiveSession(id) {
  state.activeSessionId = id;

}