import type { Age, AgeUnit, DateValue, Individual, PartialDate } from "./types";

/**
 * Date ed età. Tutti i calcoli sono relativi alla data del genogramma
 * (`pedigree.date`), mai a "oggi": lo stesso file dà lo stesso disegno.
 * Le date diventano intervalli in anni frazionari, così si confrontano
 * anche precisioni diverse (solo anno, anno-mese, data completa, decennio).
 */

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const YEAR_DAYS = 365.25;

export type Interval = [number, number];

export interface ParsedDate {
  y: number;
  m?: number;
  d?: number;
}

export function parsePartialDate(s: string | undefined): ParsedDate | null {
  if (!s) return null;
  const match = DATE_RE.exec(s.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = match[2] ? Number(match[2]) : undefined;
  const d = match[3] ? Number(match[3]) : undefined;
  if (m !== undefined && (m < 1 || m > 12)) return null;
  if (d !== undefined && (d < 1 || d > daysInMonth(y, m!))) return null;
  return { y, m, d };
}

export function isPartialDate(s: unknown): s is PartialDate {
  return typeof s === "string" && parsePartialDate(s) !== null;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayOfYear(y: number, m: number, d: number): number {
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000;
}

/** Intervallo [inizio, fine] in anni frazionari coperto da una data. */
export function dateInterval(v: DateValue | undefined): Interval | null {
  if (v === undefined || v === "unknown") return null;
  if (typeof v === "object") return [v.decade, v.decade + 10];
  const p = parsePartialDate(v);
  if (!p) return null;
  if (p.m === undefined) return [p.y, p.y + 1];
  if (p.d === undefined) return [p.y + (p.m - 1) / 12, p.y + p.m / 12];
  const t = p.y + dayOfYear(p.y, p.m, p.d) / YEAR_DAYS;
  return [t, t];
}

/** Istante di riferimento (anni frazionari) della data del genogramma. */
export function referenceTime(date: PartialDate): number {
  const iv = dateInterval(date);
  if (!iv) return new Date().getUTCFullYear();
  return (iv[0] + iv[1]) / 2;
}

/** Età espressa come intervallo in anni. */
export function ageInterval(age: Age | undefined): Interval | null {
  if (age === undefined || age === "unknown") return null;
  if ("decade" in age) return [age.decade, age.decade + 10];
  const years = ageValueInYears(age.value, age.unit);
  const slack = age.approx ? Math.max(1, years * 0.1) : unitSlack(age.unit);
  return [Math.max(0, years - slack), years + slack];
}

function ageValueInYears(value: number, unit: AgeUnit): number {
  switch (unit) {
    case "y":
      return value;
    case "mo":
      return value / 12;
    case "wk":
      return (value * 7) / YEAR_DAYS;
    case "d":
      return value / YEAR_DAYS;
    case "gw":
      // Una gravidanza non è ancora nata: età "negativa" fino al parto.
      return (-(40 - value) * 7) / YEAR_DAYS;
    default:
      return value;
  }
}

/** Mezza ampiezza dell'incertezza di un'età intera nella sua unità. */
function unitSlack(unit: string): number {
  switch (unit) {
    case "y":
      return 0.5;
    case "mo":
      return 1 / 24;
    case "wk":
      return 3.5 / YEAR_DAYS;
    default:
      return 0.5 / YEAR_DAYS;
  }
}

/**
 * Intervallo dell'anno di nascita: dalla data, oppure dall'età alla data
 * del genogramma, oppure da data ed età del decesso. Null se ignoto.
 */
export function birthInterval(ind: Individual, refDate: PartialDate): Interval | null {
  const fromDate = dateInterval(ind.birth);
  if (fromDate) return fromDate;
  const ref = referenceTime(refDate);
  if (ind.pregnancy?.outcome === "ongoing") {
    const weeks = ind.pregnancy.gestationalWeeks ?? 20;
    const t = ref + ((40 - weeks) * 7) / YEAR_DAYS;
    return [t, t];
  }
  if (ind.vital !== "deceased") {
    const age = ageInterval(ind.age);
    if (age) return [ref - age[1], ref - age[0]];
  }
  const deathAt = dateInterval(ind.death?.date);
  const deathAge = ageInterval(ind.death?.age);
  if (deathAt && deathAge) return [deathAt[0] - deathAge[1], deathAt[1] - deathAge[0]];
  return null;
}

/** Punto centrale di un intervallo (chiave di ordinamento). */
export function midpoint(iv: Interval): number {
  return (iv[0] + iv[1]) / 2;
}

/**
 * Età alla data del genogramma, calcolata dalla data di nascita quando
 * l'età non è stata indicata. Unità adatte ai neonati: giorni sotto le 4
 * settimane, settimane sotto i 3 mesi, mesi sotto i 2 anni.
 */
export function computeAge(ind: Individual, refDate: PartialDate): Age | undefined {
  if (ind.age !== undefined) return ind.age;
  if (ind.vital === "deceased" || ind.pregnancy) return undefined;
  if (ind.birth === undefined || ind.birth === "unknown" || typeof ind.birth === "object") {
    return undefined;
  }
  const birth = parsePartialDate(ind.birth);
  const ref = parsePartialDate(refDate);
  if (!birth || !ref) return undefined;
  if (birth.d !== undefined && ref.d !== undefined && birth.m && ref.m) {
    const days =
      (Date.UTC(ref.y, ref.m - 1, ref.d) - Date.UTC(birth.y, birth.m - 1, birth.d)) /
      86_400_000;
    if (days < 0) return undefined;
    if (days < 28) return { value: Math.floor(days), unit: "d" };
    if (days < 91) return { value: Math.floor(days / 7), unit: "wk" };
    const months = wholeMonths(birth, ref);
    if (months < 24) return { value: months, unit: "mo" };
    return { value: Math.floor(months / 12), unit: "y" };
  }
  if (birth.m !== undefined && ref.m !== undefined) {
    const months = (ref.y - birth.y) * 12 + (ref.m - birth.m);
    if (months < 0) return undefined;
    if (months < 24) return { value: months, unit: "mo", approx: true };
    return { value: Math.floor(months / 12), unit: "y" };
  }
  const years = ref.y - birth.y;
  if (years < 0) return undefined;
  return { value: years, unit: "y", approx: true };
}

function wholeMonths(a: ParsedDate, b: ParsedDate): number {
  let months = (b.y - a.y) * 12 + ((b.m ?? 1) - (a.m ?? 1));
  if ((b.d ?? 1) < (a.d ?? 1)) months -= 1;
  return Math.max(0, months);
}

const UNIT_LABEL: Record<string, string> = { y: "y", mo: " mo", wk: " wk", d: " d", gw: " wk" };

/** Età in notazione NSGC: `34y`, `4 mo`, `16 wk`, `3 d`, `60's`, `~34y`. */
export function formatAge(age: Age | undefined): string {
  if (age === undefined) return "";
  if (age === "unknown") return "?";
  if ("decade" in age) return `${age.decade}'s`;
  return `${age.approx ? "~" : ""}${trimNumber(age.value)}${UNIT_LABEL[age.unit] ?? ""}`;
}

/** Data in notazione NSGC per le etichette: anno, decennio (`1960's`) o data. */
export function formatDateValue(v: DateValue | undefined, full = false): string {
  if (v === undefined) return "";
  if (v === "unknown") return "?";
  if (typeof v === "object") return `${v.decade}'s`;
  const p = parsePartialDate(v);
  if (!p) return "";
  return full ? v : String(p.y);
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** Vero se la data contiene mese e giorno (dato più identificante dell'anno). */
export function isFullDate(v: DateValue | undefined): boolean {
  if (typeof v !== "string" || v === "unknown") return false;
  return parsePartialDate(v)?.d !== undefined;
}
