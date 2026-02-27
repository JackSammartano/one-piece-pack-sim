/**
 * filters.js — Sistema filtri
 * Filtri condivisi tra tutte le tab. Lettura dal DOM, filtraggio puro.
 */
import { S } from './state.js';

/**
 * Legge i valori correnti dei filtri dal DOM.
 */
export function getFilters() {
  return {
    name:    document.getElementById('fName')?.value.toLowerCase().trim() || '',
    rarity:  document.getElementById('fRarity')?.value || '',
    color:   document.getElementById('fColor')?.value || '',
    type:    document.getElementById('fType')?.value || '',
    attr:    document.getElementById('fAttr')?.value || '',
    counter: document.getElementById('fCounter')?.value || '',
    sub:     document.getElementById('fSub')?.value.toLowerCase().trim() || '',
    power:   document.getElementById('fPower')?.value || ''
  };
}

/**
 * True se almeno un filtro ha un valore non vuoto.
 */
export function hasActiveFilters(f) {
  return Object.values(f).some(v => v !== '');
}

/**
 * Filtra un array di carte in base ai filtri attivi.
 * @param {Array} pool - Array di carte da filtrare
 * @returns {Array} Carte filtrate
 */
export function filterPool(pool) {
  const f = getFilters();
  return pool.filter(c => {
    if (f.name) {
      const q = f.name;
      if (!c.name.toLowerCase().includes(q) && !c.num.toLowerCase().includes(q)) return false;
    }
    if (f.rarity && c.rarity !== f.rarity) return false;
    if (f.color && !c.color.split(';').map(x => x.trim()).includes(f.color)) return false;
    if (f.type && c.cardType !== f.type) return false;
    if (f.attr && !c.attr.split(';').map(x => x.trim()).includes(f.attr)) return false;
    if (f.sub && !(c.sub || '').toLowerCase().includes(f.sub)) return false;
    if (f.power && (c.power == null || c.power !== Number(f.power))) return false;

    if (f.counter) {
      const fc = f.counter;
      if (fc === 'blocker')      return (c.desc || '').includes('[Blocker]');
      if (fc === 'counter_desc') return (c.desc || '').includes('[Counter]');
      if (fc === 'any_counter')  return c.counter != null || (c.desc || '').includes('[Counter]');
      if (!isNaN(fc))            return c.counter === Number(fc);
    }
    return true;
  });
}

/**
 * Applica i filtri e aggiorna la UI.
 * Chiamato ad ogni cambio filtro (oninput/onchange).
 * Le funzioni di render vengono iniettate da app.js per evitare circular imports.
 */
export let renderCallbacks = {
  renderCardListGrid: () => {},
  renderFavs: () => {}
};

export function setRenderCallbacks(cbs) {
  Object.assign(renderCallbacks, cbs);
}

export function applyFilters() {
  const f = getFilters();
  const active = hasActiveFilters(f);
  const filtered = filterPool(S.POOL);
  const badge = document.getElementById('filterActiveCount');
  if (badge) badge.textContent = active ? `${filtered.length} / ${S.POOL.length} carte` : '';

  // Aggiorna la tab attiva
  const tabCl = document.getElementById('tabCl');
  const tabFav = document.getElementById('tabFav');
  if (tabCl && tabCl.style.display !== 'none') renderCallbacks.renderCardListGrid();
  if (tabFav && tabFav.style.display !== 'none') renderCallbacks.renderFavs();

  // Badge filtri nel simulatore
  const simBadge = document.getElementById('simFilterBadge');
  if (simBadge && S.lastPulled.length) {
    const fp = filterPool(S.lastPulled);
    simBadge.textContent = active ? `· ${fp.length} carte con filtri attivi` : '';
  }
}

export function resetFilters() {
  ['fName', 'fSub', 'fPower'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['fRarity', 'fColor', 'fType', 'fAttr', 'fCounter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyFilters();
}
