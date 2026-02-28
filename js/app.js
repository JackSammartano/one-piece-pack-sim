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

function populateSetSelects(sets) {
  const html = buildSetOptions(sets);
  const simSel = document.getElementById('simSetSelect');
  const clSel  = document.getElementById('clSetSelect');
  if (simSel) simSel.innerHTML = html;
  if (clSel)  clSel.innerHTML  = html;
}

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

function showSimMessage(icon, text, showLoginBtn = false) {
  const emptyState = document.getElementById('emptyState');
  const pullResult = document.getElementById('pullResult');
  if (pullResult) pullResult.classList.remove('active');
  if (emptyState) {
    emptyState.innerHTML = `
      <span class="icon">${icon}</span>
      <p>${text}</p>
      ${showLoginBtn ? '<button class="btn-open" id="btnLoginGate" style="margin-top:1rem;">🔑 Login con Google</button>' : ''}
    `;
    emptyState.style.display = '';
    if (showLoginBtn) {
      document.getElementById('btnLoginGate')?.addEventListener('click', signInWithGoogle);
    }
  }
}

function showClEmpty(visible) {
  const el   = document.getElementById('clEmpty');
  const grid = document.getElementById('clGrid');
  if (el)   el.style.display   = visible ? '' : 'none';
  if (grid) grid.style.display = visible ? 'none' : '';
}

// ── Set loading ───────────────────────────────────────────

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

async function loadSimSet(code) {
  if (!code) return;

  const { data, error } = await supabase
    .from('cards').select('*').eq('set_code', code);

  if (error) { showSimMessage('⚠', 'Errore caricando le carte: ' + error.message); return; }
  if (!data || data.length === 0) { showSimMessage('⚠', 'Nessuna carta trovata per ' + code); return; }

  S.setCode = code;
  S.DB = data.map(rowToCard);
  buildPools();

  const setName = allSets.find(s => s.set_code === code)?.name || code;
  document.getElementById('setTitle').textContent = `Pack Simulator · ${code} · ${setName}`;

  resetAll();
  await loadFavs();

  // Sincronizza Card List con il set del simulatore (se non ha un set proprio)
  if (!S.clSetCode) {
    S.clCards = [...S.POOL];
    const clSel = document.getElementById('clSetSelect');
    if (clSel) clSel.value = code;
    showClEmpty(false);
    renderCardListGrid();
  }

  renderFavs();
}

async function loadClSet(code) {
  S.clSetCode = code;

  if (!code) {
    // Torna al set del simulatore se presente
    if (S.POOL.length > 0) {
      S.clCards = [...S.POOL];
      showClEmpty(false);
      renderCardListGrid();
    } else {
      S.clCards = [];
      showClEmpty(true);
    }
    return;
  }

  const { data, error } = await supabase
    .from('cards').select('*')
    .eq('set_code', code)
    .eq('is_alt', false)
    .eq('out_of_set', false);

  if (error || !data || data.length === 0) {
    S.clCards = [];
    showClEmpty(true);
    return;
  }

  S.clCards = data.map(rowToCard);
  showClEmpty(false);
  renderCardListGrid();
}

// ── Init ──────────────────────────────────────────────────

async function init() {
  document.getElementById('btnLogin').addEventListener('click', signInWithGoogle);
  document.getElementById('btnLogout').addEventListener('click', signOut);

  document.getElementById('simSetSelect').addEventListener('change', async (e) => {
    if (e.target.value) await loadSimSet(e.target.value);
  });

  document.getElementById('clSetSelect').addEventListener('change', async (e) => {
    await loadClSet(e.target.value);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal(null, true);
  });

  await loadSets();
  showClEmpty(true);

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

// ── Entry point: popup OAuth o app normale ────────────────
// Se la pagina è aperta come popup (dopo redirect OAuth di Google),
// Supabase processa i token dall'URL e chiude il popup.
// La finestra principale riceve la sessione via onAuthStateChange.

if (window.opener && window.opener !== window) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') window.close();
  });
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.close();
  });
} else {
  init();
}
