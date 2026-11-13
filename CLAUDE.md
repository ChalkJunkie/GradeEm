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

## Redesign (in Planung, Stand 13.11.2026)

Mockups: Design-Leinwand „Grade'Em Redesign“ (Entwurf „Tafel“). Noch nicht umgesetzt.

- Gut befunden: Startseite, Ansicht der Lerngruppe (Noten) und „Lerngruppe einrichten“.
- Feste Navigation links (Lerngruppen, Raster, Einstellungen); in der Lerngruppe Reiter Noten, Schülis, Einrichten, Export; Runden werden an einer Stelle in „Einrichten“ verwaltet.
- Schneller zum Bewerten: Jede Lerngruppe auf der Startseite hat einen direkten Knopf „Weiter bewerten“ bzw. „Bewertung starten“.
- Die Bewerten-Ansicht behält ihren bisherigen Aufbau (Tabelle mit allen Kriterien), weil ein Kriterium pro Bildschirm nicht für alle Raster funktioniert.
- Kein eigenes Logo-Kästchen („G’“) in der Navigation.
- Farben von Entwurf 1 („Tafel“: Tafelgrün, Kreidegelb als Akzent, helles Grau) und die Navigationsleiste links bleiben. Schrift bleibt Atkinson Hyperlegible.
- Dunkelmodus (Vorschlag, Mockup liegt vor): Farben vertauscht, sehr dunkles Tafelgrün (`#142722`) als Hintergrund, Kreideweiß als Schrift, Kreidegelb bleibt Akzent.
- Verworfen: Look im Stil von shadcn/ui; Seat'Em-Stil mit Menüzeile oben (Entwurf 3).

## Vorgemerkt

- Der Standardname einer neuen Runde ist immer das aktuelle Datum.

## Technische Struktur

(Wird beim ersten Durchlauf von Claude Code ergänzt: Dateien, Datenformat der Raster, wo neue Raster eingetragen werden, wie die App veröffentlicht wird.)

## Arbeitsweise

- Vor größeren Änderungen kurz sagen, was geplant ist, und vor jedem Commit eine Übersicht der geänderten Dateien zeigen.
- Änderungen klein und nachvollziehbar halten, bestehende Raster und Einstellungen nicht beschädigen.
- Nach neuen Entscheidungen diese CLAUDE.md aktualisieren.
