# One Piece Card Game — Pack Simulator

Simulatore di apertura buste per il gioco di carte One Piece (OPCG).

## Features

- Simulazione apertura buste con probabilita realistiche per rarita
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
