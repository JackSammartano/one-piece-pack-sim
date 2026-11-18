/**
 * pools.js — Costruzione pool per rarita
 * Costruisce POOL (base cards), ALT_MAP (liste di alt art)
 * e pool estraibili per rarita, incluse le alternate senza base nel set.
 */
import { S } from './state.js';

/** Categoria di hit, distinta dalla rarita stampata sulla carta. */
export function getHitType(card) {
  const name = card.name || '';
  if (/\bmanga\b/i.test(name)) return 'MANGA';
  if (card.rarity === 'TR' || /\bTR\b|\btreasure rare\b/i.test(name)) return 'TR';
  if (card.rarity === 'SP' || /\bSP\b/i.test(name)) return 'SP';
  if (card.isAlt || /\balternate\b|\balt art\b|\bparallel\b/i.test(name)) {
    if (card.rarity === 'SEC') return 'SEC_AA';
    if (card.rarity === 'L' || card.cardType === 'Leader') return 'LEADER_AA';
    return 'AA';
  }
  return card.rarity === 'SEC' ? 'SEC' : null;
}

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

  const baseCards = S.POOL.filter(c => !getHitType(c));
  function byR(r) { return baseCards.filter(c => c.rarity === r); }
  const hits = { SEC: [], AA: [], SEC_AA: [], LEADER_AA: [], SP: [], MANGA: [], TR: [] };
  S.DB.forEach(c => {
    if (c.outOfSet) return;
    const type = getHitType(c);
    if (type) hits[type].push(c);
  });
  S.pools = {
    L: byR('L'),
    SR: byR('SR'),
    R: byR('R'),
    C: byR('C'),
    UC: byR('UC'),
    hits
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
