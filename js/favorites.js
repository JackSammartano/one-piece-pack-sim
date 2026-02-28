/**
 * favorites.js — Gestione preferiti
 * Dual mode: Supabase (utenti loggati) / localStorage (anonimi).
 */
import { S } from './state.js';
import { supabase } from './config.js';
import { favCardKey } from './render.js';

// Callback per re-render (iniettato da app.js)
export let onFavsChanged = () => {};
export function setOnFavsChanged(fn) { onFavsChanged = fn; }

// Re-export per comodita
export { favCardKey };

function favStorageKey() { return 'opcg_favs_' + S.setCode; }

/**
 * Carica preferiti. Da Supabase se loggato, da localStorage altrimenti.
 */
export async function loadFavs() {
  S.favs = {};

  if (S.session?.user) {
    // Carica da Supabase
    const { data, error } = await supabase
      .from('user_favorites')
      .select('product_id,is_alt,note')
      .eq('set_code', S.setCode);

    if (error) {
      console.warn('Errore caricamento preferiti:', error);
    } else if (data) {
      data.forEach(row => {
        const card = S.DB.find(c => c.id === Number(row.product_id) && !!c.isAlt === !!row.is_alt);
        if (!card) return;
        S.favs[favCardKey(card)] = { card, note: row.note || '' };
      });
    }
  } else {
    // Carica da localStorage
    try {
      const r = localStorage.getItem(favStorageKey());
      if (r) {
        const parsed = JSON.parse(r);
        // Ricostruisci i riferimenti alle carte dal DB corrente
        Object.entries(parsed).forEach(([key, val]) => {
          if (val?.card) {
            const card = S.DB.find(c => favCardKey(c) === key);
            if (card) S.favs[key] = { card, note: val.note || '' };
          }
        });
      }
    } catch (e) {
      // localStorage non disponibile o corrotto
    }
  }

  onFavsChanged();
}

/**
 * Salva preferiti. Su Supabase se loggato, localStorage altrimenti.
 */
function saveFavsLocal() {
  try {
    localStorage.setItem(favStorageKey(), JSON.stringify(S.favs));
  } catch (e) {
    // localStorage pieno o non disponibile
  }
}

/**
 * Aggiunge o aggiorna un preferito.
 */
export async function addOrUpdateFav(card, note = '') {
  const key = favCardKey(card);

  if (S.session?.user) {
    const payload = {
      user_id: S.session.user.id,
      set_code: S.setCode,
      product_id: card.id,
      is_alt: !!card.isAlt,
      note: note || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('user_favorites').upsert(payload);
    if (error) { alert(error.message); return; }
  }

  S.favs[key] = { card, note: note || '' };
  if (!S.session?.user) saveFavsLocal();
  onFavsChanged();
}

/**
 * Rimuove un preferito.
 */
export async function removeFav(key) {
  const entry = S.favs[key];
  if (!entry) return;

  if (S.session?.user) {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .match({
        user_id: S.session.user.id,
        set_code: S.setCode,
        product_id: entry.card.id,
        is_alt: !!entry.card.isAlt
      });
    if (error) { alert(error.message); return; }
  }

  delete S.favs[key];
  if (!S.session?.user) saveFavsLocal();

  // Sincronizza bottone nella Card List
  const btn = document.querySelector(`.cl-fav-toggle[data-key="${key}"]`);
  if (btn) {
    btn.classList.remove('active');
    btn.querySelector('.cl-fav-star').textContent = '☆';
    btn.querySelector('.cl-fav-label').textContent = 'Aggiungi ai preferiti';
  }

  onFavsChanged();
}

/**
 * Aggiorna la nota di un preferito.
 */
export async function updateFavNote(key, note) {
  if (!S.favs[key]) return;
  S.favs[key].note = note;

  if (S.session?.user) {
    const entry = S.favs[key];
    await supabase.from('user_favorites').upsert({
      user_id: S.session.user.id,
      set_code: S.setCode,
      product_id: entry.card.id,
      is_alt: !!entry.card.isAlt,
      note: note || null,
      updated_at: new Date().toISOString()
    });
  } else {
    saveFavsLocal();
  }
}

/**
 * Toggle preferito dal bottone nella Card List.
 */
export async function clToggleFav(e, key) {
  e.stopPropagation();
  // Salva il riferimento prima dell'await: e.currentTarget diventa null dopo la microtask
  const btn = e.currentTarget;
  const add = !S.favs[key];

  if (add) {
    const c = S.POOL.find(p => favCardKey(p) === key)
           || S.DB.find(p => favCardKey(p) === key);
    if (!c) return;
    await addOrUpdateFav(c, '');
  } else {
    await removeFav(key);
  }

  if (btn) {
    btn.classList.toggle('active', add);
    btn.querySelector('.cl-fav-star').textContent = add ? '⭐' : '☆';
    btn.querySelector('.cl-fav-label').textContent = add ? 'Nei preferiti' : 'Aggiungi ai preferiti';
  }
}

/**
 * Toggle preferito generico (usato dal modale).
 */
export async function toggleFav(key) {
  if (S.favs[key]) {
    await removeFav(key);
  } else {
    const parts = key.split('|');
    const card = S.DB.find(c => favCardKey(c) === key);
    if (!card) return;
    await addOrUpdateFav(card, '');
  }
}
