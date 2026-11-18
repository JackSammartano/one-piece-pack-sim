/**
 * simulator.js — Motore simulazione buste
 * Modello empirico: buste estratte senza reinserimento da un box virtuale.
 */
import { S } from './state.js';
import { getHitType } from './pools.js';

// Medie di calibrazione ogni 288 buste; non sono quote ufficiali per set.
const HIT_WEIGHTS = [['SEC', 8], ['AA', 12], ['SEC_AA', 2], ['LEADER_AA', 4], ['SP', 2]];

// Callback per render (iniettato da app.js)
export let onPacksOpened = () => {};
export function setOnPacksOpened(fn) { onPacksOpened = fn; }

/**
 * Estrae gli esiti delle buste da un nuovo box virtuale di 24 buste.
 * Modello empirico: 7 SR base e 2 hit (2/3 dei box) oppure 3 hit (1/3).
 * Ogni chiamata rappresenta un nuovo evento, senza conservare il box residuo.
 */
export function drawPackOutcomes(count) {
  if (!Number.isInteger(count) || count < 1 || count > 24) {
    throw new RangeError('Il numero di buste deve essere un intero tra 1 e 24.');
  }

  const hits = Math.random() < 2 / 3 ? 2 : 3;
  const outcomes = [
    ...Array(7).fill('SR'),
    ...Array(hits).fill('HIT'),
    ...Array(17 - hits).fill('R')
  ];
  for (let i = outcomes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
  }
  return outcomes.slice(0, count);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function drawCards(pool, count) {
  const available = [...pool];
  return Array.from({ length: count }, () => {
    const index = Math.floor(Math.random() * available.length);
    return available.splice(index, 1)[0];
  });
}

function pickHit() {
  const eligible = HIT_WEIGHTS.filter(([type]) => S.pools.hits[type].length);
  let roll = Math.random() * eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let type = eligible[eligible.length - 1][0];
  for (const [candidate, weight] of eligible) {
    roll -= weight;
    if (roll < 0) { type = candidate; break; }
  }

  // 0,75 TR ogni 12 AA; 0,25 Manga ogni 6 Leader AA/SP, a pool completi.
  if (type === 'AA' && S.pools.hits.TR.length && Math.random() < 1 / 16) type = 'TR';
  if ((type === 'LEADER_AA' || type === 'SP') && S.pools.hits.MANGA.length && Math.random() < 1 / 24) type = 'MANGA';
  return pickRandom(S.pools.hits[type]);
}

/** 12 carte: 7 C, 3 UC, 1 R, 1 R/SR/hit. Un Leader sostituisce una C. */
function simulatePack(outcome, hasLeader) {
  const commons = drawCards(S.pools.C, hasLeader ? 6 : 7);
  if (hasLeader) commons.push(pickRandom(S.pools.L));
  const rares = drawCards(S.pools.R, outcome === 'R' ? 2 : 1);
  const upper = outcome === 'HIT' ? [pickHit()] : outcome === 'SR' ? [pickRandom(S.pools.SR)] : [];
  return [...commons, ...drawCards(S.pools.UC, 3), ...rares, ...upper];
}

/**
 * Apre N buste, aggiorna stats, chiama il render.
 */
export function openPacks() {
  const n = Number(document.getElementById('packCount').value);
  const errorEl = document.getElementById('simError');
  function fail(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  if (!Number.isInteger(n) || n < 1 || n > 24) {
    fail('Inserisci un numero intero di buste tra 1 e 24.');
    return;
  }
  const required = [['C', 7], ['UC', 3], ['R', 2], ['SR', 1]];
  if (required.some(([rarity, count]) => (S.pools[rarity]?.length || 0) < count) ||
      !HIT_WEIGHTS.some(([type]) => S.pools.hits?.[type]?.length)) {
    fail('Il set non contiene i pool necessari al modello pre-release (C, UC, R, SR e hit).');
    return;
  }
  errorEl.textContent = '';
  errorEl.style.display = 'none';

  const box = drawPackOutcomes(24).map(outcome => ({ outcome, leader: false }));
  if (S.pools.L.length) {
    drawCards(box.filter(pack => pack.outcome === 'R'), 8).forEach(pack => { pack.leader = true; });
  }
  const pulled = box.slice(0, n).flatMap(pack => simulatePack(pack.outcome, pack.leader));

  S.lastPulled = pulled;
  S.sessionStats.packs += n;
  S.sessionStats.cards += pulled.length;
  pulled.forEach(c => {
    const hit = getHitType(c);
    if (c.rarity === 'SR' && !hit) S.sessionStats.sr++;
    if (hit) S.sessionStats.hits++;
    if (c.rarity === 'SEC' || c.rarity === 'SP') S.sessionStats.secSp++;
  });

  updateStats();
  onPacksOpened(pulled, n);
}

export function updateStats() {
  document.getElementById('stat-packs').textContent = S.sessionStats.packs;
  document.getElementById('stat-cards').textContent = S.sessionStats.cards;
  document.getElementById('stat-sr').textContent    = S.sessionStats.sr;
  document.getElementById('stat-sec').textContent   = S.sessionStats.hits;
}

export function resetAll() {
  S.sessionStats = { packs: 0, cards: 0, sr: 0, secSp: 0, hits: 0 };
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
  const errorEl = document.getElementById('simError');
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
}
