# Grade'Em

Grade'Em (früher „TardiGrader“) ist eine HTML-basierte WebApp fürs iPad. Lehrkräfte erstellen damit schnell mündliche Noten anhand eines Bewertungsrasters und können sie exportieren. Die App wird in diesem GitHub-Repository veröffentlicht.

## Lizenz und Vermerk

- Lizenz: CC BY-NC-SA 4.0
- Vermerk in der App: „vibe coded by Verena Lohmüller & Claude“

## Grundsätze

- Die App muss am iPad im Browser gut bedienbar sein (Touch, große Bedienelemente).
- Die Notenskala ist pro Lerngruppe einstellbar, nicht zentral festgelegt.
- In der App wird genderneutral „Schüli“ bzw. „Schülis“ statt „Schüler“ verwendet.
- Texte in der App sind auf Deutsch, Anrede und Ton sind schlicht und freundlich.

## Raster

- Die Raster der eigenen Schule (diverse Fächer) liegen direkt im Repository und sind in der App auswählbar.
- Fachschaftsraster heißen in der App „[Fachname] (ee26)“. „EE“ ist das Kürzel der Schule, „26“ die Jahreszahl. Beispiel: „Biologie (ee26)“.
- Physik und Chemie nutzen an der Schule dasselbe Raster.
- Die Biologie-Raster liegen als Word-Dateien in `vorlagen/` und dienen als Referenz für Aufbau und Formulierungen:
  - `Biologie_Lehrkraft.docx`: Raster mit Noten 1 bis 6 und den Zeilen „Qualität der Beiträge“, „Fachwissen“, „Fachsprache“ und der Notendefinition nach §5 Notenbildungsverordnung Baden-Württemberg
  - `Biologie_Schueli.docx`: Schülerversion des Rasters mit Kommentarfeld
- Neue oder geänderte Raster werden inhaltlich 1:1 aus den Word-Dateien übernommen. Formulierungen nicht eigenmächtig ändern; bei Unklarheiten nachfragen.

## Geplante Erweiterung

- Andere Schulen und einzelne Kolleg:innen sollen eigene Raster nutzen können.
- Dafür ist ein Editor in der App gewünscht. Copy-Paste aus Word fällt am iPad vielen schwer, deshalb soll die Eingabe einfach sein (z. B. Zeile für Zeile, ohne Formatierungsübernahme).

## Design (umgesetzt in Version 1.5.0)

Mockups: Design-Leinwand „Grade'Em Redesign“ (Entwurf 1 „Tafel“).

- Farbwelt „Tafel und Kreide“: Tafelgrün (`#1E3932`) als Hauptfarbe, Kreidegelb (`#F4C542`) für die wichtigste Aktion, helles Grau (`#F2F4F1`) als Grund. Schrift bleibt Atkinson Hyperlegible.
- Dunkelmodus: Farben vertauscht, sehr dunkles Tafelgrün (`#142722`) als Hintergrund, Kreideweiß als Schrift, Kreidegelb bleibt Akzent.
- Feste Navigation links (Lerngruppen, Raster, Einstellungen), ohne Logo-Kästchen. Auf schmalen Bildschirmen liegt sie unten.
- In der Lerngruppe die Reiter Noten, Schülis, Einrichten, Export. Runden werden an einer Stelle unter „Einrichten“ verwaltet.
- Schneller zum Bewerten: Jede Lerngruppe auf der Startseite hat einen direkten Knopf „Weiter bewerten“ bzw. „Bewertung starten“.
- Die Bewerten-Ansicht behält ihren bisherigen Aufbau (Tabelle mit allen Kriterien, ohne Navigation links), weil ein Kriterium pro Bildschirm nicht für alle Raster funktioniert.
- Der Standardname einer neuen Runde ist immer das aktuelle Datum.
- Verworfen: Look im Stil von shadcn/ui; Seat'Em-Stil mit Menüzeile oben.

## Technische Struktur

- Kein Build-Schritt: `index.html`, `css/app.css` und ES-Module in `js/`. Veröffentlicht wird über GitHub Pages aus dem Branch `main` (Datei `.nojekyll` muss vorhanden sein).
- `js/app.js`: Zustand, Navigation (Adressen `#/…`), Startseite, Lerngruppe (Reiter), Export, Einstellungen. `js/rate-view.js`: Bewerten. `js/raster-ui.js`: Raster-Übersicht und Editor. `js/ui.js`: kleine UI-Hilfen und Symbole.
- Farben stehen als CSS-Variablen am Anfang von `css/app.css` (hell und dunkel); die Stile für Navigation, Reiter und Karten stehen am Ende der Datei.
- Raster: eine Markdown-Datei pro Raster in `raster/` (Format in `raster/FORMAT.md`), Verzeichnis in `raster/index.json`, eingebaute Kopie in `js/raster-builtin.js`. Ein neues Raster muss an allen drei Stellen eingetragen werden.
- Daten der Lehrkraft liegen nur im Browser (IndexedDB, `js/db.js`).
- Bei einer neuen Version die Nummer an drei Stellen ändern: `APP_VERSION` in `js/app.js`, `CACHE_VERSION` in `sw.js`, Abschnitt „Versionen“ in `README.md`.
- Tests: `node --test tests/grades.test.mjs tests/csv.test.mjs tests/raster.test.mjs`.

## Arbeitsweise

- Vor größeren Änderungen kurz sagen, was geplant ist, und vor jedem Commit eine Übersicht der geänderten Dateien zeigen.
- Änderungen klein und nachvollziehbar halten, bestehende Raster und Einstellungen nicht beschädigen.
- Nach neuen Entscheidungen diese CLAUDE.md aktualisieren.
