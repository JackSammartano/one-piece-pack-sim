"""
import-sets.py — Importa tutti i 70 set da JSON locali verso Supabase.

Uso:
  python scripts/import-sets.py

Legge tutti i products.json dalla cartella sorgente,
li parsifica con la stessa logica di parser.js,
e li carica su Supabase (upsert set + cards).

Richiede: pip install requests   (gia presente)
"""

import os, sys, json, re, time, requests

# ── Config ────────────────────────────────────────────────────
SUPABASE_URL = 'https://jqrqxasfbmusxtwnwwgo.supabase.co'
SUPABASE_ANON_KEY = (
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
    'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnF4YXNmYm11c3h0d253d2dvIiwi'
    'cm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzAxMTYsImV4cCI6MjA4NzgwNjExNn0.'
    'dbcjo-_Ai5xw_am-F0pKY23dO8bKOwbLuW3u_gxXJHU'
)

# Per import bulk serve il service_role key (bypassa RLS)
# Prendi da: Supabase > Settings > API > service_role (secret)
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

SET_SOURCE_DIR = r'C:\Users\jacks\Desktop\one piece simulator\set\onepiece_products_only'

CDN_BASE = 'https://tcgplayer-cdn.tcgplayer.com/product'

HEADERS = {
    'apikey': '',       # impostata in main()
    'Authorization': '',
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
}

# ── Parser (replica di parser.js) ─────────────────────────────

def get_extended(card, name):
    for ed in card.get('extendedData', []):
        if ed.get('name') == name:
            return ed.get('value')
    return None

def safe_int(val):
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None

def parse_cards(raw):
    """Trasforma array prodotti TCGPlayer in carte normalizzate."""
    entries = []
    for p in raw:
        num = get_extended(p, 'Number') or ''
        is_special = any(re.search(r'\(SP\)', p.get(field) or '', re.IGNORECASE)
                         for field in ('name', 'cleanName'))
        rarity = 'SP' if is_special else get_extended(p, 'Rarity') or 'C'
        color = get_extended(p, 'Color') or ''
        card_type = get_extended(p, 'CardType') or get_extended(p, 'Card Type') or 'Character'
        sub = get_extended(p, 'Subtypes') or get_extended(p, 'Subtype(s)') or ''
        cost = get_extended(p, 'Cost')
        power = get_extended(p, 'Power')
        life = get_extended(p, 'Life')
        attr = get_extended(p, 'Attribute') or ''
        counter = get_extended(p, 'Counterplus')
        desc = get_extended(p, 'Description') or ''
        name = p.get('cleanName') or p.get('name') or ''

        raw_name = (p.get('name') or '').lower()
        clean_name = (p.get('cleanName') or '').lower()
        finish = (get_extended(p, 'Finish') or '').lower()
        is_alt = ('alternate' in raw_name or 'alt art' in raw_name or
                  'alternate' in clean_name or 'alternate' in finish)

        product_id = p.get('productId')
        raw_img = p.get('imageUrl') or f'{CDN_BASE}/{product_id}_400w.jpg'
        img_url = raw_img.replace('_200w.jpg', '_400w.jpg')

        if not num or not rarity:
            continue

        entries.append({
            'product_id': product_id,
            'name': name,
            'num': num,
            'rarity': rarity,
            'color': color,
            'card_type': card_type,
            'sub': sub,
            'cost': safe_int(cost),
            'power': safe_int(power),
            'life': safe_int(life),
            'attr': attr,
            'counter': safe_int(counter),
            'description': desc,
            'url': f'https://www.tcgplayer.com/product/{product_id}',
            'img_remote': img_url,
            'is_alt': is_alt
        })

    # Secondo passaggio: duplicati num|rarity -> marca come alt art
    seen = set()
    for c in entries:
        if c['is_alt']:
            continue
        k = c['num'] + '|' + c['rarity']
        if k in seen:
            c['is_alt'] = True
        else:
            seen.add(k)

    return entries

def mark_out_of_set(cards):
    """Include tutte le carte del gruppo importato, comprese le ristampe."""
    for c in cards:
        c['out_of_set'] = False

    return cards

# ── Supabase API ──────────────────────────────────────────────

def supabase_post(table, rows):
    """Upsert righe su Supabase via REST API."""
    url = f'{SUPABASE_URL}/rest/v1/{table}'
    # Batch da 500
    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i+chunk_size]
        r = requests.post(url, headers=HEADERS, json=chunk)
        if r.status_code not in (200, 201):
            raise Exception(f'Errore upsert {table} (chunk {i}): {r.status_code} {r.text}')

def upsert_set(set_code, name):
    """Upsert un set nella tabella sets."""
    supabase_post('sets', [{'set_code': set_code, 'name': name}])

def upsert_cards(set_code, cards):
    """Upsert carte nella tabella cards."""
    rows = []
    for c in cards:
        row = dict(c)
        row['set_code'] = set_code
        rows.append(row)
    supabase_post('cards', rows)

# ── Estrazione set_code dal nome cartella ─────────────────────

def extract_set_code(cards):
    """Estrae il set code dal prefisso dominante delle carte (es. OP02, ST01, EB03)."""
    prefix_count = {}
    for c in cards:
        p = c['num'].split('-')[0] if c['num'] else ''
        if p:
            prefix_count[p] = prefix_count.get(p, 0) + 1

    if prefix_count:
        return max(prefix_count, key=prefix_count.get)
    return None

# ── Main ──────────────────────────────────────────────────────

def main():
    if not SUPABASE_SERVICE_KEY:
        print('=' * 60)
        print('ERRORE: Serve la service_role key per bypassare RLS.')
        print()
        print('1. Vai su Supabase > Settings > API')
        print('2. Copia la "service_role" key (quella secret, NON la anon)')
        print('3. Esegui:')
        print()
        print(f'  set SUPABASE_SERVICE_KEY=la-tua-key-qui')
        print(f'  python scripts/import-sets.py')
        print()
        print('oppure su bash/Git Bash:')
        print()
        print(f'  SUPABASE_SERVICE_KEY=la-tua-key-qui python scripts/import-sets.py')
        print('=' * 60)
        sys.exit(1)

    HEADERS['apikey'] = SUPABASE_SERVICE_KEY
    HEADERS['Authorization'] = f'Bearer {SUPABASE_SERVICE_KEY}'

    if not os.path.isdir(SET_SOURCE_DIR):
        print(f'Cartella set non trovata: {SET_SOURCE_DIR}')
        sys.exit(1)

    folders = sorted([
        d for d in os.listdir(SET_SOURCE_DIR)
        if os.path.isdir(os.path.join(SET_SOURCE_DIR, d))
    ])

    print(f'Trovate {len(folders)} cartelle set.')
    print()

    success = 0
    errors = []

    for i, folder in enumerate(folders, 1):
        json_path = os.path.join(SET_SOURCE_DIR, folder, 'products.json')
        if not os.path.isfile(json_path):
            print(f'  [{i}/{len(folders)}] SKIP {folder} (no products.json)')
            continue

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Supporta formato { results: [...] } o array diretto
            if isinstance(data, dict) and 'results' in data:
                raw = data['results']
            elif isinstance(data, list):
                raw = data
            else:
                raise ValueError('Formato JSON non riconosciuto')

            cards = parse_cards(raw)
            if not cards:
                print(f'  [{i}/{len(folders)}] SKIP {folder} (0 carte valide)')
                continue

            mark_out_of_set(cards)

            set_code = extract_set_code(cards)
            if not set_code:
                raise ValueError('Impossibile determinare set_code')

            # Nome set dal folder: "17698 - Paramount War" -> "Paramount War"
            set_name = folder.split(' - ', 1)[1] if ' - ' in folder else folder

            upsert_set(set_code, set_name)
            upsert_cards(set_code, cards)

            in_set = sum(1 for c in cards if not c['out_of_set'])
            out_set = sum(1 for c in cards if c['out_of_set'])
            print(f'  [{i}/{len(folders)}] OK  {set_code:8s} {set_name:50s} {len(cards):4d} carte ({in_set} in-set, {out_set} out-of-set)')
            success += 1

        except Exception as e:
            print(f'  [{i}/{len(folders)}] ERR {folder}: {e}')
            errors.append((folder, str(e)))

    print()
    print(f'Completato: {success}/{len(folders)} set importati.')
    if errors:
        print(f'\nErrori ({len(errors)}):')
        for folder, msg in errors:
            print(f'  - {folder}: {msg}')

if __name__ == '__main__':
    main()
