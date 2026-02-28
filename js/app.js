/**
 * app.js — Entry point utente
 */
import { S } from './state.js';
import { supabase } from './config.js';
import { signInWithGoogle, signOut, onAuthStateChange, getMyProfile } from './auth.js';
import { buildPools } from './pools.js';
import { applyFilters, resetFilters, setRenderCallbacks } from './filters.js';
import { openPacks as _openPacks, resetAll, setOnPacksOpened } from './simulator.js';
import { renderPullResult, renderCardListGrid, renderFavs } from './render.js';
import { openModal, closeModal, modalToggleFav, setOnModalFavToggle } from './modal.js';
import { loadFavs, removeFav, updateFavNote, clToggleFav, toggleFav, setOnFavsChanged } from './favorites.js';
import { switchTab, setTabCallbacks } from './tabs.js';
import { exportCards } from './export.js';

// ── Wire callbacks ────────────────────────────────────────

setRenderCallbacks({ renderCardListGrid, renderFavs });
setTabCallbacks({ renderCardListGrid, renderFavs });
setOnPacksOpened((cards, n) => renderPullResult(cards, n));
setOnFavsChanged(() => {
  renderFavs();
  const tabCl = document.getElementById('tabCl');
  if (tabCl && tabCl.style.display !== 'none') renderCardListGrid();
});
setOnModalFavToggle((key) => toggleFav(key));

// ── Window bridge ─────────────────────────────────────────

window.openPacks = () => {
  if (!S.setCode || !S.pools.R) {
    document.getElementById('setTitle').textContent = '⚠ Seleziona un set prima di sbustare';
    return;
  }
  _openPacks();
};
window.resetAll       = resetAll;
window.switchTab      = switchTab;
window.applyFilters   = applyFilters;
window.resetFilters   = resetFilters;
window.openModal      = openModal;
window.closeModal     = closeModal;
window.modalToggleFav = modalToggleFav;
window.toggleFav      = toggleFav;
window.removeFav      = removeFav;
window.updateFavNote  = updateFavNote;
window.clToggleFav    = clToggleFav;
window.exportCards    = exportCards;

// ── Helpers ───────────────────────────────────────────────

let allSets = [];

function rowToCard(row) {
  return {
    id:        Number(row.product_id),
    name:      row.name || '',
    num:       row.num || '',
    rarity:    row.rarity || 'C',
    color:     row.color || '',
    cardType:  row.card_type || 'Character',
    sub:       row.sub || '',
    cost:      row.cost,
    power:     row.power,
    life:      row.life,
    attr:      row.attr || '',
    counter:   row.counter,
    desc:      row.description || '',
    url:       row.url || `https://www.tcgplayer.com/product/${row.product_id}`,
    imgRemote: row.img_remote || `https://tcgplayer-cdn.tcgplayer.com/product/${row.product_id}_400w.jpg`,
    isAlt:     !!row.is_alt,
    outOfSet:  !!row.out_of_set
  };
}

function buildSetOptions(sets) {
  const groups = {};
  for (const s of sets) {
    const prefix = s.set_code.replace(/[0-9].*/, '') || 'OTHER';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(s);
  }
  for (const g of Object.values(groups)) {
    g.sort((a, b) => a.set_code.localeCompare(b.set_code, undefined, { numeric: true }));
  }
  return '<option value="">Scegli un set…</option>' +
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, list]) =>
        `<optgroup label="${prefix}">${
          list.map(s => `<option value="${s.set_code}">${s.set_code} — ${s.name}</option>`).join('')
        }</optgroup>`
      ).join('');
}

/** Popola e sincronizza tutti e tre i selettori set con lo stesso valore. */
function syncSetSelectors(code) {
  ['simSetSelect', 'clSetSelect', 'favSetSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = code || '';
  });
}

// ── Auth UI ───────────────────────────────────────────────

function updateAuthUI() {
  const isLogged = !!S.session?.user;
  const btnLogin  = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const whoami    = document.getElementById('whoami');
  const adminLink = document.getElementById('adminLink');

  if (isLogged) {
    btnLogin.style.display  = 'none';
    btnLogout.style.display = '';
    whoami.textContent = S.session.user.email;
  } else {
    btnLogin.style.display  = '';
    btnLogout.style.display = 'none';
    whoami.textContent = 'Non loggato';
  }

  // Admin link visibile solo agli admin
  if (adminLink) adminLink.style.display = S.profile?.is_admin ? '' : 'none';

  // Sim controls abilitati solo se loggato
  const simSel  = document.getElementById('simSetSelect');
  const btnOpen = document.getElementById('btnOpenPacks');
  if (simSel)  simSel.disabled  = !isLogged;
  if (btnOpen) btnOpen.disabled = !isLogged;
}

// ── Set loading ───────────────────────────────────────────

async function loadSets() {
  const { data, error } = await supabase
    .from('sets').select('set_code,name,release_date');

  if (error || !data || data.length === 0) return;

  allSets = data;
  const html = buildSetOptions(data);
  ['simSetSelect', 'clSetSelect', 'favSetSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

/** Carica le carte di un set e aggiorna tutta l'app. */
async function loadSet(code) {
  if (!code) return;

  // Disabilita il bottone durante il caricamento
  const btnOpen = document.getElementById('btnOpenPacks');
  if (btnOpen) btnOpen.disabled = true;

  const { data, error } = await supabase
    .from('cards').select('*').eq('set_code', code);

  if (error) {
    console.error('Errore caricamento carte:', error.message);
    document.getElementById('setTitle').textContent = '⚠ Errore caricamento set';
    if (btnOpen && S.session?.user) btnOpen.disabled = false;
    return;
  }
  if (!data || data.length === 0) {
    document.getElementById('setTitle').textContent = `⚠ Nessuna carta trovata per ${code}`;
    if (btnOpen && S.session?.user) btnOpen.disabled = false;
    return;
  }

  S.setCode = code;
  S.DB = data.map(rowToCard);
  buildPools();

  const setName = allSets.find(s => s.set_code === code)?.name || code;
  document.getElementById('setTitle').textContent =
    `Pack Simulator · ${code} · ${setName} (${S.POOL.length} carte)`;

  // Sincronizza tutte le tendine
  syncSetSelectors(code);

  resetAll();
  await loadFavs();
  renderCardListGrid();
  renderFavs();

  // Riabilita il bottone solo se loggato
  if (btnOpen && S.session?.user) btnOpen.disabled = false;
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  document.getElementById('btnLogin').addEventListener('click', signInWithGoogle);
  document.getElementById('btnLogout').addEventListener('click', signOut);

  // I tre selettori set chiamano tutti loadSet — sono sincronizzati
  ['simSetSelect', 'clSetSelect', 'favSetSelect'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => loadSet(e.target.value));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(null, true);
  });

  await loadSets();

  onAuthStateChange(async (session) => {
    S.session = session;
    S.profile = session?.user ? await getMyProfile() : null;
    updateAuthUI();
    if (S.setCode) {
      await loadFavs();
      renderCardListGrid();
      renderFavs();
    }
  });

  const { data } = await supabase.auth.getSession();
  S.session = data.session;
  S.profile = S.session?.user ? await getMyProfile() : null;
  updateAuthUI();
}

init();
