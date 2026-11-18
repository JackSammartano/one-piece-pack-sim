/**
 * state.js — Stato globale condiviso
 * Oggetto singolo S importato da tutti i moduli.
 * Mutazioni visibili ovunque tramite riferimento condiviso.
 */
export const S = {
  // Dati set corrente
  DB: [],
  POOL: [],
  ALT_MAP: {},
  pools: {},
  setCode: '',
  setName: '',

  // Sessione simulazione
  sessionStats: { packs: 0, cards: 0, sr: 0, secSp: 0, hits: 0 },
  lastPulled: [],

  // Preferiti
  favs: {},

  // UI
  modalCard: null,

  // Auth (Supabase)
  session: null,
  profile: null
};
