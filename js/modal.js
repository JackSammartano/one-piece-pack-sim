/**
 * modal.js — Modale dettaglio carta
 * Punto di accesso unico per visualizzare informazioni complete di una carta.
 */
import { S } from './state.js';
import { colorPips, favCardKey } from './render.js';

/**
 * Apre il modale per una carta.
 * Cerca nel DB completo (funziona per alt art e carte fuori set).
 * @param {string|number} productId - ID prodotto TCGPlayer
 */
export function openModal(productId) {
  const c = S.DB.find(x => String(x.id) === String(productId));
  if (!c) return;
  S.modalCard = c;

  const isEvent = c.cardType === 'Event';
  const badgeCls = isEvent ? 'badge-EVENT' : `badge-${c.rarity}`;
  const displayR = isEvent ? 'EVENT' : c.rarity;
  const key = favCardKey(c);
  const isFav = !!S.favs[key];

  document.getElementById('modalImg').src = c.imgRemote;
  document.getElementById('modalImg').onerror = function () { this.style.display = 'none'; };
  document.getElementById('modalName').textContent = c.name;
  document.getElementById('modalMeta').innerHTML =
    `<span class="card-num">#${c.num}</span>
     <span class="rarity-badge ${badgeCls}">${displayR}</span>
     <div class="color-pips">${colorPips(c.color)}</div>`;

  const stats = [
    c.cost != null ? `<span><b>Costo</b> ${c.cost}</span>` : '',
    c.power != null ? `<span><b>Forza</b> ${c.power.toLocaleString()}</span>` : '',
    c.life != null ? `<span><b>Life</b> ${c.life}</span>` : '',
    c.counter ? `<span><b>Counter</b> +${c.counter}</span>` : '',
    c.attr ? `<span><b>Attr.</b> ${c.attr.split(';')[0]}</span>` : '',
    c.cardType ? `<span><b>Tipo</b> ${c.cardType}</span>` : ''
  ].filter(Boolean).join('');
  document.getElementById('modalStats').innerHTML = stats;

  const subEl = document.getElementById('modalSub');
  subEl.textContent = c.sub ? c.sub.replace(/;/g, ' · ') : '';
  subEl.style.display = c.sub ? '' : 'none';

  document.getElementById('modalActions').innerHTML =
    `<button class="modal-btn" onclick="window.open('${c.url}','_blank')">🔗 TCGPlayer</button>
     <button class="modal-btn${isFav ? ' danger' : ''}" id="modalFavBtn"
       onclick="modalToggleFav('${key}')">
       ${isFav ? '✕ Rimuovi dai preferiti' : '⭐ Aggiungi ai preferiti'}
     </button>`;

  document.getElementById('cardModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Chiude il modale.
 */
export function closeModal(e, force) {
  if (force || !e || e.target === document.getElementById('cardModalOverlay')) {
    document.getElementById('cardModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    S.modalCard = null;
  }
}

// Callback per toggle fav dal modale (iniettato da app.js)
export let onModalFavToggle = () => {};
export function setOnModalFavToggle(fn) { onModalFavToggle = fn; }

/**
 * Toggle preferito dal modale. Aggiorna UI modale e sincronizza Card List.
 */
export function modalToggleFav(key) {
  onModalFavToggle(key);

  const isFav = !!S.favs[key];
  const btn = document.getElementById('modalFavBtn');
  if (btn) {
    btn.textContent = isFav ? '✕ Rimuovi dai preferiti' : '⭐ Aggiungi ai preferiti';
    btn.className = 'modal-btn' + (isFav ? ' danger' : '');
  }

  // Sincronizza bottone nella Card List
  const gb = document.querySelector(`.cl-fav-toggle[data-key="${key}"]`);
  if (gb) {
    gb.classList.toggle('active', isFav);
    gb.querySelector('.cl-fav-star').textContent = isFav ? '⭐' : '☆';
    gb.querySelector('.cl-fav-label').textContent = isFav ? 'Nei preferiti' : 'Aggiungi ai preferiti';
  }
}
