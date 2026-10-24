import type {
  DisplaySettings,
  Id,
  Individual,
  LegendCondition,
  PartialDate,
  PatternId,
  Pedigree,
  Union,
} from "./types";
import { SCHEMA_VERSION } from "./types";

/** Generatore di ID: UUID nel browser, sostituibile nei test per avere ID leggibili. */
export type IdFactory = () => Id;

export const uuid: IdFactory = () => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Ripiego (contesti non sicuri): sufficiente per ID locali, non crittografici.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** ID sequenziali deterministici (fixture e test). */
export function sequentialIds(prefix = "i"): IdFactory {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export const DEFAULT_DISPLAY: DisplaySettings = {
  symbolSize: 40,
  hSpacing: 28,
  vSpacing: 56,
  fontSize: 11,
  textGap: 6,
  fontFamily: "Arial",
  labelMaxWidth: 130,
  showLabel: true,
  showConditions: true,
  showEvaluations: true,
  showNotes: false,
  showNumbers: true,
  showLegend: true,
  showMetadata: true,
  color: false,
  language: "it",
  maleLeft: false,
  straightLines: true,
  hidePriorPartners: false,
  legacyCarrierDot: false,
};

/**
 * Riempimenti assegnati in ordine alle nuove condizioni: dal più al meno
 * leggibile in bianco e nero.
 */
export const PATTERN_ORDER: PatternId[] = [
  "solid",
  "hatch",
  "dots",
  "crosshatch",
  "vertical",
  "hatch-reverse",
  "horizontal",
  "grid",
];

/** Colori (modalità colori) distinguibili anche da chi ha deficit del rosso-verde. */
export const CONDITION_COLORS = [
  "#1f2937",
  "#ae1c33",
  "#1d4ed8",
  "#b45309",
  "#047857",
  "#6d28d9",
  "#0e7490",
  "#be185d",
];

export function todayPartialDate(now: Date = new Date()): PartialDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function createPedigree(
  opts: { id?: Id; date?: PartialDate; now?: Date; ids?: IdFactory } = {}
): Pedigree {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  return {
    id: opts.id ?? (opts.ids ?? uuid)(),
    schemaVersion: SCHEMA_VERSION,
    date: opts.date ?? todayPartialDate(now),
    createdAt: iso,
    updatedAt: iso,
    consultands: [],
    meta: {},
    legend: { conditions: [], evaluations: [] },
    individuals: {},
    unions: {},
    display: { ...DEFAULT_DISPLAY },
  };
}

export function createIndividual(
  id: Id,
  fields: Partial<Omit<Individual, "id">> = {}
): Individual {
  return {
    id,
    sex: "unknown",
    gender: "not-expressed",
    vital: "alive",
    conditions: [],
    evaluations: [],
    ...fields,
  };
}

export function createUnion(
  id: Id,
  partners: Id[],
  fields: Partial<Omit<Union, "id" | "partners">> = {}
): Union {
  return {
    id,
    partners,
    status: "current",
    sequence: 0,
    children: [],
    childOrder: "auto",
    ...fields,
  };
}

/** Prossimo riempimento libero per una nuova condizione in legenda. */
export function nextConditionStyle(
  existing: LegendCondition[]
): Pick<LegendCondition, "pattern" | "color"> {
  const used = new Set(existing.map((c) => c.pattern));
  const pattern =
    PATTERN_ORDER.find((p) => !used.has(p)) ??
    PATTERN_ORDER[existing.length % PATTERN_ORDER.length];
  const color = CONDITION_COLORS[existing.length % CONDITION_COLORS.length];
  return { pattern, color };
}
