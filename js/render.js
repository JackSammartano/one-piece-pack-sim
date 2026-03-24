/**
 * render.js — Rendering UI
 * Genera HTML per carte estratte, card list e preferiti.
 */
import { S } from './state.js';
import { RARITY_RANK, COLOR_MAP } from './config.js';
import { getFilters, hasActiveFilters, filterPool } from './filters.js';

/**
 * Genera HTML per pallini colore (supporta multicolore con ";").
 */
export function colorPips(colorStr) {
  if (!colorStr) return '';
  return colorStr.split(';').map(c => {
    const hex = COLOR_MAP[c.trim()] || '#888';
    return `<div class="color-pip" style="background:${hex}" title="${c.trim()}"></div>`;
  }).join('');
}

/**
 * Genera chiave univoca per carta nei preferiti.
 */
export function favCardKey(c) {
  return c.num + '|' + c.id;
}

/**
 * Rendering risultato apertura buste.
 */
export function renderPullResult(cards, nPacks) {
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('pullResult').classList.add('active');
  document.getElementById('pullLabel').textContent =
    `${nPacks} bust${nPacks === 1 ? 'a' : 'e'} · ${cards.length} carte`;

  // Badge filtri
  const simBadge = document.getElementById('simFilterBadge');
  if (simBadge) {
    const fp = filterPool(cards);
    const active = hasActiveFilters(getFilters());
    simBadge.textContent = active ? `· ${fp.length} con filtri attivi` : '';
  }

  // Rarity summary chips
  const cnt = {};
  cards.forEach(c => cnt[c.rarity] = (cnt[c.rarity] || 0) + 1);
  const CHIPCLS = { SEC: 'sec-chip', SP: 'sp-chip', SR: 'sr-chip', L: 'l-chip', R: 'r-chip', C: 'c-chip' };
  document.getElementById('raritySummary').innerHTML =
    ['SEC', 'SP', 'SR', 'L', 'R', 'C'].filter(r => cnt[r])
      .map(r => `<div class="rs-chip ${CHIPCLS[r]}"><strong>${cnt[r]}</strong>&nbsp;${r}</div>`).join('');

  // Subtypes
  const subCnt = {};
  cards.forEach(c => {
    if (!c.sub) return;
    c.sub.split(';').forEach(s => { s = s.trim(); if (s) subCnt[s] = (subCnt[s] || 0) + 1; });
  });
  const sortedSubs = Object.entries(subCnt).sort((a, b) => b[1] - a[1]);
  const subSection = document.getElementById('subtypeSection');
  if (sortedSubs.length > 0) {
    subSection.style.display = '';
    document.getElementById('subtypeGrid').innerHTML = sortedSubs.map(([name, count]) =>
      `<div class="sub-chip"><span class="sub-name">${name}</span><span class="sub-count">${count}</span></div>`
    ).join('');
  } else {
    subSection.style.display = 'none';
  }

  // Cards grid (sorted by rarity)
  const sorted = [...cards].sort((a, b) => (RARITY_RANK[a.rarity] ?? 5) - (RARITY_RANK[b.rarity] ?? 5));
  document.getElementById('cardsGrid').innerHTML = sorted.map((c, idx) => {
    const isEvent = c.cardType === 'Event';
    const rClass = isEvent ? 'EVENT' : c.rarity;
    const badgeCls = isEvent ? 'badge-EVENT' : `badge-${c.rarity}`;
    const displayR = isEvent ? 'EVENT' : c.rarity;
    const delay = Math.min(idx * 35, 900);
    const statsHtml = [
      c.cost != null ? `<span>💰${c.cost}</span>` : '',
      c.power != null ? `<span>⚔${c.power.toLocaleString()}</span>` : ''
    ].filter(Boolean).join('');

    return `<div class="card-link" onclick="openModal('${c.id}')" style="cursor:pointer">
      <div class="rarity-wrap-${rClass}" style="display:contents">
      <div class="card-item${c.isAlt ? ' is-alt' : ''}" style="animation-delay:${delay}ms">
        <div class="card-img-wrap">
          <img src="${c.imgRemote}" alt="${c.name}" loading="lazy"
            onerror="this.parentElement.innerHTML='<div class=\\'no-img\\'>🃏</div>'">
        </div>
        <div class="card-info">
          <div class="card-name">${c.name}</div>
          <div class="card-meta">
            <span class="card-num">#${c.num}</span>
            <span class="rarity-badge ${badgeCls}">${displayR}</span>
            <div class="color-pips">${colorPips(c.color)}</div>
          </div>
          ${statsHtml ? `<div class="card-stats">${statsHtml}</div>` : ''}
          ${isEvent ? `<div class="card-type-tag">evento</div>` : ''}
        </div>
      </div>
      </div>
    </div>`;
  }).join('');
}

/**
 * Rendering griglia Card List.
 */
export function renderCardListGrid() {
  const altCards = S.DB.filter(c => c.isAlt && !c.outOfSet);
  const cards = filterPool([...S.POOL, ...altCards]);
  const countEl = document.getElementById('filterActiveCount');
  if (countEl) {
    const active = hasActiveFilters(getFilters());
    countEl.textContent = active ? `${cards.length} / ${S.POOL.length} carte` : '';
  }

  document.getElementById('clGrid').innerHTML = cards.map(c => {
    const isEvent = c.cardType === 'Event';
    const rClass = isEvent ? 'EVENT' : c.rarity;
    const badgeCls = isEvent ? 'badge-EVENT' : `badge-${c.rarity}`;
    const displayR = isEvent ? 'EVENT' : c.rarity;
    const key = favCardKey(c);
    const isFav = !!S.favs[key];
    const statsArr = [
      c.cost != null ? `<span>💰${c.cost}</span>` : '',
      c.power != null ? `<span>⚔${c.power.toLocaleString()}</span>` : '',
      c.counter ? `<span>🛡+${c.counter}</span>` : '',
      c.life != null ? `<span>❤${c.life}</span>` : ''
    ];
    const statsHtml = statsArr.filter(Boolean).join('');

    return `<div class="cl-card rarity-${rClass}${c.isAlt ? ' is-alt' : ''}">
      <div class="cl-img-wrap" onclick="openModal('${c.id}')">
        <img src="${c.imgRemote}" alt="${c.name}" loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=\\'no-img\\'>🃏</div>'">
      </div>
      <div class="cl-info">
        <div class="cl-name">${c.name}</div>
        <div class="cl-meta">
          <span class="card-num">#${c.num}</span>
          <span class="rarity-badge ${badgeCls}">${displayR}</span>
          <div class="color-pips">${colorPips(c.color)}</div>
        </div>
        ${statsHtml ? `<div class="cl-stats">${statsHtml}</div>` : ''}
        ${c.sub ? `<div class="cl-sub">${c.sub.replace(/;/g, ' · ')}</div>` : ''}
        <button class="cl-fav-toggle${isFav ? ' active' : ''}" data-key="${key}"
          onclick="clToggleFav(event,'${key}')">
          <span class="cl-fav-star">${isFav ? '⭐' : '☆'}</span>
          <span class="cl-fav-label">${isFav ? 'Nei preferiti' : 'Aggiungi ai preferiti'}</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

/**
 * Rendering tab Preferiti.
 */
export function renderFavs() {
  const keys = Object.keys(S.favs);
  const empty = document.getElementById('favEmpty');
  const grid = document.getElementById('favGrid');
  updateFavBadge();

  // Filtra
  const filtered = filterPool(keys.map(k => S.favs[k]?.card).filter(Boolean));
  const fkeys = keys.filter(k => filtered.some(c => c === S.favs[k]?.card));
  fkeys.sort((a, b) =>
    (S.favs[a]?.card?.num || '').localeCompare(S.favs[b]?.card?.num || '', undefined, { numeric: true })
  );

  if (fkeys.length === 0) {
    empty.style.display = '';
    grid.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = fkeys.map(key => {
    if (!S.favs[key]) return '';
    const { card: c, note } = S.favs[key];
    const isEvent = c.cardType === 'Event';
    const rClass = isEvent ? 'EVENT' : c.rarity;
    const badgeCls = isEvent ? 'badge-EVENT' : `badge-${c.rarity}`;
    const displayR = isEvent ? 'EVENT' : c.rarity;
    const safeNote = (note || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    return `<div class="fav-card rarity-${rClass}">
      <div class="fav-img-wrap" onclick="openModal('${c.id}')" style="cursor:pointer">
        <img src="${c.imgRemote}" alt="${c.name}" loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=\\'no-img\\'>🃏</div>'">
      </div>
      <div class="fav-body">
        <div class="fav-name">${c.name}</div>
        <div class="fav-meta">
          <span class="card-num">#${c.num}</span>
          <span class="rarity-badge ${badgeCls}">${displayR}</span>
          <div class="color-pips">${colorPips(c.color)}</div>
        </div>
        <textarea class="fav-note" placeholder="Note su questa carta…"
          oninput="updateFavNote('${key}',this.value)">${safeNote}</textarea>
        <button class="fav-remove" onclick="removeFav('${key}')">✕ Rimuovi</button>
      </div>
    </div>`;
  }).join('');
}

function updateFavBadge() {
  const n = Object.keys(S.favs).length;
  const countEl = document.getElementById('favCount');
  if (countEl) countEl.textContent = n;
  const badgeEl = document.getElementById('favTabBadge');
  if (badgeEl) badgeEl.textContent = n > 0 ? `(${n})` : '';
}
