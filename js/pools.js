/**
 * pools.js — Costruzione pool per rarita
 * Costruisce POOL (base cards), ALT_MAP (liste di alt art)
 * e pool estraibili per rarita, incluse le alternate senza base nel set.
 */
import { S } from './state.js';

/**
 * Costruisce i pool dal DB corrente.
 * Popola S.POOL, S.ALT_MAP, S.pools.
 */
export function buildPools() {
  // out_of_set è determinato al momento dell'import (admin.js → markOutOfSet)
  // e può essere sovrascritto manualmente nel DB. Non ricalcolare a runtime.

  S.POOL = [];
  S.ALT_MAP = {};
  const seen = new Set();

  S.DB.forEach(c => {
    if (c.outOfSet) return;
    const k = c.num + '|' + c.rarity;

    if (!c.isAlt) {
      if (!seen.has(k)) {
        seen.add(k);
        S.POOL.push(c);
      }
    } else {
      if (!S.ALT_MAP[k]) S.ALT_MAP[k] = [];
      S.ALT_MAP[k].push(c);
    }
  });

  const standaloneAlts = Object.entries(S.ALT_MAP)
    .filter(([k]) => !seen.has(k))
    .flatMap(([, cards]) => cards);
  const candidates = [...S.POOL, ...standaloneAlts];
  function byR(r) { return candidates.filter(c => c.rarity === r); }
  S.pools = {
    L: byR('L'),
    SR: byR('SR'),
    R: byR('R'),
    C: byR('C'),
    UC: byR('UC'),
    SP: byR('SP'),
    SEC: byR('SEC')
  };
}

/**
 * Include tutte le carte del gruppo importato, comprese le ristampe
 * con numero appartenente ad altri set. Usato dallo script admin.
 * @param {Array} cards - Carte normalizzate
 * @returns {Array} Stesse carte con campo outOfSet aggiornato
 */
export function markOutOfSet(cards) {
  cards.forEach(c => {
    c.outOfSet = false;
  });
  return cards;
}
