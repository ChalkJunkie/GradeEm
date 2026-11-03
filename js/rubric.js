/**
 * Grade’Em – Texte des Bewertungsrasters
 * ==========================================
 * Wortgetreu übernommen aus
 *   „NEU erarbeitet - Kriterien zur mündlichen Notengebung im Fach Biologie“ (Lehrerversion) und
 *   „NEU Schülerversion für mdl. Noten“ (Schülerbogen).
 *
 * Auszeichnung: **fett**. Ein Eintrag pro Absatz innerhalb einer Zelle.
 * „\u00AD“ ist ein weiches Trennzeichen: Der in der Vorlage gesetzte Trennstrich
 * (z. B. „Argumentations-ketten“) erscheint nur, wenn dort umbrochen wird.
 */

const SHY = '\u00AD';

export const TEACHER_TITLE = 'Kriterien zur mündlichen Notengebung im Fach Biologie';
export const STUDENT_TITLE = 'Kriterien zur mündlichen Notengebung im Fach Biologie für Schüler*innen';

/** Spaltenköpfe der Lehrerversion (Note 1 … 6). */
export const TEACHER_HEADERS = ['1 / ++', '2 / +', '3 / 0', '4/ -', '5/ - -', '6/ - - -'];
export const TEACHER_CORNER = 'Noten';

/** Kreuzspalten der Schülerversion (Note 1 … 6; die sechste Spalte ist leer beschriftet). */
export const STUDENT_MARKS = ['+ +', '+', 'o', '-', '- -', ''];
export const STUDENT_COMMENT_HEADER = 'Kommentar';

/** Die drei Zeilen des Rasters. */
export const CRITERIA = [
  {
    key: 'quality',
    teacherLabel: '**Qualität der Beiträge**',
    studentLabel: '**Qualität der Beiträge**',
    short: 'Qualität',
    cells: [
      [
        '**Selbstständiges** erarbeiten **komplexer Sachverhalte** und Probleme',
        '**Differenzierte** **Einordnung** neuer Inhalte in größere **Zusammenhänge** (auch fächerübergreifend)',
        `**Vertieftes Verständnis** anhand von **Fragen**, Argumentations${SHY}ketten, **Hypothesen** oder experimenteller Überprüfung **klar ersichtlich**`,
      ],
      [
        '**Selbstständiges** erarbeiten **neuer Sachverhalte** und Probleme',
        '**Einordnung** neuer Inhalte **in größere Zusammenhänge**',
        'Vertieftes Verständnis **erkennbar** anhand selbstständiger Entwicklung weiterführender Fragen, Hypothesen oder Experimente',
      ],
      [
        `**Erfassen** neuer Sachverhalte **mit Hilfestellung**, Anwendung auf einfache Alternativ${SHY}beispiele möglich`,
        '**Wenig Einordnung** neuer Inhalte in größere Zusammenhänge',
        '**Kaum** vertieftes Verständnis **ersichtlich**',
      ],
      [
        '**Erfassen** des aktuell behandelten Stoffs **in Grundzügen**',
        '**Kaum Vernetzung** von aktuellem Stoff zum Basiswissen erkennbar',
        'Beiträge meist **kurz** und eher **reproduktiv**',
      ],
      [
        '**Erfassen** des aktuell behandelten Stoffs nur **lückenhaft und reproduktiv**',
        '**Keine Vernetzung** des aktuellen Stoffs zum Basiswissen erkennbar',
        'Beiträge fast **nur reproduktiv**',
      ],
      [
        'Aktuell behandelter Stoff **nicht reproduzierbar**',
        '**Keine Vernetzung** des aktuellen Stoffs zum Basiswissen erkennbar',
      ],
    ],
    studentBest: [
      '**Selbstständiges** erarbeiten **komplexer Sachverhalte** und Probleme',
      '**Differenzierte** **Einordnung** neuer Inhalte in größere **Zusammenhänge** (auch fächerübergreifend)',
      '**Vertieftes Verständnis** anhand von **Fragen**, Argumentationsketten, **Hypothesen** oder experimenteller Überprüfung **klar ersichtlich**',
    ],
    studentWorst: [
      'Aktuell behandelter Stoff **nicht reproduzierbar**',
      '**Keine Vernetzung** des aktuellen Stoffs zum Basiswissen erkennbar',
    ],
  },
  {
    key: 'knowledge',
    teacherLabel: '**Fachwissen**',
    studentLabel: '**Präsenz des Fachwissens**',
    short: 'Fachwissen',
    cells: [
      ['Fachwissen **stets** auch über Jahrgangsstufen hinaus **souverän** **abruf- und anwendbar**'],
      ['Sicheres Fachwissen auch über mehrere Unterrichtseinheiten hinaus **abruf- und meist anwendbar**'],
      ['Sicheres Fachwissen **meist** abruf- und **in Teilen** **anwendbar**'],
      ['Fachwissen **begrenzt, aber abrufbar**'],
      ['Fachwissen mit **erheblichen Lücken**'],
      ['Fachwissen **nicht vorhanden**'],
    ],
    studentBest: ['Fachwissen **stets** auch über Jahrgangsstufen hinaus **souverän** **abruf- und anwendbar**'],
    studentWorst: ['Fachwissen **nicht vorhanden**'],
  },
  {
    key: 'language',
    teacherLabel: '**Fachsprache**',
    studentLabel: '**Verwendung der Fachsprache**',
    short: 'Fachsprache',
    cells: [
      ['**Eigenständige**, **klare** Formulierung der Gedanken unter **korrekter** Verwendung der Fachsprache'],
      ['**Eigenständige** Formulierung der Gedanken unter **weitgehend korrekter** Verwendung der Fachsprache'],
      ['**Formulierung** der eigenen Gedanken **mit Hilfestellung** unter **meist korrekter** Verwendung der Fachsprache'],
      ['Formulierung der eigenen Gedanken **mit Hilfestellung** verständlich, **vermehrt Fehler** in der Fachsprache'],
      ['Formulierung der eigenen Gedanken **häufig** auch **mit Hilfestellung nicht** immer **nachvollziehbar**, **viele Fehler** in der Fachsprache'],
      ['Formulierung der eigenen Gedanken auch mit Hilfestellung **nicht möglich**, **keine** Verwendung der **Fachsprache**'],
    ],
    studentBest: ['**Eigenständige**, **klare** Formulierung der Gedanken unter **korrekter** Verwendung der Fachsprache'],
    studentWorst: ['Formulierung der eigenen Gedanken auch mit Hilfestellung **nicht möglich**, **keine** Verwendung der **Fachsprache**'],
  },
];

/** Notendefinitionen nach §5 Notenbildungsverordnung (Note 1 … 6). */
export const DEFINITIONS = [
  'Die Leistung entspricht den Anforderungen im besonderen Maße.',
  'Die Leistung entspricht voll den Anforderungen.',
  'Die Leistung entspricht im Allgemeinen den Anforderungen.',
  'Die Leistung weist Mängel auf, entspricht im Ganzen noch den Anforderungen.',
  'Die Leistung entspricht den Anforderungen nicht, notwendige Grundkenntnisse sind jedoch vorhanden, Mängel sind in absehbarer Zeit behebbar.',
  'Die Leistung entspricht den Anforderungen nicht, notwendige Grundkenntnisse sind so lückenhaft, dass Mängel in absehbarer Zeit nicht behoben werden können.',
];

export const TEACHER_DEFINITION_LABEL = '**Definition***';
export const STUDENT_NOTE_LABEL = '**Note**';
export const STUDENT_DEFINITION_LABEL = `**Definition nach Notenbildungs${SHY}verordnung***`;

/** Kopfzeile der Notendefinitionstabelle im Schülerbogen. */
export const GRADE_NAMES = [
  '**1 (sehr gut)**',
  '**2 (gut)**',
  '**3 (befriedigend)**',
  '**4 (ausreichend)**',
  '**5 (mangelhaft)**',
  '**6 (ungenügend)**',
];

export const FOOTNOTE_TEXT = '* laut §5 Notenbildungsverordnung vom 5. Mai 1983, Fassung vom 04.02.2025, einsehbar unter ';
export const FOOTNOTE_URL = 'https://www.landesrecht-bw.de/bsbw/document/jlr-NotBildVBWV27P5';

/**
 * Zerlegt einen Text mit **fett**-Auszeichnung in Abschnitte.
 * @param {string} text
 * @returns {{text:string, bold:boolean}[]}
 */
export function parseRich(text) {
  // „**“, auf das kein weiteres „*“ folgt, schaltet Fettdruck um. So bleibt das
  // Fußnotensternchen in „…verordnung***“ Teil des fetten Textes.
  const parts = String(text).split(/\*\*(?!\*)/);
  const out = [];
  parts.forEach((t, i) => {
    if (!t) return;
    const bold = i % 2 === 1;
    const last = out[out.length - 1];
    if (last && last.bold === bold) last.text += t;
    else out.push({ text: t, bold });
  });
  return out;
}

/** Entfernt die Auszeichnung (für Klartext, z. B. Bildschirmleser oder CSV). */
export function plain(text) {
  return String(text).split(/\*\*(?!\*)/).join('').split(SHY).join('');
}
