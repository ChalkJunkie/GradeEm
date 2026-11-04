# Grade’Em-Rasterformat (Version 1)

Ein Bewertungsraster ist eine einfache Textdatei im Markdown-Format mit der Endung `.md`. Man kann sie in jedem Texteditor lesen und ändern, auch am iPad. Fachschaftsraster liegen im Repository im Ordner `raster/`.

Am einfachsten erstellst du eine neue Datei mit einer KI. Die Anleitung dazu steht in `KI-PROMPT.md`. Diese Beschreibung brauchst du nur, wenn du eine Datei von Hand anlegst oder nachbesserst.

## Aufbau auf einen Blick

```
---
format: gradeem-raster/1
name: Chemie (ee26)
titel: Kriterien zur mündlichen Notengebung im Fach Chemie
fach: Chemie
---

## Stufen

| Stufe  | Note |
|--------|------|
| sehr gut | 1 |
| gut      | 2 |
| befriedigend | 3 |
| ausreichend  | 4 |
| mangelhaft – ungenügend | 5 bis 6 |

## Kriterium: Fachwissen
Gewicht: 2

### sehr gut
- Fachwissen **sicher** abrufbar und anwendbar
- Zusammenhänge werden selbstständig hergestellt

### gut
Fachwissen meist sicher

### befriedigend
…
```

Die Datei besteht aus dem **Kopfbereich** zwischen den beiden `---`-Zeilen und danach aus **Abschnitten**, die mit `## ` beginnen.

## Kopfbereich

Eine Angabe pro Zeile, immer `Name: Wert`.

| Angabe | Pflicht | Bedeutung |
|---|---|---|
| `format` | ja | immer `gradeem-raster/1` |
| `name` | | Name des Rasters in der App (Auswahllisten), z. B. `Chemie (ee26)`. Ohne Angabe: Fach und Titel |
| `titel` | ja | Überschrift des Rasters auf dem Bogen |
| `fach` | ja | Fach, z. B. für die Auswahlliste und die Notenliste |
| `typ` | | `kriterien` (Standard) oder `matrix` (siehe unten) |
| `wertung` | | `mittelwert` (Standard) oder `summe` (Punkte zusammenzählen) |
| `titel_schuelibogen` | | abweichende Überschrift auf dem Schülibogen |
| `untertitel` | | Zeile unter der Überschrift |
| `schule`, `herausgeber`, `stand`, `klassen` | | frei, z. B. `klassen: 5-10`, `stand: 2026/27` |
| `quelle` | | Originaldatei, aus der das Raster stammt |
| `kopfzeile` | | Felder oben auf dem Bogen, getrennt durch `\|`. Standard: `Name \| Klasse \| Datum \| Note`. Name, Klasse, Datum und Note füllt die App aus. |
| `schuelibogen` | | `vollstaendig` (Standard: alle Beschreibungen) oder `kompakt` (nur beste und schwächste Beschreibung, dazwischen Kreuzspalten) |
| `kommentarspalte` | | Überschrift einer Kommentarspalte, z. B. `Kommentar` oder `Bemerkungen`. Ohne Angabe stehen Kommentare unter der Tabelle. |
| `notendefinitionen` | | `ja` hängt die Notendefinitionen nach §5 Notenbildungsverordnung an |
| `spalte_kriterien`, `spalte_stufen` | | Beschriftung der Kopfzellen, z. B. `Kriterien`, `Notenbereich` |
| `einheit` | | Bezeichnung der Punkte bei `wertung: summe`, z. B. `Sterne` |

## Stufen

Eine Tabelle mit einer Zeile pro Spalte des Rasters, **in der Reihenfolge des Originals**.

| Spalte | Bedeutung |
|---|---|
| `Stufe` | Name der Stufe, genau so wie in den `###`-Überschriften der Kriterien |
| `Note` | Notenwert der Stufe (bei `wertung: mittelwert`) |
| `Punkte` | bei `wertung: summe` die Punkte, die die Stufe zählt; sonst nur zur Anzeige (z. B. `15, 14, 13`) |
| `Kreuz` | Beschriftung der Kreuzspalte auf dem kompakten Schülibogen, z. B. `+ +` |

**Notenwerte** dürfen so geschrieben werden:

| Schreibweise | Bedeutung |
|---|---|
| `2` oder `2,5` | Dezimalnote |
| `2+`, `2-`, `1-2` | Viertelnote (2+ = 1,75; 2- = 2,25; 1-2 = 1,5) |
| `5 bis 6` | Bereich; gerechnet wird mit der Mitte (5,5) |

**Punkte**: eine Zahl (`3`), mehrere zur Auswahl (`1, 0`) oder ein Bereich (`2 bis 0`). Stehen mehrere zur Auswahl, wählt die Lehrkraft beim Bewerten.

## Kriterien

Jedes Kriterium ist ein Abschnitt `## Kriterium: Name`. Direkt darunter dürfen stehen:

- `Gewicht: 2` – relatives Gewicht (Standard 1). `0` heißt: wird angezeigt, zählt aber nicht.
- `Schülibogen: …` – abweichender Name auf dem Schülibogen
- `Erläuterung: …` – kleiner Zusatztext unter dem Namen

Danach folgt für jede Stufe eine Überschrift `### Stufe` mit der Beschreibung:

- Mehrere Absätze oder eine Aufzählung (`- `) sind möglich; jeder Punkt wird ein eigener Absatz in der Zelle.
- **Fett** schreibt man `**so**`.
- Eine Überschrift ohne Text darunter (oder eine fehlende Stufe) ergibt eine leere Zelle, die trotzdem angekreuzt werden kann.

## Wie gerechnet wird

- **`wertung: mittelwert`** (Standard): Pro Kriterium werden die markierten Stufen gemittelt, dann wird über die Kriterien gewichtet gemittelt. Das ist das Verfahren des Biologie-Rasters.
- **`wertung: summe`**: Die Punkte der markierten Stufen werden addiert. Die Note ergibt sich aus der Tabelle im Abschnitt `## Umrechnung`:

  ```
  ## Umrechnung

  | Summe | Note |
  |---|---|
  | 15 bis 14 | 1 |
  | 13 | 1-2 |
  ```

  Es darf mehrere Umrechnungen geben, z. B. `## Umrechnung: Klasse 5-10` und `## Umrechnung: Kursstufe`. Die Lehrkraft wählt dann pro Lerngruppe. `Summe = Notenpunkte` (ohne Tabelle) bedeutet, dass die Summe direkt die Notenpunkte sind.

- **`typ: matrix`**: Zwei Einschätzungen, z. B. Qualität der Beiträge (Zeilen) und Mitarbeit (Spalten), ergeben zusammen eine Zelle mit einem Notenbereich:

  ```
  ## Zeilen: Beiträge & Verständnis
  ### A
  Richtige, herausragende Beiträge …

  ## Spalten: Mitarbeit
  ### I
  Besonders auffallende permanente Leistung …

  ## Noten

  |   | I | II |
  |---|---|---|
  | A | 1, 1- (15, 14) | 1-2, 2+, 2 (13, 12, 11) |
  ```

  In jeder Zelle stehen die möglichen Noten und in Klammern die Punkte. Die App schlägt die mittlere vor; die Lehrkraft wählt.

## Weitere Abschnitte (alle freiwillig)

| Abschnitt | Inhalt |
|---|---|
| `## Einleitung` | Text über dem Raster |
| `## Hinweise` | Text unter dem Raster |
| `## Fußnoten` | nummerierte Liste (`1. …`); im Text mit ¹ ² ³ verweisen |
| `## Freitextfelder` | Aufzählung von Fragen, unter denen auf dem Bogen Schreiblinien erscheinen |

## Anmerkungen für die Fachschaft

Alles zwischen `<!--` und `-->` wird nicht angezeigt und nicht gedruckt. Offene Fragen werden so markiert:

```
<!-- PRÜFEN: Das Original nennt keine Gewichte. Bitte festlegen. -->
```

Vor der Freigabe eines Fachschaftsrasters sollten alle `PRÜFEN`-Stellen geklärt und entfernt sein.
