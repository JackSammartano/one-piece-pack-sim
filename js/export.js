/**
 * export.js — Export carte in formato deck-list
 */
import { S } from './state.js';

/**
 * Copia negli appunti le carte estratte in formato deck-list.
 * Formato: "2 EB03-001 Nefeltari Vivi"
 */
function buildExportText() {
  const cnt = {};
  const byK = {};
  S.lastPulled.forEach(c => {
    const k = c.num + '|' + c.name;
    cnt[k] = (cnt[k] || 0) + 1;
    byK[k] = c;
  });
  return Object.entries(cnt)
    .map(([k, q]) => { const c = byK[k]; return `${q} ${c.num} ${c.name}`; })
    .join('\n');
}

function copyToClipboard(txt, btnId, label) {
  navigator.clipboard.writeText(txt).then(() => {
    const b = document.getElementById(btnId);
    b.textContent = '✓ Copiato!';
    b.classList.add('copied');
    setTimeout(() => { b.textContent = label; b.classList.remove('copied'); }, 2000);
  }).catch(() => {
    const t = document.createElement('textarea');
    t.value = txt;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
  });
}

export function exportCards() {
  if (!S.lastPulled.length) return;
  copyToClipboard(buildExportText(), 'btnExport', '📋 Esporta');
}

export function exportCardsWithRainbow() {
  if (!S.lastPulled.length) return;
  const txt = buildExportText() + '\n1xP-999';
  copyToClipboard(txt, 'btnExportRainbow', '🌈 Esporta con Rainbow Luffy');
}
