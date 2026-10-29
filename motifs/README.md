# Motive austauschen

Kartengrafiken sind Platzhalter. Echte Motive hier ablegen und in `src/game.js` in `MOTIFS` verknüpfen.

## Idealformat (für Daniel)

| | Empfehlung |
|---|---|
| Format | **PNG** mit Transparenz (oder SVG) |
| Größe | **512×512 px** (mindestens 256×256), quadratisch |
| Motiv | zentriert, ca. **10 % Rand** frei |
| Farbe | dunkles Grau **`#505050`** auf transparent; dezente Akzente ok (Farbringe, LED) |
| Varianten | pro Bauteil **zwei** Dateien: Bauteil + Schaltsymbol |

## Dateinamen-Vorschlag

```
motifs/resistor-part.png
motifs/resistor-symbol.png
motifs/led-part.png
motifs/led-symbol.png
…
```

IDs in `MOTIFS` / `PART_IDS`:  
`resistor`, `ceramic`, `elko`, `led`, `diode`, `transistor`, `ic`, `coil`, `switch`, `pot`, `crystal`, `battery`, `speaker`

## Einbinden

In `src/game.js`:

```js
resistor: { label: "widerstand", part: "motifs/resistor-part.png", symbol: "motifs/resistor-symbol.png" },
```

Oder als Data-URI (`data:image/png;base64,…`) — dann offline ohne Extra-Dateien.  
`part`/`symbol` = `null` → Canvas-Platzhalter.

Danach: `python3 build.py` (bei Data-URI) bzw. bei Dateipfaden `python3 build.py --pages` und Dateien mit ausliefern.
