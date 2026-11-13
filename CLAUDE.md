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

## Technische Struktur

(Wird beim ersten Durchlauf von Claude Code ergänzt: Dateien, Datenformat der Raster, wo neue Raster eingetragen werden, wie die App veröffentlicht wird.)

## Arbeitsweise

- Vor größeren Änderungen kurz sagen, was geplant ist, und vor jedem Commit eine Übersicht der geänderten Dateien zeigen.
- Änderungen klein und nachvollziehbar halten, bestehende Raster und Einstellungen nicht beschädigen.
- Nach neuen Entscheidungen diese CLAUDE.md aktualisieren.
