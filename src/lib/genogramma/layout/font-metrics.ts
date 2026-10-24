import type { FontFamily } from "../model/types";

/**
 * Larghezze dei caratteri (unità per 1000 em) dalle metriche AFM dei font
 * PostScript Core 14: Helvetica (Arial ha le stesse larghezze), Times-Roman
 * (Times New Roman), Courier (monospazio). Così il layout è puro: niente
 * misure nel DOM, vista ed export coincidono, i test girano senza browser.
 */

// Codici 32–126.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const TIMES = [
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278, 500, 500, 500,
  500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444, 921, 722, 667, 667, 722, 611,
  556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722,
  722, 611, 333, 278, 333, 469, 500, 333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500,
  278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541,
];

/** Caratteri fuori ASCII più comuni nei testi italiani, mappati sulla lettera base. */
const BASE_CHAR: Record<string, string> = {
  à: "a", á: "a", è: "e", é: "e", ì: "i", í: "i", ò: "o", ó: "o", ù: "u", ú: "u",
  À: "A", Á: "A", È: "E", É: "E", Ì: "I", Í: "I", Ò: "O", Ó: "O", Ù: "U", Ú: "U",
  ç: "c", Ç: "C", ñ: "n", Ñ: "N", ä: "a", ö: "o", ü: "u", Ä: "A", Ö: "O", Ü: "U",
  "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "·": ".", "°": "o",
};

const SPECIAL: Record<string, [number, number]> = {
  // [Helvetica, Times]
  "—": [1000, 1000],
  "…": [1000, 1000],
  "×": [584, 564],
  "±": [584, 564],
  "≥": [549, 549],
  "≤": [549, 549],
  "~": [584, 541],
};

function table(font: FontFamily): number[] | null {
  if (font === "Times New Roman") return TIMES;
  if (font === "Courier New") return null;
  return HELVETICA;
}

function charWidth(ch: string, font: FontFamily): number {
  if (font === "Courier New") return 600;
  const special = SPECIAL[ch];
  if (special) return font === "Times New Roman" ? special[1] : special[0];
  const base = BASE_CHAR[ch] ?? ch;
  const code = base.charCodeAt(0);
  const t = table(font)!;
  if (code >= 32 && code <= 126) return t[code - 32];
  return font === "Times New Roman" ? 500 : 556;
}

/** Larghezza del testo in pixel alla dimensione indicata. */
export function textWidth(text: string, fontSize: number, font: FontFamily = "Arial", bold = false): number {
  let units = 0;
  for (const ch of text) units += charWidth(ch, font);
  // Il grassetto è circa il 7% più largo nelle famiglie usate.
  return (units / 1000) * fontSize * (bold ? 1.07 : 1);
}

/** Pila di font per SVG ed export: solo font presenti su ogni sistema (e in PowerPoint). */
export function fontStack(font: FontFamily): string {
  switch (font) {
    case "Times New Roman":
      return "'Times New Roman', Times, serif";
    case "Courier New":
      return "'Courier New', Courier, monospace";
    case "Helvetica":
      return "Helvetica, Arial, sans-serif";
    default:
      return "Arial, Helvetica, sans-serif";
  }
}

/**
 * Va a capo alla larghezza massima, per parole; le parole più lunghe della
 * riga vengono spezzate per caratteri.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number, font: FontFamily): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, fontSize, font) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      line = "";
      if (textWidth(word, fontSize, font) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        if (textWidth(chunk + ch, fontSize, font) > maxWidth && chunk) {
          out.push(chunk);
          chunk = "";
        }
        chunk += ch;
      }
      line = chunk;
    }
    if (line) out.push(line);
  }
  return out;
}
