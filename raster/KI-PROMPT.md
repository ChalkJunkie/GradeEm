# Raster mit einer KI umwandeln

So geht's:

1. Den Text im grauen Kasten unten komplett kopieren.
2. In einen KI-Assistenten einfügen (z. B. Claude oder ChatGPT) und das Raster als PDF, Word-Datei oder Foto anhängen.
3. Die Antwort der KI ist eine fertige Rasterdatei. In Grade’Em unter „Raster importieren“ einfügen und in der Vorschau prüfen. Oder als `.md`-Datei sichern und dann importieren.

Raster enthalten keine Daten von Schülis. Du kannst sie also unbedenklich von einer KI umwandeln lassen.

---

```text
Wandle das angehängte Bewertungsraster für mündliche Noten in eine Datei im
Grade’Em-Rasterformat um. Antworte ausschließlich mit dem Inhalt der Datei
in einem einzigen Markdown-Codeblock, ohne weitere Erklärungen.

WICHTIGSTE REGEL: Übernimm alle Texte WORTGETREU. Nichts umformulieren, nichts
kürzen, nichts ergänzen, keine Rechtschreibfehler korrigieren. Fettdruck als
**fett** übernehmen. Nur Silbentrennungen am Zeilenende zusammenführen
(„Befrie-digend“ → „Befriedigend“). Logos und Farben weglassen.

AUFBAU DER DATEI

---
format: gradeem-raster/1
name: <Fach> (ee26)       (Name in der App; Kürzel der Schule anpassen)
titel: <Überschrift des Rasters>
fach: <Fach>
typ: kriterien            (oder matrix, siehe unten; Zeile weglassen bei kriterien)
wertung: mittelwert       (oder summe, siehe unten; Zeile weglassen bei mittelwert)
schule: <falls angegeben>
stand: <Schuljahr oder Datum, falls angegeben>
klassen: <z. B. 5-10, falls angegeben>
kopfzeile: <Felder der Kopfzeile, getrennt durch | , z. B. Name | Klasse | Datum | Note>
kommentarspalte: <Überschrift einer Kommentar-/Bemerkungsspalte, falls vorhanden>
---

## Stufen

| Stufe | Note | Punkte |
|---|---|---|
| <Spaltenüberschrift genau wie im Original> | <Notenwert> | <Punkte, falls angegeben> |

## Kriterium: <Name des Kriteriums genau wie im Original>
Erläuterung: <Klammerzusatz oder Kleingedrucktes zum Kriterium, falls vorhanden>

### <Stufe 1, genau wie in der Stufentabelle>
<Beschreibung; mehrere Punkte als Aufzählung mit "- ">

### <Stufe 2>
...

REGELN

1. Stufen = die Spalten bzw. Leistungsstufen, in der Reihenfolge des Originals.
   Jedes Kriterium bekommt für jede Stufe eine ###-Überschrift. Ist eine Zelle
   leer, bleibt die Überschrift ohne Text.
2. Stehen im Original die Noten als ZEILEN und die Kriterien als SPALTEN,
   drehe die Tabelle: Jede Spalte wird ein „## Kriterium:“, jede Notenzeile
   eine Stufe.
3. Gibt es nur eine Beschreibungsspalte pro Note (keine einzelnen Kriterien),
   lege genau ein Kriterium an, benannt nach der Spaltenüberschrift
   (z. B. „## Kriterium: Beschreibung“).
4. Notenwerte: 1 bis 6, auch „2+“, „2-“, „1-2“ (= 1,5) oder Bereiche wie
   „5 bis 6“. Punkte: „15, 14, 13“ oder „2 bis 0“.
5. Ordnet das Original den Stufen KEINE Noten zu (z. B. „Optime! / Bene! /
   Satis!“ oder Smileys), schlage passende Noten vor und schreibe direkt unter
   die Stufentabelle: <!-- PRÜFEN: Noten sind ein Vorschlag, bitte festlegen. -->
6. PUNKTE-RASTER: Werden pro Kriterium Punkte vergeben und addiert, setze
   „wertung: summe“, trage die Punkte in die Spalte „Punkte“ ein (Spalte
   „Note“ weglassen) und übernimm die Umrechnungstabelle:
   ## Umrechnung
   | Summe | Note |
   |---|---|
   | 15 bis 14 | 1 |
   Gibt es mehrere Umrechnungen (z. B. Unterstufe/Kursstufe), schreibe
   „## Umrechnung: <Bezeichnung>“ je Tabelle. Bedeutet die Summe direkt die
   Notenpunkte, schreibe darunter nur: Summe = Notenpunkte
7. MATRIX: Ergibt sich die Note aus ZWEI Einschätzungen (z. B. Qualität der
   Beiträge als Zeilen und Mitarbeit als Spalten, in den Zellen stehen Noten),
   setze „typ: matrix“ und schreibe statt Stufen und Kriterien:
   ## Zeilen: <Bezeichnung der Zeilen-Achse, falls vorhanden>
   ### A
   <Beschreibung der ersten Zeile>
   ### B
   ...
   ## Spalten: <Bezeichnung der Spalten-Achse, falls vorhanden>
   ### I
   <Beschreibung der ersten Spalte>
   ...
   ## Noten
   | <Text der Eckzelle> | I | II |
   |---|---|---|
   | A | 1, 1- (15, 14) | 1-2, 2+, 2 (13, 12, 11) |
   In jede Zelle: die Noten mit Komma getrennt, Punkte in Klammern.
   Verbundene Zellen in jede betroffene Zelle schreiben.
8. Texte über dem Raster → „## Einleitung“, Texte darunter → „## Hinweise“,
   Fußnoten → „## Fußnoten“ als nummerierte Liste (im Text ¹ ² ³),
   Fragen mit Schreiblinien zum Selbstausfüllen → „## Freitextfelder“ als
   Aufzählung.
9. Steht auf dem Original der Hinweis, dass Kriterien unterschiedlich
   gewichtet werden, die Gewichte fehlen aber: Schreibe unter jedes
   Kriterium „Gewicht: 1“ und darunter
   <!-- PRÜFEN: Gewichtung laut Original ungleich, aber nicht angegeben. -->
   Sind Gewichte angegeben, trage sie als „Gewicht: <Zahl>“ ein.
10. Enthält das Original die Notendefinitionen nach §5 Notenbildungsverordnung,
    schreibe sie NICHT ab, sondern setze im Kopfbereich „notendefinitionen: ja“.
11. ANKREUZBOGEN: Stehen nur die beste und die schwächste Beschreibung im
    Original und dazwischen leere Ankreuzspalten (z. B. „+ +  +  o  -  - -“),
    setze „schuelibogen: kompakt“, lege für jede Ankreuzspalte eine Stufe an
    (Spalte „Kreuz“ = Beschriftung im Original, Spalte „Note“ = 1, 2, 3 …)
    und fülle nur die äußeren Stufen mit Text.
12. Gibt es einen Teil des Rasters, der laut Original NICHT in die Note eingeht
    (z. B. „Zusätzliche Rückmeldung zur Mitarbeit“), schreibe bei diesen Kriterien
    „Gewicht: 0“ und beim ersten davon „Abschnitt: <Überschrift aus dem Original>“.
13. Alles, was unklar ist oder geraten werden musste, als
    <!-- PRÜFEN: … --> an der passenden Stelle vermerken.
```
