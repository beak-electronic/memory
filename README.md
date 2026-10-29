# BEAK Memory V1.04

Ein-Datei HTML/Canvas-Minispiel (Schwester von BEAK Breakout / Leiterbahn-Puzzle / Lötkolben-Tetris).

## Lokal

```bash
python3 build.py                 # → index.html (fonts+audio inline)
python3 build.py --pages         # + Manifest/Icon-Links
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node tests/playwright.test.js
```

## Sounds (Ava)

| Event | Clip |
|-------|------|
| Spiel-/Levelstart | `los-gehts.mp3` („Los geht's“) |
| Paar gefunden | `prima.mp3` |
| Kein Paar | `nee.mp3` |

## Steuerung

- **Tastatur:** Pfeiltasten Auswahl, Enter/Leertaste aufdecken, Esc Pause/Zurück
- **Maus / Touch:** Tippen auf Karte

## Level

**level 01 … level 10:** steigende Paaranzahl; früh identische Bauteilpaare, später Bauteil + Schaltsymbol.

## Bestenliste

Lokal in `localStorage`. Online-Supabase-Anbindung vorbereitet, ohne Zugangsdaten deaktiviert.

## Motive

Siehe `motifs/README.md`. Zentrale Liste `MOTIFS` in `src/game.js` — Platzhalter bis eigene Grafiken kommen.
Ideal: PNG 512×512, transparent, Motiv `#505050`, Dateien `motifs/<id>-part.png` / `-symbol.png`.

## Hinweis Pfad

Live: `https://beak-electronic.github.io/memory/` (Manifest id/start_url/scope `/memory/`). Lokaler Arbeitsordner bleibt `bestueckungs-memory/`.
