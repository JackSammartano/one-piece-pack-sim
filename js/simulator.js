/**
 * simulator.js — Motore simulazione buste
 * Probabilita realistiche per ogni rarita, alt art injection.
 */
import { S } from './state.js';

// Callback per render (iniettato da app.js)
export let onPacksOpened = () => {};
export function setOnPacksOpened(fn) { onPacksOpened = fn; }

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybeAlt(card) {
  if (card.isAlt) return card;
  const k = card.num + '|' + card.rarity;
  const alts = S.ALT_MAP[k];
  return (alts?.length && Math.random() < 0.30) ? pickRandom(alts) : card;
}

/**
 * Simula una singola busta (12 carte).
 * Slot 1: rarita pesata. Slot 2-12: 10% R, 90% dal pool C/UC.
 */
function simulatePack() {
  const pack = [];
  const commonCards = [...S.pools.C, ...S.pools.UC];

  // Slot speciale (posizione 1)
  const r1 = Math.random();
  let g;
  if      (r1 < 0.002) g = pickRandom(S.pools.SEC.length ? S.pools.SEC : S.pools.SR);
  else if (r1 < 0.007) g = pickRandom(S.pools.SP.length ? S.pools.SP : S.pools.SR);
  else if (r1 < 0.357) g = pickRandom(S.pools.SR);
  else if (r1 < 0.407) g = pickRandom(S.pools.L.length ? S.pools.L : S.pools.R);
  else                 g = pickRandom(S.pools.R);

  pack.push(maybeAlt(g));

  // Slot 2-12
  for (let i = 0; i < 11; i++) {
    pack.push(maybeAlt(
      Math.random() < 0.10 ? pickRandom(S.pools.R) : pickRandom(commonCards)
    ));
  }

  return pack;
}

/**
 * Apre N buste, aggiorna stats, chiama il render.
 */
export function openPacks() {
  const n = parseInt(document.getElementById('packCount').value) || 1;
  const pulled = [];

  for (let i = 0; i < n; i++) {
    simulatePack().forEach(c => pulled.push(c));
  }

  S.lastPulled = pulled;
  S.sessionStats.packs += n;
  S.sessionStats.cards += pulled.length;
  pulled.forEach(c => {
    if (c.rarity === 'SR') S.sessionStats.sr++;
    if (c.rarity === 'SEC' || c.rarity === 'SP') S.sessionStats.secSp++;
  });

  updateStats();
  onPacksOpened(pulled, n);
}

export function updateStats() {
  document.getElementById('stat-packs').textContent = S.sessionStats.packs;
  document.getElementById('stat-cards').textContent = S.sessionStats.cards;
  document.getElementById('stat-sr').textContent    = S.sessionStats.sr;
  document.getElementById('stat-sec').textContent   = S.sessionStats.secSp;
}

export function resetAll() {
  S.sessionStats = { packs: 0, cards: 0, sr: 0, secSp: 0 };
  S.lastPulled = [];
  updateStats();
  document.getElementById('emptyState').style.display = '';
  document.getElementById('pullResult').classList.remove('active');
  const b = document.getElementById('simFilterBadge');
  if (b) b.textContent = '';
  const grid = document.getElementById('cardsGrid');
  if (grid) grid.innerHTML = '';
  const rs = document.getElementById('raritySummary');
  if (rs) rs.innerHTML = '';
  const pl = document.getElementById('pullLabel');
  if (pl) pl.textContent = '';
}
