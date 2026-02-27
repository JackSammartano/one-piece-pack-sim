/**
 * admin.js — Entry point dashboard admin
 * Gestisce import set da JSON tcgcsv verso Supabase.
 */
import { supabase } from './config.js';
import { signOut, getMyProfile } from './auth.js';
import { getExtended, parseDB } from './parser.js';
import { markOutOfSet } from './pools.js';

function setStatus(msg) {
  document.getElementById('adminStatus').textContent = msg;
}

function showError(msg) {
  const el = document.getElementById('adminError');
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('adminError');
  el.style.display = 'none';
  el.textContent = '';
}

/**
 * Verifica che l'utente sia admin. Redirect se non autorizzato.
 */
async function requireAdmin() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) {
    alert('Devi fare login dalla pagina principale, poi tornare qui.');
    location.href = './';
    return null;
  }
  const profile = await getMyProfile();
  if (!profile?.is_admin) {
    alert('Accesso negato (non admin).');
    location.href = './';
    return null;
  }
  document.getElementById('whoami').textContent = `Admin: ${session.user.email}`;
  return { session, profile };
}

/**
 * Upsert set nella tabella sets.
 */
async function upsertSet(set_code, name, release_date) {
  const { error } = await supabase.from('sets').upsert({
    set_code,
    name,
    release_date: release_date || null
  });
  if (error) throw error;
}

/**
 * Upsert carte nella tabella cards (batch da 500).
 */
async function upsertCards(set_code, cards) {
  const rows = cards.map(c => ({
    set_code,
    product_id: c.id,
    num: c.num,
    name: c.name,
    rarity: c.rarity,
    color: c.color,
    card_type: c.cardType,
    sub: c.sub,
    cost: c.cost,
    power: c.power,
    life: c.life,
    attr: c.attr,
    counter: c.counter,
    description: c.desc,
    img_remote: c.imgRemote,
    url: c.url,
    is_alt: !!c.isAlt,
    out_of_set: !!c.outOfSet
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('cards').upsert(chunk);
    if (error) throw error;
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsText(file);
  });
}

// ── Init ──────────────────────────────────────────────────
document.getElementById('btnLogout').addEventListener('click', signOut);

(async function init() {
  await requireAdmin();
  setStatus('Pronto. Inserisci dati set e carica JSON.');
})();

// ── Import ────────────────────────────────────────────────
document.getElementById('btnImport').addEventListener('click', async () => {
  clearError();
  setStatus('Import in corso…');

  try {
    const set_code = document.getElementById('aSetCode').value.trim();
    const name = document.getElementById('aSetName').value.trim();
    const release_date = document.getElementById('aRelease').value;
    const file = document.getElementById('aFile').files?.[0];

    if (!set_code) throw new Error('Set code mancante.');
    if (!name) throw new Error('Nome set mancante.');
    if (!file) throw new Error('JSON mancante.');

    const text = await readFileAsText(file);
    let raw = JSON.parse(text);
    if (raw && !Array.isArray(raw) && Array.isArray(raw.results)) raw = raw.results;
    if (!Array.isArray(raw) || raw.length === 0) throw new Error('JSON non contiene un array valido.');
    if (raw[0].productId == null) throw new Error('productId mancante nel JSON.');

    let cards = parseDB(raw);
    markOutOfSet(cards);

    await upsertSet(set_code, name, release_date);
    await upsertCards(set_code, cards);

    setStatus(`✅ Import completato. Set ${set_code}: ${cards.length} carte (incluse out-of-set).`);
  } catch (e) {
    showError(e.message || String(e));
    setStatus('Import fallito.');
  }
});
