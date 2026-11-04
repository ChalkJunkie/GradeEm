# Grade’Em – mündliche Noten nach Bewertungsraster

*vibe coded by Verena Lohmüller & Claude · Lizenz: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de) (siehe `LICENSE.md`)*

Grade’Em ist eine WebApp für das iPad, mit der du mündliche Noten nach einem Bewertungsraster schnell erfasst und als ausgefüllten Schülibogen bekanntgibst. Die Fachschaftsraster liegen im Ordner `raster/`, eigene Raster lassen sich importieren und bearbeiten. Sie läuft vollständig offline. Alle Daten bleiben auf deinem Gerät: kein Server, kein Konto, kein Tracking.

## Inhalt

1. [Über GitHub Pages veröffentlichen](#1-über-github-pages-veröffentlichen)
2. [Auf dem iPad installieren](#2-auf-dem-ipad-installieren)
3. [Backups und Gerätewechsel](#3-backups-und-gerätewechsel)
4. [Bedienung in Kürze](#4-bedienung-in-kürze)
5. [So wird gerechnet](#5-so-wird-gerechnet)
6. [Updates einspielen](#6-updates-einspielen)
7. [Technik, Datenschutz und Tests](#7-technik-datenschutz-und-tests)

---

## 1. Über GitHub Pages veröffentlichen

Du brauchst ein kostenloses Konto auf [github.com](https://github.com). Das geht auch komplett am iPad in Safari.

1. **Neues Repository anlegen:** oben rechts auf **+** → **New repository**. Name z. B. `gradeem`, Sichtbarkeit **Public** (GitHub Pages ist im kostenlosen Tarif nur für öffentliche Repositories verfügbar). Auf **Create repository** tippen.
   Das Repository enthält nur den Programmcode, niemals Daten von Schülis – die liegen ausschließlich auf dem iPad.
2. **Dateien hochladen:** Die ZIP-Datei entpacken (in der Dateien-App: ZIP antippen). Im neuen Repository **uploading an existing file** bzw. **Add file → Upload files** wählen und den **Inhalt** des Ordners `gradeem` hochladen – also `index.html`, `manifest.json`, `sw.js`, `LICENSE.md`, `README.md`, `.nojekyll` und die Ordner `css`, `js`, `vendor`, `icons`, `raster`, `tests`. Wichtig: `index.html` muss direkt auf oberster Ebene liegen, nicht in einem Unterordner. Unten auf **Commit changes** tippen.
   *Tipp:* Am Mac oder PC lässt sich der ganze Ordnerinhalt einfach per Drag & Drop in das Upload-Feld ziehen.
3. **Wichtig – Datei `.nojekyll` anlegen:** GitHub Pages wandelt Markdown-Dateien sonst in Webseiten um, und die Rasterdateien im Ordner `raster/` sind nicht mehr abrufbar. Die Datei liegt zwar im ZIP, wird aber am iPad (und oft auch am Mac) ausgeblendet und deshalb nicht mit hochgeladen. So legst du sie direkt auf GitHub an: im Repository **Add file → Create new file**, als Namen `.nojekyll` eintippen (mit Punkt am Anfang), Inhalt leer lassen, **Commit changes**.
   Die mitgelieferten Fachschaftsraster funktionieren auch ohne diese Datei, weil die App sie selbst enthält. Neue oder geänderte Raster aus dem Repository kommen aber nur mit `.nojekyll` an.
4. **Pages einschalten:** Im Repository **Settings → Pages**. Unter *Build and deployment* bei **Source** „Deploy from a branch“ wählen, Branch **main** und Ordner **/ (root)**, dann **Save**.
5. Nach ein bis zwei Minuten erscheint oben auf der Pages-Seite die Adresse, z. B.
   `https://DEIN-NAME.github.io/gradeem/`

## 2. Auf dem iPad installieren

1. Die Adresse in **Safari** öffnen und warten, bis die Startseite erscheint. Dabei legt die App alle Dateien für den Offline-Betrieb ab.
2. Auf das **Teilen-Symbol** tippen → **Zum Home-Bildschirm** → (falls angeboten „Als Web-App öffnen“ eingeschaltet lassen) → **Hinzufügen**.
3. Ab jetzt Grade’Em immer über das **Grade’Em-Symbol** (Sprechblase mit Raster) auf dem Home-Bildschirm starten. Die App funktioniert dann auch ohne Internet.

> **Wichtig:** Die Home-Bildschirm-App und ein normaler Safari-Tab haben **getrennte Speicher**. Was du in der App bewertest, siehst du nicht im Safari-Tab – und umgekehrt. Arbeite deshalb immer mit dem Home-Bildschirm-Symbol. Zum Übertragen zwischen beiden dient das Backup.

## 3. Backups und Gerätewechsel

Alle Daten liegen nur im Speicher dieser App auf dem iPad. Wird die App gelöscht oder das iPad zurückgesetzt, sind sie ohne Backup weg. Grade’Em erinnert dich auf der Startseite, wenn das letzte Backup länger als 14 Tage zurückliegt.

**Backup erstellen**

1. Startseite → **Backup** (oben rechts in der Kopfzeile). Alternativ Einstellungen → **Backup exportieren**.
2. **Teilen / Sichern** → **In Dateien sichern** und z. B. iCloud Drive oder den Schul-Cloud-Ordner wählen. (Alternativ AirDrop oder Mail.)
3. Die Datei heißt `GradeEm-Backup_JJJJ-MM-TT.json` und enthält alle Lerngruppen, Runden, Bewertungen und Einstellungen.

**Backup einspielen (z. B. neues iPad)**

1. Grade’Em auf dem neuen Gerät wie oben installieren.
2. Einstellungen → **Backup importieren** → Datei auswählen.
3. **Zusammenführen** ergänzt die vorhandenen Daten (gleiche Einträge werden überschrieben). **Ersetzen** löscht zuerst alles auf dem Gerät und spielt dann das Backup ein.

> Bewahre Backups sicher auf: Sie enthalten Namen und Noten deiner Schülis. Beachte die Datenschutzvorgaben deiner Schule für den Speicherort.

## 4. Bedienung in Kürze

**Lerngruppe anlegen** – Name (z. B. „Bio 8b“), Klasse (erscheint auf Schülibogen und Notenliste), **Bewertungsraster** und **Notenskala**. Mit **Beispielgruppe ausprobieren** kannst du alles gefahrlos testen und die Gruppe danach löschen.

**Bewertungsraster pro Lerngruppe** – Beim Anlegen und jederzeit unter **Lerngruppe** wählst du ein Fachschaftsraster oder ein eigenes Raster. Jede Bewertungsrunde merkt sich die genaue Fassung ihres Rasters: Ändert sich ein Raster später (neue Fachschaftsfassung oder eigene Bearbeitung), bleiben bestehende Noten und Bögen unverändert. Ein neues Raster gilt sofort, solange die aktuelle Runde noch keine Bewertungen hat, sonst ab der nächsten Runde. Ebenfalls unter **Lerngruppe**: die **Gewichtung** der Kriterien (bei Raster mit Mittelwert) und die **Umrechnung** (bei Punkte-Rastern mit mehreren Umrechnungstabellen, z. B. Kunst „Klasse 5-10“ / „Kursstufe“).

**Notenskala pro Lerngruppe** – Jede Lerngruppe hat ihre eigene Skala: **Viertelnoten**, **Notenpunkte** oder **beides** (dann zusätzlich wählbar, ob in Viertelnoten- oder Punkteschritten nachgeschärft wird). So kann z. B. „Bio 8b“ mit Viertelnoten und „Bio J1“ mit Notenpunkten arbeiten. Die Skala legst du beim Anlegen fest und änderst sie jederzeit unter **Lerngruppe**. Sie gilt für Anzeige, Nachschärfen, Notenliste und Schülibögen dieser Gruppe. Nachgeschärfte Endnoten bleiben bei einem Wechsel erhalten und werden umgerechnet. In den **Einstellungen** bestimmst du nur, mit welcher Skala neue Lerngruppen starten.

**Namen eintragen** – drei Wege, beliebig kombinierbar; doppelte Namen werden erkannt:

- **Einzeln:** „Anna Müller“ oder „Müller, Anna“ eintippen oder mit dem Apple Pencil hineinschreiben (Scribble), Eingabetaste – fertig, das Feld bleibt für den nächsten Namen offen.
- **Liste einfügen:** ein Name pro Zeile, z. B. aus einer Mail oder direkt aus Excel kopiert (zwei Spalten Nachname/Vorname werden erkannt).
- **CSV-Datei:** Semikolon oder Komma, mit oder ohne Kopfzeile, Nachname/Vorname getrennt oder in einer Spalte. Nummern- und Zusatzspalten werden übersprungen. In der Vorschau kannst du die Spalten korrigieren.

**Bewertungsrunden** – Jede Lerngruppe kann mehrere Runden haben (Vorschlag: „1. Halbjahr 2026/27“). So bleiben frühere mündliche Noten erhalten. Runde wählen, umbenennen oder neu anlegen in der Übersicht.

**Bewerten**

- Zutreffende Beschreibung im Raster antippen. Bei gemischter Leistung **mehrere Zellen einer Zeile** wählen – der Zeilenwert ist dann der Mittelwert.
- Bei **Punkte-Rastern** ist pro Kriterium eine Stufe wählbar; erlaubt eine Stufe mehrere Punktwerte (z. B. Kunst „1-0“), erscheinen Knöpfe zur Auswahl. Unten steht die Summe.
- Bei **Matrix-Rastern** wählst du eine Zeile und eine Spalte; darunter erscheint der Notenbereich der Zelle, die passende Note tippst du an.
- Pro Zeile ein optionaler Kommentar (Scribble funktioniert).
- Das Datum ist mit dem heutigen Tag vorbelegt, die Klasse kommt aus der Lerngruppe.
- **Wischen** nach links/rechts oder **Weiter / Zurück** wechselt die Person. **Liste** zeigt, wer schon bewertet ist (grün = vollständig, halb gefüllt = angefangen).
- Unten steht der **Vorschlag**. Mit **+ (besser)** und **− (schlechter)** schärfst du die **Endnote** nach; der Pfeil setzt sie auf den berechneten Wert zurück. Vorschlag und Endnote werden getrennt gespeichert.
- Alles wird sofort gespeichert.

**Exportieren** (Übersicht → Export) – erst Personen auswählen (alle, nur bewertete oder einzeln), dann:

- **Notenliste:** CSV für Excel (UTF-8 mit BOM, Semikolon) oder PDF/Drucken.
- **Schülibögen:** ein Schüli pro Seite, A4 quer – als PDF/Drucken oder als **Word-Datei (.docx)**. Der Bogen richtet sich nach dem Raster: **kompakt** mit Kreuzspalten (z. B. Biologie), **vollständig** mit allen Beschreibungen und markierter Auswahl, oder als **Matrix** mit markierter Zelle. Einleitung, Hinweise, Fußnoten, Freitextfelder und Notendefinitionen erscheinen, wenn das Raster sie enthält.
- **Mehrfachdruck:** 2 Bögen pro A4-Seite (A5, vollständig) oder 4 pro Seite (Kompaktfassung ohne Notendefinitionen, damit die Schrift lesbar bleibt), jeweils mit Schnittlinien.

**PDF erzeugen:** In der Druckansicht **Drucken / PDF** antippen. Im Druckdialog oben auf das **Teilen-Symbol** tippen und **In Dateien sichern** wählen – das ergibt ein PDF. Oder direkt drucken. Die PDFs enthalten keine Kopf- oder Fußzeile des Browsers (Adresse, Datum, Uhrzeit, Seitenzahl).

### Bewertungsraster verwalten

**Einstellungen → Raster verwalten** zeigt alle Fachschaftsraster und deine eigenen Raster.

- **Ansehen:** zeigt das komplette Raster.
- **Als eigenes bearbeiten:** legt eine eigene Fassung eines Fachschaftsrasters an, die du frei ändern kannst.
- **Raster importieren:** Rasterdatei einfügen oder als `.md`-Datei wählen. Am einfachsten mit einer KI: **KI-Prompt kopieren**, zusammen mit dem Original (PDF, Word, Foto) an einen KI-Assistenten geben, die Antwort komplett einfügen. Die App prüft sofort und zeigt Fehler verständlich an.
- **Editor:** Formular für Kriterien-Raster (Titel, Stufen, Kriterien, Beschreibungen, Gewichte, Umrechnung, Texte) und eine Textansicht für alles, auch Matrix-Raster. „Vorschau“ zeigt das Ergebnis.
- Eigene Raster sind im Backup enthalten und lassen sich als `.md`-Datei weitergeben.

### Fachschaftsraster im Repository pflegen

Die Raster im Ordner `raster/` stehen allen zur Verfügung, die die App über dein Repository nutzen. Das Format beschreibt `raster/FORMAT.md`. Die Angabe `name:` bestimmt, wie das Raster in der App heißt (z. B. `Chemie EE26`); der `titel:` steht gedruckt auf dem Bogen.

Voraussetzung: Im Repository liegt die Datei `.nojekyll` (siehe Abschnitt 1, Schritt 3). Fehlt sie, zeigt die Rasterverwaltung einen Hinweis.

1. Neue oder geänderte `.md`-Datei in den Ordner `raster/` hochladen.
2. Bei einem **neuen** Raster einen Eintrag in `raster/index.json` ergänzen (die App kann den Ordner nicht selbst durchsuchen), z. B.:
   `{ "file": "physik.md", "name": "Physik EE26", "titel": "Kriterien … Physik", "fach": "Physik", "klassen": "", "typ": "kriterien", "wertung": "mittelwert" }`
3. In `sw.js` die neue Datei in die Liste `OPTIONAL_FILES` eintragen (`'./raster/physik.md',`) und `CACHE_VERSION` hochzählen.

Nach dem Update übernimmt die App geänderte Fachschaftsraster automatisch für **neue** Runden; laufende Runden mit Bewertungen behalten ihre Fassung.

## 5. So wird gerechnet

| Schritt | Regel |
|---|---|
| Zeilenwert | Mittelwert der markierten Spalten (Spalte 1 = Note 1 … Spalte 6 = Note 6) |
| Vorschlag | gewichteter Mittelwert der drei Zeilen (Standard je 1/3, in den Einstellungen änderbar) |
| Viertelnote | Rundung auf die nächste Viertelstufe: 1 / 1- / 1-2 / 2+ / 2 / 2- / 2-3 / 3+ … 6 |
| Notenpunkte | Punkte = 17 − 3 × Note, gerundet, begrenzt auf 0–15 (15 P ≙ 1+, 14 P ≙ 1, 13 P ≙ 1- …) |
| Exakte Mitte | wird zugunsten des Schülis gerundet (z. B. 2,125 → 2; 12,5 P → 13 P) |
| Punkte-Raster | Punkte der gewählten Stufen werden addiert; die Note kommt aus der Umrechnungstabelle des Rasters (z. B. Chemie, Kunst) |
| Matrix-Raster | Zeile und Spalte ergeben eine Zelle mit Notenbereich (z. B. Geschichte, Religion); Vorschlag ist die Mitte, die passende Note tippst du an |
| Nachschärfen | in Viertelschritten oder ganzen Punkten, je nach Skala der Lerngruppe |

**Beispiel:** Qualität 2 und 3 markiert (Zeilenwert 2,5), Fachwissen 2, Fachsprache 1 → Vorschlag (2,5 + 2 + 1) / 3 = 1,83 → Viertelnote **2+**, Punkte 17 − 5,5 = 11,5 → **12 P**.

Die **Gewichtung** wird mit jeder Bewertung gespeichert. Änderst du sie später in den Einstellungen, bleiben ältere Bewertungen unverändert. In der Bewertungsansicht erscheint dann ein Hinweis mit der Möglichkeit, die aktuelle Gewichtung zu übernehmen.

Die Umrechnung steht gut dokumentiert in `js/grades.js` und ist mit Beispielwerten getestet (`tests/grades.test.mjs`).

## 6. Updates einspielen

1. Geänderte Dateien im Repository ersetzen (Upload wie oben).
2. In `sw.js` die Zeile `const CACHE_VERSION = 'gradeem-v1.2.0';` hochzählen, z. B. auf `gradeem-v1.2.1`. Nur dann holt sich die installierte App die neuen Dateien. (Die mitgelieferten Dateien sind bereits richtig nummeriert.)
3. Beim nächsten Start mit Internet erscheint in der App „Eine neue Version ist bereit“ → **Neu laden**. Deine Daten bleiben dabei erhalten.

### Umstieg von TardiGrader auf Grade’Em (Version 1.2)

- **Repository-Name:** Er kann `tardigrader` bleiben. Dann ändert sich die Adresse nicht, und das Update läuft wie oben beschrieben. Benennst du das Repository um, ändert sich die Adresse. Dann musst du die App neu installieren und ein Backup einspielen (siehe unten).
- **Daten:** Bleiben beim Update erhalten. Intern heißt die Datenbank weiterhin „tardigrader“, und alte TardiGrader-Backups lassen sich importieren.
- **Symbol und Name auf dem Home-Bildschirm:** iPadOS übernimmt beides nur bei einer Neuinstallation. Ein neues Home-Bildschirm-Symbol hat aber einen eigenen, leeren Speicher. Damit nichts verloren geht, in dieser Reihenfolge vorgehen:
  1. Update einspielen, die alte App öffnen, „Neu laden“ tippen.
  2. In der App **Backup** sichern („In Dateien sichern“).
  3. In Safari die Adresse öffnen und neu **Zum Home-Bildschirm** hinzufügen. Jetzt erscheint das neue Symbol.
  4. Die neue App öffnen, **Einstellungen → Backup importieren → Ersetzen**, und prüfen, ob alles da ist.
  5. Erst dann das alte Symbol vom Home-Bildschirm löschen.

## 7. Technik, Datenschutz und Tests

**Aufbau** – statische Dateien ohne Build-Schritt, direkt lauffähig auf GitHub Pages:

```
index.html            App-Gerüst (Content-Security-Policy: nur eigene Dateien)
manifest.json         PWA-Manifest (Homescreen-Symbol, Vollbild)
sw.js                 Service Worker (Offline-Cache)
css/app.css           Gestaltung, Dark Mode, Druck-CSS
js/app.js             Bildschirme und Abläufe
js/grades.js          Notenberechnung und Umrechnung
js/rubric.js          Rastertexte (wortgetreu, **fett** markiert)
js/csv.js             CSV-/Listen-Import und CSV-Export
js/db.js              lokale Datenbank (IndexedDB)
js/sheet-data.js      Aufbereitung für Bögen und Notenliste
js/print.js           Druckansichten (1, 2, 4 Bögen pro Seite; Notenliste; Rasterübersicht)
js/raster.js          Raster einlesen, prüfen und schreiben (Markdown ↔ Modell)
js/engine.js          Berechnung für alle Rasterarten (Mittelwert, Punktsumme, Matrix)
js/raster-builtin.js  eingebaute Kopie aller Fachschaftsraster (offline, Datenübernahme)
js/rate-view.js       Bewertungsansicht
js/raster-ui.js       Rasterverwaltung, Import und Editor
js/docx-export.js     Word-Export
js/ui.js              Hilfsfunktionen für Oberfläche und Dateien
vendor/               docx-Bibliothek (MIT) und Schrift Atkinson Hyperlegible (SIL OFL), lokal
icons/                App-Symbole (Sprechblase mit Raster)
raster/               Fachschaftsraster (Markdown), index.json (Verzeichnis), FORMAT.md, KI-PROMPT.md
LICENSE.md            Lizenz (CC BY-NC-SA 4.0) und Lizenzen der Bestandteile
tests/                automatische Tests
```

**Datenmodell (IndexedDB „tardigrader“ – der Name stammt aus der ersten Version und bleibt, damit vorhandene Daten erhalten bleiben)**

- `meta` – Einstellungen: Gewichtung, Standard-Skala für neue Gruppen, Namensreihenfolge, Darstellung, letztes Backup
- `groups` – Lerngruppe mit Name, Klasse, Notenskala, Schrittweite und Bewertungsraster, Gewichtungen und Liste der Schülis (Vorname, Nachname)
- `rounds` – Bewertungsrunden je Lerngruppe, jeweils mit der Fassung (Prüfwert) ihres Rasters
- `assessments` – je Runde und Schüli: gewählte Stufen und Kommentar pro Kriterium, Datum, Gewichtung und Umrechnung zum Zeitpunkt der Bewertung, Vorschlag, Endnote
- `rasters` – genutzte Fachschaftsraster und eigene Raster (Markdown-Text)
- `rasterVersions` – unveränderliche Rasterfassungen, auf die sich die Runden beziehen

**Datenschutz** – Die App lädt keine externen Inhalte und sendet nichts. Die Content-Security-Policy erlaubt nur Dateien vom eigenen Server. Schrift und Bibliotheken liegen im Repository.

**Tests** (am Computer mit Node.js 18 oder neuer, im Ordner `gradeem`):

```
node --test tests/grades.test.mjs tests/csv.test.mjs tests/raster.test.mjs
npm install docx && node tests/docx-export.test.mjs beispiel.docx
```

Der erste Befehl prüft Notenumrechnung und CSV-Import/-Export (19 Tests) sowie alle Raster und die Bewertungsarten (14 Tests), der zweite erzeugt eine Beispiel-Word-Datei mit fünf Schülibögen verschiedener Rasterarten.

**Hinweise zu den Vorlagen** – Die Texte des Rasters sind wortgetreu aus beiden Vorlagen übernommen, einschließlich der Fettungen. Trennstriche, die in der Lehrerversion nur dem Zeilenumbruch dienten („Argumentations-ketten“, „Alternativ-beispiele“, „Notenbildungs-verordnung“), sind als weiche Trennstellen gesetzt und erscheinen nur, wenn dort umbrochen wird.

**Bekannte Grenzen**

- Ob Safari beim Drucken das Querformat aus der Druckvorlage übernimmt, hängt von der iPadOS-Version ab. Falls ein PDF im Hochformat entsteht: im Druckdialog die Ausrichtung wählen, sofern angeboten, oder den Word-Export nutzen (immer A4 quer).
- Sollte der Druckdialog in der Home-Bildschirm-App nicht erscheinen, bleibt der Word-Export als Weg zum PDF (in Word oder Pages öffnen → als PDF exportieren).
- Sehr lange Kommentare werden im Mehrfachdruck automatisch etwas kleiner gesetzt, damit der Bogen in sein Feld passt.

**Lizenzen** – docx © Dolan, MIT-Lizenz (`vendor/LICENSE-docx.txt`); Atkinson Hyperlegible © Braille Institute of America, SIL Open Font License 1.1 (`vendor/fonts/OFL-Atkinson-Hyperlegible.txt`).

## Versionen

- **1.3.1** – Fachschaftsraster funktionieren jetzt immer: Die App enthält sie selbst und lädt neuere Fassungen aus dem Repository, sobald sie erreichbar sind (behebt die Meldung „offline nicht verfügbar“ auf GitHub Pages ohne `.nojekyll`). Raster haben einen Anzeigenamen (`name:`, z. B. „Chemie EE26“). Hinweis in der Rasterverwaltung, wenn die Dateien im Repository nicht abrufbar sind.
- **1.3.0** – Beliebige Bewertungsraster: Fachschaftsraster auswählbar, eigene Raster importieren (auch per KI), bearbeiten und weitergeben. Neue Bewertungsarten Punktsumme (Chemie, Kunst) und Matrix (Geschichte, Religion). Raster, Gewichtung und Umrechnung pro Lerngruppe; jede Runde behält ihre Rasterfassung. Schülibögen, Word-Export und Notenliste richten sich nach dem Raster. Neue Begriffe „Schüli/Schülis“. Bestehende Daten werden automatisch übernommen.
- **1.2.0** – Neuer Name **Grade’Em** und neues Symbol. Backup-Knopf und Lizenzvermerk in der Kopfzeile. PDFs ohne Kopf-/Fußzeile des Browsers; die Notenliste wird dafür selbst auf Seiten verteilt. Ordner `raster/` mit den Fachschaftsrastern (noch nicht in der App nutzbar).
- **1.1.0** – Notenskala pro Lerngruppe statt zentral. Bestehende Lerngruppen und ältere Backups übernehmen beim ersten Start automatisch die bisher eingestellte Skala.
- **1.0.0** – erste Version.
