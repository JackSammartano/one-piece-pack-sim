/**
 * app.js — Entry point utente
 * Importa tutti i moduli, wires eventi, gestisce auth e caricamento set.
 */
import { S } from './state.js';
import { supabase } from './config.js';
import { signInWithGoogle, signOut, onAuthStateChange, getMyProfile } from './auth.js';
import { parseDB } from './parser.js';
import { buildPools } from './pools.js';
import { applyFilters, resetFilters, setRenderCallbacks } from './filters.js';
import { openPacks, resetAll, setOnPacksOpened } from './simulator.js';
import { renderPullResult, renderCardListGrid, renderFavs } from './render.js';
import { openModal, closeModal, modalToggleFav, setOnModalFavToggle } from './modal.js';
import { loadFavs, removeFav, updateFavNote, clToggleFav, toggleFav, setOnFavsChanged } from './favorites.js';
import { switchTab, setTabCallbacks } from './tabs.js';
import { exportCards } from './export.js';

// ── Wire callbacks per evitare circular imports ───────────

setRenderCallbacks({ renderCardListGrid, renderFavs });

setTabCallbacks({ renderCardListGrid, renderFavs });

setOnPacksOpened((cards, n) => renderPullResult(cards, n));

setOnFavsChanged(() => {
  renderFavs();
  // Aggiorna card list solo se visibile
  const tabCl = document.getElementById('tabCl');
  if (tabCl && tabCl.style.display !== 'none') renderCardListGrid();
});

setOnModalFavToggle((key) => toggleFav(key));

// ── Auth UI ───────────────────────────────────────────────

function updateAuthUI() {
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const whoami = document.getElementById('whoami');
  const adminLink = document.getElementById('adminLink');

  if (S.session?.user) {
    btnLogin.style.display = 'none';
    btnLogout.style.display = '';
    whoami.textContent = `Loggato come: ${S.session.user.email}`;
  } else {
    btnLogin.style.display = '';
    btnLogout.style.display = 'none';
    whoami.textContent = 'Non loggato';
  }

  adminLink.style.display = S.profile?.is_admin ? '' : 'none';
}

// ── Set loading ───────────────────────────────────────────

function showTopError(msg) {
  const el = document.getElementById('topError');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

function clearTopError() {
  const el = document.getElementById('topError');
  el.style.display = 'none';
  el.textContent = '';
}

function setMainVisible(visible) {
  document.getElementById('mainLayout').style.display = visible ? 'grid' : 'none';
  document.getElementById('topBar').style.display = visible ? 'none' : '';
}

async function loadSets() {
  clearTopError();
  const sel = document.getElementById('setSelect');
  sel.innerHTML = '<option>Caricamento…</option>';

  const { data, error } = await supabase
    .from('sets')
    .select('set_code,name,release_date')
    .order('release_date', { ascending: false });

  if (error) {
    showTopError('Errore caricando i set: ' + error.message);
    sel.innerHTML = '<option value="">Errore</option>';
    return;
  }

  if (!data || data.length === 0) {
    sel.innerHTML = '<option value="">Nessun set disponibile</option>';
    return;
  }

  sel.innerHTML = data.map(s =>
    `<option value="${s.set_code}">${s.set_code} — ${s.name}</option>`
  ).join('');
}

async function loadSetFromDB(code) {
  clearTopError();

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_code', code);

  if (error) {
    showTopError('Errore caricando carte: ' + error.message);
    return;
  }

  if (!data || data.length === 0) {
    showTopError('Nessuna carta trovata per il set ' + code);
    return;
  }

  S.setCode = code;

  // Trasforma righe DB in formato carta normalizzato
  S.DB = data.map(row => ({
    id: Number(row.product_id),
    name: row.name || '',
    num: row.num || '',
    rarity: row.rarity || 'C',
    color: row.color || '',
    cardType: row.card_type || 'Character',
    sub: row.sub || '',
    cost: row.cost,
    power: row.power,
    life: row.life,
    attr: row.attr || '',
    counter: row.counter,
    desc: row.description || '',
    url: row.url || `https://www.tcgplayer.com/product/${row.product_id}`,
    imgRemote: row.img_remote || `https://tcgplayer-cdn.tcgplayer.com/product/${row.product_id}_400w.jpg`,
    isAlt: !!row.is_alt,
    outOfSet: !!row.out_of_set
  }));

  buildPools();

  document.getElementById('setTitle').textContent =
    `Pack Simulator · Set ${S.setCode} · ${S.DB.length} carte`;

  resetAll();
  await loadFavs();
  renderCardListGrid();
  renderFavs();
  setMainVisible(true);
}

function changeSet() {
  setMainVisible(false);
  S.DB = [];
  S.POOL = [];
  S.ALT_MAP = {};
  S.pools = {};
  S.setCode = '';
  resetAll();
  document.getElementById('setTitle').textContent = 'Pack Simulator';
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  // Auth buttons
  document.getElementById('btnLogin').addEventListener('click', signInWithGoogle);
  document.getElementById('btnLogout').addEventListener('click', signOut);

  // Set selector
  document.getElementById('btnLoadSet').addEventListener('click', async () => {
    const code = document.getElementById('setSelect').value;
    if (!code) return;
    await loadSetFromDB(code);
  });

  // Escape key per modale
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(null, true);
  });

  // Carica lista set
  await loadSets();

  // Auth state
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

  // Sessione iniziale
  const { data } = await supabase.auth.getSession();
  S.session = data.session;
  S.profile = S.session?.user ? await getMyProfile() : null;
  updateAuthUI();
}

init();

// ── Window bridge per onclick inline ──────────────────────
window.openPacks = openPacks;
window.resetAll = resetAll;
window.switchTab = switchTab;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.openModal = openModal;
window.closeModal = closeModal;
window.modalToggleFav = modalToggleFav;
window.toggleFav = toggleFav;
window.removeFav = removeFav;
window.updateFavNote = updateFavNote;
window.clToggleFav = clToggleFav;
window.exportCards = exportCards;
window.changeSet = changeSet;
