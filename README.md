# One Piece Card Game — Pack Simulator

Simulatore di apertura buste per il gioco di carte One Piece (OPCG).

## Features

- Simulazione pre-release con un modello empirico di buste dallo stesso box
- Card List completa per ogni set
- Sistema preferiti con note personali
- Filtri avanzati (rarita, colore, tipo, attributo, counter, subtype, power)
- 70+ set disponibili
- Login con Google
- Dashboard admin per import nuovi set

## Stack

- **Frontend**: Vanilla JS (ES Modules), HTML, CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Immagini**: CDN TCGPlayer
- **Dati**: tcgcsv.com (formato TCGPlayer)

## Modello delle aperture

Ogni clic su "Apri Buste" rappresenta un nuovo evento: da 1 a 24 buste
(6 iniziali), estratte senza reinserimento da un nuovo box virtuale di 24.
Il box non viene conservato tra aperture. Le statistiche di sessione sommano
gli eventi; il refresh ripristina solo l'ultimo risultato e le statistiche.

Il modello assume 7 SR base per box e 2 hit in 2/3 dei box, oppure 3 hit in 1/3.
Sulle sei buste, questo produce una probabilita del 49,60% di almeno una hit
e del 90,81% di almeno una SR base. Sono ipotesi empiriche approvate per il
simulatore, non garanzie Bandai o probabilita misurate specificamente per OP18.

Le 12 carte di una busta sono 7 C, 3 UC, 1 R e 1 R/SR/hit. Otto buste tra
quelle con due R ricevono un Leader base al posto di una C, se il set contiene
Leader base. Non e garantito ottenere tutti i Leader distinti. Le C, UC e R
di una stessa busta sono scelte senza duplicare la stessa carta; tra buste
diverse e possibile ottenere doppioni. Le DON!! non sono simulate.

La taratura delle hit usa questi pesi di partenza ogni 288 buste:

| Categoria | Peso |
|---|---:|
| SEC normale | 8 |
| AA ordinaria (esclusi Leader, SEC, Manga e TR) | 12 |
| SEC alternate | 2 |
| Leader alternate | 4 |
| SP | 2 |

Una AA ordinaria viene sostituita da una TR con probabilita 1/16.
Un Leader alternate o una SP vengono sostituiti da una Manga con probabilita
1/24. Con tutti i pool disponibili, le medie ogni 288 buste sono 0,75 TR e
0,25 Manga, comprese nelle 28 hit totali. All'interno di una categoria, le
carte disponibili sono equiprobabili; non si riproducono le combinazioni
specifiche di hit dei box fisici.

Le categorie assenti non vengono sorteggiate: i pesi delle altre sono
rinormalizzati e una sostituzione non disponibile viene saltata. In questi
casi le frequenze delle singole categorie differiscono dalla taratura
completa. I set con meno di 7 C, 3 UC, 2 R, una SR base o nessuna categoria
hit principale non possono essere aperti con questo modello: viene mostrato
un messaggio, senza sostituzioni artificiali o alterare la sessione.

La categoria hit e distinta dalla rarita stampata: una SR Manga conta come
hit, non come SR base. Le ristampe restano incluse anche con prefissi diversi.
Le cache di sessione del modello precedente non vengono ripristinate, per
evitare di mescolare statistiche con definizioni diverse.

Riferimenti empirici, da trattare come testimonianze con variabilita tra set:

- [Quote classiche e intervallo Manga](https://www.reddit.com/r/OnePieceTCG/comments/1fe5z48/one_piece_school_project/)
- [Composizione buste, Leader e sostituzioni Manga/TR](https://www.reddit.com/r/OnePieceTCG/comments/1jgnfii/a_casual_players_primer_on_booster_box_drop_rates/)

Verifica senza nuove dipendenze: `node scripts/test-simulator.mjs`.
Per includere i dati reali OP18, passare anche il percorso del JSON Products
tcgcsv: `node scripts/test-simulator.mjs percorso-products-OP18.json`.

## Setup Locale

1. Clona il repository
2. Copia `.env.example` in `.env` e inserisci le credenziali Supabase
3. Aggiorna `js/config.js` con URL e anon key Supabase
4. Servi con un server statico:
   ```bash
   npx serve
   # oppure
   python -m http.server 8000
   ```
5. Apri `http://localhost:8000`

## Struttura Progetto

```
index.html          App utente principale
admin.html          Dashboard admin
css/styles.css      Stili
js/
  app.js            Entry point utente
  admin.js          Entry point admin
  state.js          Stato globale condiviso
  config.js         Costanti + Supabase client
  auth.js           Autenticazione Google OAuth
  parser.js         Parsing JSON tcgcsv
  pools.js          Costruzione pool per rarita
  filters.js        Sistema filtri
  simulator.js      Motore simulazione buste
  render.js         Rendering UI
  modal.js          Modale dettaglio carta
  favorites.js      Gestione preferiti
  tabs.js           Navigazione tab
  export.js         Export carte
```
