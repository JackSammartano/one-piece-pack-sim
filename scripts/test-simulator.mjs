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
const { buildPools, markOutOfSet } = await import(moduleUrl(
  readModule('pools.js').replace("'./state.js'", JSON.stringify(stateUrl))
));
const { openPacks } = await import(moduleUrl(
  readModule('simulator.js').replace("'./state.js'", JSON.stringify(stateUrl))
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
  S.sessionStats = { packs: 0, cards: 0, sr: 0, secSp: 0 };
  buildPools();
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

test('tutte le alternate sono conservate; quelle senza base sono candidati diretti', () => {
  load([
    product(1, 'OP18-004', 'R'), product(2, 'OP18-004', 'R', 'Alt (Alternate Art)'),
    product(3, 'OP18-004', 'R', 'Second Alt (Alternate Art)'),
    product(4, 'OP17-119', 'SEC', 'Loki (Alternate Art)'), product(5, 'OP18-002', 'UC')
  ]);
  assert.deepEqual(S.ALT_MAP['OP18-004|R'].map(c => c.id), [2, 3]);
  assert.deepEqual(S.pools.SEC.map(c => c.id), [4]);
  assert.deepEqual(S.pools.UC.map(c => c.id), [5]);
  assert.equal(S.POOL.some(c => c.id === 4), false); // Card List aggiunge gia le alternate.
  S.DB.find(c => c.id === 4).outOfSet = true;
  buildPools();
  assert.deepEqual(S.pools.SEC, []); // Le esclusioni gia salvate nel DB restano rispettate.
});

test('le soglie dello slot speciale restano invariate', () => {
  load(['SEC', 'SP', 'SR', 'L', 'R', 'C', 'UC'].map((r, i) => product(i + 1, 'OP18-' + i, r)));
  for (const [roll, expected] of [
    [0, 'SEC'], [0.00199, 'SEC'], [0.002, 'SP'], [0.00699, 'SP'],
    [0.007, 'SR'], [0.35699, 'SR'], [0.357, 'L'], [0.40699, 'L'], [0.407, 'R']
  ]) {
    let first = true;
    withRandom(() => { if (first) { first = false; return roll; } return 0.9; }, openPacks);
    assert.equal(S.lastPulled.length, 12);
    assert.equal(S.lastPulled[0].rarity, expected);
    assert.ok(S.lastPulled.slice(1).every(c => c.rarity === 'UC'));
  }
});

test('soglia alternate 30%, entrambe le varianti raggiungibili', () => {
  load([
    product(1, 'OP18-004', 'R'), product(2, 'OP18-004', 'R', 'Alt (Alternate Art)'),
    product(3, 'OP18-004', 'R', 'Second Alt (Alternate Art)'), product(4, 'OP18-003', 'C')
  ]);
  for (const [altRoll, variantRoll, expected] of [[0.29, 0, 2], [0.29, 0.99, 3], [0.30, 0, 1]]) {
    const rolls = [0.9, 0, altRoll, variantRoll];
    withRandom(() => rolls.length ? rolls.shift() : 0.9, openPacks);
    assert.equal(S.lastPulled[0].id, expected);
  }
});

test('fallback SEC, SP e Leader funzionano nei set che non li contengono', () => {
  load([product(1, 'OP01-001', 'SR'), product(2, 'OP01-002', 'R'), product(3, 'OP01-003', 'C')]);
  for (const [roll, expected] of [[0, 'SR'], [0.003, 'SR'], [0.36, 'R']]) {
    let first = true;
    withRandom(() => { if (first) { first = false; return roll; } return 0.9; }, openPacks);
    assert.equal(S.lastPulled[0].rarity, expected);
    assert.ok(S.lastPulled.slice(1).every(c => c.rarity === 'C'));
  }
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
  assert.ok(S.pools.SP.some(c => c.num === 'OP13-113'));
  assert.ok(S.pools.SP.some(c => c.num === 'OP13-012'));
  assert.ok(S.pools.SEC.some(c => c.num === 'OP17-119'));
  const pulled = new Set();
  withRandom(seededRandom(), () => {
    for (let i = 0; i < 20000; i++) {
      openPacks();
      assert.equal(S.lastPulled.length, 12);
      S.lastPulled.forEach(c => pulled.add(c.id));
    }
  });
  assert.deepEqual([...pulled].sort((a, b) => a - b), S.DB.map(c => c.id).sort((a, b) => a - b));
  assert.equal(S.sessionStats.packs, 20000);
  assert.equal(S.sessionStats.cards, 240000);
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
