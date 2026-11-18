/**
 * pools.js — Costruzione pool per rarita
 * Determina il prefisso dominante del set, marca carte outOfSet,
 * costruisce POOL (base cards) e ALT_MAP (alt art).
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
      if (!S.ALT_MAP[k]) S.ALT_MAP[k] = c;
    }
  });

  function byR(r) { return S.POOL.filter(c => c.rarity === r); }
  S.pools = {
    L: byR('L'),
    SR: byR('SR'),
    R: byR('R'),
    C: byR('C'),
    SP: byR('SP'),
    SEC: byR('SEC')
  };
}

/**
 * Marca le carte con prefisso diverso dal dominante come outOfSet.
 * Usato dallo script admin per l'import.
 * @param {Array} cards - Carte normalizzate
 * @returns {Array} Stesse carte con campo out_of_set aggiornato
 */
export function markOutOfSet(cards) {
  const prefixCount = {};
  cards.forEach(c => {
    const p = (c.num || '').split('-')[0];
    if (p) prefixCount[p] = (prefixCount[p] || 0) + 1;
  });
  const mainPrefix = Object.entries(prefixCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  cards.forEach(c => {
    c.out_of_set = !!(mainPrefix && !(c.num || '').startsWith(mainPrefix));
  });
  return cards;
}
