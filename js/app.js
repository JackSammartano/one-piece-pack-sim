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
import { openPacks as _openPacks, resetAll, setOnPacksOpened } from './simulator.js';
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
  const tabCl = document.getElementById('tabCl');
  if (tabCl && tabCl.style.display !== 'none') renderCardListGrid();
});

setOnModalFavToggle((key) => toggleFav(key));

// ── Set options helpers ───────────────────────────────────

let allSets = []; // cache lista set

/**
 * Raggruppa i set per prefisso e genera HTML con <optgroup>.
 * Ordina per prefisso alfabetico, poi per set_code numerico dentro ogni gruppo.
 */
function buildSetOptions(sets, includeBlank = true) {
  const groups = {};
  for (const s of sets) {
    const prefix = s.set_code.replace(/[0-9].*/, '') || 'OTHER';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(s);
  }
  for (const g of Object.values(groups)) {
    g.sort((a, b) => a.set_code.localeCompare(b.set_code, undefined, { numeric: true }));
  }
  const blank = includeBlank ? '<option value="">Scegli un set…</option>' : '';
  return blank + Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, list]) =>
      `<optgroup label="${prefix}">${
        list.map(s => `<option value="${s.set_code}">${s.set_code} — ${s.name}</option>`).join('')
      }</optgroup>`
    ).join('');
}

function populateSetSelects(sets) {
  const simSel = document.getElementById('simSetSelect');
  const clSel  = document.getElementById('clSetSelect');
  if (simSel) simSel.innerHTML = buildSetOptions(sets, true);
  if (clSel)  clSel.innerHTML  = buildSetOptions(sets, true);
}

// ── State persistence pre/post OAuth redirect ─────────────

function saveStateBeforeRedirect() {
  const activeTab = document.getElementById('tabBtnCl')?.classList.contains('active') ? 'cl'
    : document.getElementById('tabBtnFav')?.classList.contains('active') ? 'fav' : 'sim';
  sessionStorage.setItem('opcg_pre_auth', JSON.stringify({
    simSetCode: S.setCode,
    clSetCode:  S.clSetCode,
    tab:        activeTab
  }));
}

async function restoreStateAfterRedirect() {
  const raw = sessionStorage.getItem('opcg_pre_auth');
  if (!raw) return false;
  sessionStorage.removeItem('opcg_pre_auth');
  const saved = JSON.parse(raw);

  if (saved.simSetCode) {
    const simSel = document.getElementById('simSetSelect');
    if (simSel) simSel.value = saved.simSetCode;
    await loadSimSet(saved.simSetCode);
  }
  if (saved.clSetCode) {
    const clSel = document.getElementById('clSetSelect');
    if (clSel) clSel.value = saved.clSetCode;
    await loadClSet(saved.clSetCode);
  }
  if (saved.tab) switchTab(saved.tab);
  return true;
}

// ── Auth UI ───────────────────────────────────────────────

function updateAuthUI() {
  const btnLogin  = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const whoami    = document.getElementById('whoami');
  const adminLink = document.getElementById('adminLink');

  if (S.session?.user) {
    btnLogin.style.display  = 'none';
    btnLogout.style.display = '';
    whoami.textContent = S.session.user.email;
  } else {
    btnLogin.style.display  = '';
    btnLogout.style.display = 'none';
    whoami.textContent = 'Non loggato';
  }

  if (adminLink) adminLink.style.display = S.profile?.is_admin ? '' : 'none';
}

// ── Sim set loading ───────────────────────────────────────

function showSimMessage(icon, text, showLoginBtn = false) {
  const emptyState  = document.getElementById('emptyState');
  const pullResult  = document.getElementById('pullResult');
  if (pullResult) pullResult.classList.remove('active');
  if (emptyState) {
    emptyState.innerHTML = `
      <span class="icon">${icon}</span>
      <p>${text}</p>
      ${showLoginBtn ? '<button class="btn-open" id="btnLoginGate" style="margin-top:1rem;">🔑 Login con Google</button>' : ''}
    `;
    emptyState.style.display = '';
    if (showLoginBtn) {
      document.getElementById('btnLoginGate')?.addEventListener('click', () => {
        saveStateBeforeRedirect();
        signInWithGoogle();
      });
    }
  }
}

async function loadSimSet(code) {
  if (!code) return;

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_code', code);

  if (error) {
    showSimMessage('⚠', 'Errore caricando le carte: ' + error.message);
    return;
  }
  if (!data || data.length === 0) {
    showSimMessage('⚠', 'Nessuna carta trovata per il set ' + code);
    return;
  }

  S.setCode = code;

  S.DB = data.map(row => ({
    id:       Number(row.product_id),
    name:     row.name || '',
    num:      row.num || '',
    rarity:   row.rarity || 'C',
    color:    row.color || '',
    cardType: row.card_type || 'Character',
    sub:      row.sub || '',
    cost:     row.cost,
    power:    row.power,
    life:     row.life,
    attr:     row.attr || '',
    counter:  row.counter,
    desc:     row.description || '',
    url:      row.url || `https://www.tcgplayer.com/product/${row.product_id}`,
    imgRemote: row.img_remote || `https://tcgplayer-cdn.tcgplayer.com/product/${row.product_id}_400w.jpg`,
    isAlt:    !!row.is_alt,
    outOfSet: !!row.out_of_set
  }));

  buildPools();

  const setName = allSets.find(s => s.set_code === code)?.name || code;
  document.getElementById('setTitle').textContent =
    `Pack Simulator · ${code} · ${setName}`;

  resetAll();
  await loadFavs();

  // Se la card list non ha un set proprio, sincronizza con il sim set
  if (!S.clSetCode) {
    S.clCards = [...S.POOL];
    renderCardListGrid();
  }

  renderFavs();
}

// ── Card List set loading ─────────────────────────────────

async function loadClSet(code) {
  S.clSetCode = code;

  if (!code) {
    // Nessun set CL → usa il sim set se presente, altrimenti empty
    if (S.POOL.length > 0) {
      S.clCards = [...S.POOL];
    } else {
      S.clCards = [];
      showClEmpty(true);
      return;
    }
    renderCardListGrid();
    showClEmpty(false);
    return;
  }

  // Carica carte per il set CL
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('set_code', code);

  if (error || !data || data.length === 0) {
    S.clCards = [];
    showClEmpty(true);
    return;
  }

  S.clCards = data
    .filter(row => !row.out_of_set && !row.is_alt)
    .map(row => ({
      id:       Number(row.product_id),
      name:     row.name || '',
      num:      row.num || '',
      rarity:   row.rarity || 'C',
      color:    row.color || '',
      cardType: row.card_type || 'Character',
      sub:      row.sub || '',
      cost:     row.cost,
      power:    row.power,
      life:     row.life,
      attr:     row.attr || '',
      counter:  row.counter,
      desc:     row.description || '',
      url:      row.url || `https://www.tcgplayer.com/product/${row.product_id}`,
      imgRemote: row.img_remote || `https://tcgplayer-cdn.tcgplayer.com/product/${row.product_id}_400w.jpg`,
      isAlt:    !!row.is_alt,
      outOfSet: !!row.out_of_set
    }));

  showClEmpty(false);
  renderCardListGrid();
}

function showClEmpty(visible) {
  const el = document.getElementById('clEmpty');
  const grid = document.getElementById('clGrid');
  if (el)   el.style.display   = visible ? '' : 'none';
  if (grid) grid.style.display = visible ? 'none' : '';
}

// ── loadSets ──────────────────────────────────────────────

async function loadSets() {
  const { data, error } = await supabase
    .from('sets')
    .select('set_code,name,release_date');

  if (error || !data || data.length === 0) {
    const simSel = document.getElementById('simSetSelect');
    if (simSel) simSel.innerHTML = '<option value="">Errore caricamento set</option>';
    return;
  }

  allSets = data;
  populateSetSelects(data);
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  // Auth buttons
  document.getElementById('btnLogin').addEventListener('click', () => {
    saveStateBeforeRedirect();
    signInWithGoogle();
  });
  document.getElementById('btnLogout').addEventListener('click', signOut);

  // Sim set selector
  document.getElementById('simSetSelect').addEventListener('change', async (e) => {
    const code = e.target.value;
    if (code) await loadSimSet(code);
  });

  // Card List set selector
  document.getElementById('clSetSelect').addEventListener('change', async (e) => {
    await loadClSet(e.target.value);
  });

  // Escape key per modale
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(null, true);
  });

  // Carica lista set
  await loadSets();

  // Auth state listener (per cambi futuri: logout, ecc.)
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

  // Ripristina stato pre-login se torniamo da un redirect OAuth
  const restored = await restoreStateAfterRedirect();
  if (!restored) showClEmpty(true);
}

init();

// ── Window bridge per onclick inline ──────────────────────

window.openPacks = () => {
  if (!S.session?.user) {
    showSimMessage('🔒', 'Effettua il login per aprire le buste.', true);
    return;
  }
  if (!S.setCode) {
    showSimMessage('🎴', 'Seleziona un set dal pannello laterale per iniziare.');
    return;
  }
  _openPacks();
};

window.resetAll  = resetAll;
window.switchTab = switchTab;
window.applyFilters  = applyFilters;
window.resetFilters  = resetFilters;
window.openModal     = openModal;
window.closeModal    = closeModal;
window.modalToggleFav = modalToggleFav;
window.toggleFav     = toggleFav;
window.removeFav     = removeFav;
window.updateFavNote = updateFavNote;
window.clToggleFav   = clToggleFav;
window.exportCards   = exportCards;
