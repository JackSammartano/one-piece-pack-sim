/**
 * tabs.js — Navigazione tab
 */
import { applyFilters } from './filters.js';

// Callback per render (iniettati da app.js)
export let tabCallbacks = {
  renderCardListGrid: () => {},
  renderFavs: () => {}
};

export function setTabCallbacks(cbs) {
  Object.assign(tabCallbacks, cbs);
}

/**
 * Cambia tab visibile: sim, cl, fav.
 */
export function switchTab(tab) {
  document.getElementById('tabSim').style.display = tab === 'sim' ? '' : 'none';
  document.getElementById('tabCl').style.display  = tab === 'cl'  ? '' : 'none';
  document.getElementById('tabFav').style.display = tab === 'fav' ? '' : 'none';

  document.getElementById('tabBtnSim').classList.toggle('active', tab === 'sim');
  document.getElementById('tabBtnCl').classList.toggle('active', tab === 'cl');
  document.getElementById('tabBtnFav').classList.toggle('active', tab === 'fav');

  if (tab === 'cl')  tabCallbacks.renderCardListGrid();
  if (tab === 'fav') tabCallbacks.renderFavs();
  applyFilters();
}
