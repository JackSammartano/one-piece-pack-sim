// Esegui: node scripts/test-simulator.mjs [percorso-products-OP18.json]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const readModule = name => readFileSync(new URL('../js/' + name, import.meta.url), 'utf8');
const stateUrl = moduleUrl(readModule('state.js'));
const configUrl = moduleUrl(readModule('config.js').match(
  /export const (?:CDN_BASE|COLOR_MAP|RARITY_RANK) = [\s\S]*?;/g
).join('\n'));
const { S } = await import(stateUrl);
const { parseDB } = await import(moduleUrl(readModule('parser.js').replace(
  "'./config.js'", JSON.stringify(configUrl)
)));
const poolsUrl = moduleUrl(
  readModule('pools.js').replace("'./state.js'", JSON.stringify(stateUrl))
);
const { buildPools, markOutOfSet, getHitType } = await import(poolsUrl);
const { openPacks, drawPackOutcomes } = await import(moduleUrl(
  readModule('simulator.js').replace("'./state.js'", JSON.stringify(stateUrl))
    .replace("'./pools.js'", JSON.stringify(poolsUrl))
));
const filtersUrl = moduleUrl(readModule('filters.js').replace("'./state.js'", JSON.stringify(stateUrl)));
const { renderCardListGrid, renderPullResult } = await import(moduleUrl(readModule('render.js')
  .replace("'./state.js'", JSON.stringify(stateUrl))
  .replace("'./config.js'", JSON.stringify(configUrl))
  .replace("'./filters.js'", JSON.stringify(filtersUrl))));

const elements = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: id === 'packCount' ? '1' : '', textContent: '', innerHTML: '',
      style: {}, classList: { add() {} }
    });
    return elements.get(id);
  }
};

function product(id, num, rarity, name = num) {
  return { productId: id, name, extendedData: [
    { name: 'Number', value: num }, { name: 'Rarity', value: rarity }
  ] };
}

function load(raw) {
  S.DB = markOutOfSet(parseDB(raw));
  S.sessionStats = { packs: 0, cards: 0, sr: 0, secSp: 0, hits: 0 };
  S.lastPulled = [];
  document.getElementById('packCount').value = '6';
  buildPools();
}

function completeSet() {
  const cards = [];
  const add = (num, rarity, name) => cards.push(product(cards.length + 1, num, rarity, name));
  for (let i = 1; i <= 7; i++) add(`OP18-00${i}`, 'C');
  for (let i = 8; i <= 10; i++) add(`OP18-${i}`, 'UC');
  add('OP18-011', 'R');
  add('OP18-012', 'R');
  add('OP18-013', 'SR');
  add('OP18-014', 'L');
  add('OP18-015', 'L');
  add('OP18-016', 'SEC');
  add('OP18-011', 'R', 'First (Alternate Art)');
  add('OP18-011', 'R', 'Second (Alternate Art)');
  add('OP18-016', 'SEC', 'Secret (Alternate Art)');
  add('OP18-014', 'L', 'Leader (Alternate Art)');
  add('OP13-113', 'R', 'Lilith (SP)');
  add('OP18-013', 'SR', 'Character (Manga)');
  add('OP18-012', 'R', 'Character (TR)');
  return cards;
}

function withRandom(random, run) {
  const original = Math.random;
  Math.random = random;
  try { return run(); } finally { Math.random = original; }
}

function seededRandom() {
  let seed = 123456789;
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('box virtuale: 7 SR base e 2 o 3 hit su 24 buste', () => {
  for (const [roll, hits] of [[0, 2], [2 / 3, 3]]) {
    const outcomes = withRandom(() => roll, () => drawPackOutcomes(24));
    assert.equal(outcomes.length, 24);
    assert.equal(outcomes.filter(r => r === 'SR').length, 7);
    assert.equal(outcomes.filter(r => r === 'HIT').length, hits);
    assert.equal(outcomes.filter(r => r === 'R').length, 17 - hits);
  }
  for (const count of [0, -1, 25, 6.5, NaN, Infinity, '6']) {
    assert.throws(() => drawPackOutcomes(count), RangeError);
  }
});

test('sei buste dallo stesso box seguono le distribuzioni ipergeometriche', () => {
  const events = 100000;
  const hitCounts = [0, 0, 0, 0];
  let srEvents = 0;
  let srTotal = 0;
  withRandom(seededRandom(), () => {
    for (let i = 0; i < events; i++) {
      const outcomes = drawPackOutcomes(6);
      assert.equal(outcomes.length, 6);
      const hits = outcomes.filter(r => r === 'HIT').length;
      const sr = outcomes.filter(r => r === 'SR').length;
      assert.ok(hits <= 3);
      hitCounts[hits]++;
      if (sr) srEvents++;
      srTotal += sr;
    }
  });
  const expected = [0.5039525691699605, 0.4120553359683794, 0.08069828722002635, 0.0032938076416337285];
  expected.forEach((probability, hits) => assert.ok(
    Math.abs(hitCounts[hits] / events - probability) < 0.005,
    `Distribuzione non coerente per ${hits} hit`
  ));
  assert.ok(Math.abs(srEvents / events - 0.9080507593093406) < 0.005);
  assert.ok(Math.abs(srTotal / events - 1.75) < 0.02);
});

test('alternate prima o dopo la base: la base rimane estraibile', () => {
  const base = product(1, 'OP18-119', 'SEC', 'Saint Shamrock');
  const alt = product(2, 'OP18-119', 'SEC', 'Saint Shamrock (Alternate Art)');
  for (const raw of [[alt, base], [base, alt]]) {
    const cards = parseDB(raw);
    assert.equal(cards.find(c => c.id === 1).isAlt, false);
    assert.equal(cards.find(c => c.id === 2).isAlt, true);
  }
  assert.deepEqual(parseDB([base, { ...base, productId: 3 }]).map(c => c.isAlt), [false, true]);
  assert.deepEqual(parseDB([]), []);
});

test('SP esplicite e ristampe mantengono il numero originale', () => {
  const cards = markOutOfSet(parseDB([
    product(1, 'OP18-001', 'L'), product(2, 'OP13-113', 'R', 'Lilith (SP)'),
    product(3, 'OP13-012', 'R', 'Vivi (SP)'), product(4, 'OP18-004', 'R', 'Ordinary Rare')
  ]));
  assert.deepEqual(cards.map(c => c.rarity), ['L', 'SP', 'SP', 'R']);
  assert.equal(cards[1].num, 'OP13-113');
  assert.ok(cards.every(c => c.outOfSet === false));
  assert.deepEqual(markOutOfSet([]), []);
});

test('categorie hit distinte, alternate multiple e ristampe senza base conservate', () => {
  load([
    product(1, 'OP18-004', 'R'), product(2, 'OP18-004', 'R', 'Alt (Alternate Art)'),
    product(3, 'OP18-004', 'R', 'Second Alt (Alternate Art)'),
    product(4, 'OP17-119', 'SEC', 'Loki (Alternate Art)'), product(5, 'OP18-002', 'UC')
  ]);
  assert.deepEqual(S.ALT_MAP['OP18-004|R'].map(c => c.id), [2, 3]);
  assert.deepEqual(S.pools.hits.SEC_AA.map(c => c.id), [4]);
  assert.deepEqual(S.pools.hits.AA.map(c => c.id), [2, 3]);
  assert.deepEqual(S.pools.UC.map(c => c.id), [5]);
  assert.equal(S.POOL.some(c => c.id === 4), false); // Card List aggiunge gia le alternate.
  S.DB.find(c => c.id === 4).outOfSet = true;
  buildPools();
  assert.deepEqual(S.pools.hits.SEC_AA, []); // Le esclusioni del DB restano rispettate.
});

test('box completo: 12 carte per busta, 7 SR base, 8 Leader e solo 2 o 3 hit', () => {
  for (const [roll, hits] of [[0, 2], [2 / 3, 3]]) {
    load(completeSet());
    document.getElementById('packCount').value = '24';
    withRandom(() => roll, openPacks);
    assert.equal(S.lastPulled.length, 288);
    assert.equal(S.sessionStats.sr, 7);
    assert.equal(S.sessionStats.hits, hits);
    assert.equal(S.lastPulled.filter(c => c.rarity === 'L' && !getHitType(c)).length, 8);
    assert.equal(S.lastPulled.filter(c => c.rarity === 'R' && !getHitType(c)).length, 48 - 7 - hits);
    for (let i = 0; i < 24; i++) {
      const pack = S.lastPulled.slice(i * 12, i * 12 + 12);
      const leader = pack.some(c => c.rarity === 'L' && !getHitType(c));
      assert.equal(pack.filter(c => c.rarity === 'C').length, leader ? 6 : 7);
      assert.equal(pack.filter(c => c.rarity === 'UC').length, 3);
      assert.equal(new Set(pack.map(c => c.id)).size, 12);
      if (leader) assert.equal(pack.filter(c => c.rarity === 'R').length, 2);
    }
  }
});

test('Manga e TR non entrano nei pool base, anche senza flag alternate', () => {
  load(completeSet());
  const manga = S.DB.find(c => /Manga/.test(c.name));
  const treasure = S.DB.find(c => /TR/.test(c.name));
  manga.isAlt = false;
  treasure.isAlt = false;
  buildPools();
  assert.equal(getHitType(manga), 'MANGA');
  assert.equal(getHitType(treasure), 'TR');
  assert.ok(!S.pools.SR.includes(manga));
  assert.ok(!S.pools.R.includes(treasure));
  assert.deepEqual(S.pools.hits.MANGA.map(c => c.id), [manga.id]);
  assert.deepEqual(S.pools.hits.TR.map(c => c.id), [treasure.id]);
});

test('richieste non valide e pool insufficienti non alterano sessione o risultati', () => {
  load(completeSet());
  openPacks();
  const stats = { ...S.sessionStats };
  const pulled = S.lastPulled;
  for (const value of ['0', '25', '6.5', 'abc', '']) {
    document.getElementById('packCount').value = value;
    openPacks();
    assert.deepEqual(S.sessionStats, stats);
    assert.equal(S.lastPulled, pulled);
    assert.equal(document.getElementById('simError').style.display, 'block');
  }
  document.getElementById('packCount').value = '6';
  S.pools.UC = [];
  openPacks();
  assert.deepEqual(S.sessionStats, stats);
  assert.equal(S.lastPulled, pulled);
  assert.match(document.getElementById('simError').textContent, /pool necessari/);
});

test('pool mancanti: pesi rinormalizzati sulle hit disponibili, senza fallback alle SR', () => {
  load(completeSet().filter(p => !/\(SP\)|\(Manga\)|\(TR\)/.test(p.name)));
  document.getElementById('packCount').value = '24';
  withRandom(seededRandom(), openPacks);
  assert.equal(S.lastPulled.length, 288);
  assert.equal(S.sessionStats.sr, 7);
  assert.ok(S.sessionStats.hits === 2 || S.sessionStats.hits === 3);
  assert.ok(S.lastPulled.every(c => c && !['SP', 'MANGA', 'TR'].includes(getHitType(c))));
});

test('taratura empirica e sostituzioni Manga/TR: frequenze coerenti su 30.000 eventi', () => {
  load(completeSet());
  const events = 30000;
  const counts = {};
  let hitEvents = 0;
  let srEvents = 0;
  withRandom(seededRandom(), () => {
    for (let i = 0; i < events; i++) {
      openPacks();
      let hits = 0;
      let sr = 0;
      S.lastPulled.forEach(c => {
        const type = getHitType(c);
        if (type) { counts[type] = (counts[type] || 0) + 1; hits++; }
        else if (c.rarity === 'SR') sr++;
      });
      assert.ok(hits <= 3);
      if (hits) hitEvents++;
      if (sr) srEvents++;
    }
  });
  // Valori ogni 288 buste, dopo le sostituzioni; la somma resta 28 hit.
  const expected = { SEC: 8, AA: 11.25, SEC_AA: 2, LEADER_AA: 23 / 6, SP: 23 / 12, MANGA: 0.25, TR: 0.75 };
  for (const [type, perCase] of Object.entries(expected)) {
    const observed = (counts[type] || 0) * 288 / (events * 6);
    assert.ok(Math.abs(observed - perCase) < Math.max(0.08, perCase * 0.06), `${type}: ${observed}`);
  }
  assert.ok(Math.abs(hitEvents / events - 0.4960474308300395) < 0.012);
  assert.ok(Math.abs(srEvents / events - 0.9080507593093406) < 0.012);
  assert.equal(S.sessionStats.hits, Object.values(counts).reduce((sum, n) => sum + n, 0));
});

test('Card List senza duplicati e filtri/riepiloghi Uncommon funzionanti', () => {
  load([
    product(1, 'OP18-004', 'R'), product(2, 'OP18-004', 'R', 'Alt (Alternate Art)'),
    product(3, 'OP17-119', 'SEC', 'Loki (Alternate Art)'), product(4, 'OP18-002', 'UC')
  ]);
  renderCardListGrid();
  assert.equal(document.getElementById('filterActiveCount').textContent, '4 carte');
  assert.equal((document.getElementById('clGrid').innerHTML.match(/class="cl-card /g) || []).length, 4);
  document.getElementById('fRarity').value = 'UC';
  try {
    renderCardListGrid();
    assert.equal(document.getElementById('filterActiveCount').textContent, '1 / 4 carte');
    assert.match(document.getElementById('clGrid').innerHTML, /badge-UC/);
    renderPullResult([S.DB.find(c => c.rarity === 'UC')], 1);
    assert.match(document.getElementById('raritySummary').innerHTML, /<strong>1<\/strong>&nbsp;UC/);
  } finally { document.getElementById('fRarity').value = ''; }
});

test('OP18 reale: ogni prodotto carta e estraibile, ristampe incluse', { skip: !process.argv[2] }, () => {
  const payload = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  load(payload.results || payload);
  assert.equal(new Set(S.DB.filter(c => c.num.startsWith('OP18-') && !c.isAlt).map(c => c.num)).size, 119);
  assert.ok(S.DB.every(c => !c.outOfSet));
  assert.ok(S.pools.hits.SP.some(c => c.num === 'OP13-113'));
  assert.ok(S.pools.hits.SP.some(c => c.num === 'OP13-012'));
  assert.ok(S.pools.hits.SEC_AA.some(c => c.num === 'OP17-119'));
  const pulled = new Set();
  withRandom(seededRandom(), () => {
    for (let i = 0; i < 20000; i++) {
      openPacks();
      assert.equal(S.lastPulled.length, 72);
      S.lastPulled.forEach(c => pulled.add(c.id));
    }
  });
  assert.deepEqual([...pulled].sort((a, b) => a - b), S.DB.map(c => c.id).sort((a, b) => a - b));
  assert.equal(S.sessionStats.packs, 120000);
  assert.equal(S.sessionStats.cards, 1440000);
});

test('importatori JavaScript e Python coerenti su OP18', { skip: !process.argv[2] }, () => {
  // Eseguiamo solo parser e marcatura, senza richieste HTTP o dipendenze Python esterne.
  const python = `
import ast, json, re, sys
from pathlib import Path
source = ast.parse(Path('scripts/import-sets.py').read_text(encoding='utf-8'))
functions = [n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in
             ('get_extended', 'safe_int', 'parse_cards', 'mark_out_of_set')]
namespace = {'re': re, 'CDN_BASE': 'https://tcgplayer-cdn.tcgplayer.com/product'}
exec(compile(ast.Module(body=functions, type_ignores=[]), '<import-parser>', 'exec'), namespace)
payload = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
cards = namespace['mark_out_of_set'](namespace['parse_cards'](payload['results']))
print(json.dumps([{'id': c['product_id'], 'num': c['num'], 'rarity': c['rarity'],
                   'isAlt': c['is_alt'], 'outOfSet': c['out_of_set']} for c in cards]))
`;
  const result = spawnSync('python', ['-c', python, process.argv[2]], {
    encoding: 'utf8', cwd: new URL('..', import.meta.url)
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  load(JSON.parse(readFileSync(process.argv[2], 'utf8')).results);
  assert.deepEqual(JSON.parse(result.stdout), S.DB.map(({ id, num, rarity, isAlt, outOfSet }) =>
    ({ id, num, rarity, isAlt, outOfSet })));
});
