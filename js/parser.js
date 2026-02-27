/**
 * parser.js — Parsing JSON tcgcsv
 * Trasforma i dati grezzi TCGPlayer in oggetti carta normalizzati.
 */
import { CDN_BASE } from './config.js';

/**
 * Cerca un campo per nome nell'array extendedData.
 * @param {Object} card - Prodotto grezzo TCGPlayer
 * @param {string} name - Nome del campo (es. "Number", "Rarity")
 * @returns {*} Valore del campo o null
 */
export function getExtended(card, name) {
  if (!card.extendedData) return null;
  const f = card.extendedData.find(e => e.name === name);
  return f ? f.value : null;
}

/**
 * Trasforma un array di prodotti TCGPlayer in carte normalizzate.
 * Gestisce varianti di campo (CardType/Card Type, Subtypes/Subtype(s)).
 * Rileva alt art (nome o duplicato num|rarity).
 * Filtra voci senza numero o rarita (bundle/box commerciali).
 *
 * @param {Array} raw - Array di prodotti grezzi da tcgcsv
 * @returns {Array} Carte normalizzate
 */
export function parseDB(raw) {
  const entries = raw.map(p => {
    const num      = getExtended(p, 'Number') || '';
    const rarity   = getExtended(p, 'Rarity') || 'C';
    const color    = getExtended(p, 'Color') || '';
    const cardType = getExtended(p, 'CardType') || getExtended(p, 'Card Type') || 'Character';
    const sub      = getExtended(p, 'Subtypes') || getExtended(p, 'Subtype(s)') || '';
    const cost     = getExtended(p, 'Cost');
    const power    = getExtended(p, 'Power');
    const life     = getExtended(p, 'Life');
    const attr     = getExtended(p, 'Attribute') || '';
    const counter  = getExtended(p, 'Counterplus');
    const desc     = getExtended(p, 'Description') || '';
    const name     = p.cleanName || p.name || '';

    const isAlt = !!(
      (p.name || '').toLowerCase().includes('alternate') ||
      (p.name || '').toLowerCase().includes('alt art') ||
      (p.cleanName || '').toLowerCase().includes('alternate') ||
      (getExtended(p, 'Finish') || '').toLowerCase().includes('alternate')
    );

    const imgUrl = p.imageUrl || `${CDN_BASE}/${p.productId}_400w.jpg`;

    return {
      id: p.productId,
      name,
      num,
      rarity,
      color,
      cardType,
      sub,
      cost: cost != null && cost !== '' ? Number(cost) : null,
      power: power != null && power !== '' ? Number(power) : null,
      life: life != null && life !== '' ? Number(life) : null,
      attr,
      counter: counter != null && counter !== '' ? Number(counter) : null,
      desc,
      url: `https://www.tcgplayer.com/product/${p.productId}`,
      imgRemote: imgUrl,
      isAlt
    };
  }).filter(c => c.num && c.rarity);

  // Secondo passaggio: duplicati num|rarity → marca come alt art
  const seen = {};
  entries.forEach(c => {
    const k = c.num + '|' + c.rarity;
    if (seen[k]) c.isAlt = true;
    else seen[k] = true;
  });

  return entries;
}
