import { DEFAULT_DISPLAY, PATTERN_ORDER, CONDITION_COLORS } from "./create";
import type {
  Age,
  ChildLink,
  DateValue,
  DisplaySettings,
  Id,
  Individual,
  IndividualCondition,
  IndividualEvaluation,
  LegendCondition,
  LegendEvaluation,
  Pedigree,
  Union,
} from "./types";
import { SCHEMA_VERSION } from "./types";

/**
 * Lettura difensiva di un genogramma da JSON (import di file, bozze locali).
 * Copia solo i campi noti con il tipo atteso: nessun campo sconosciuto,
 * nessuna chiave pericolosa (`__proto__`), stringhe troncate. Le versioni
 * future dello schema vengono rifiutate con un messaggio chiaro; quelle
 * passate (quando ci saranno) migrano qui, un passo alla volta.
 */

export type MigrateResult =
  | { ok: true; pedigree: Pedigree; warnings: string[] }
  | { ok: false; error: string };

export const MAX_INDIVIDUALS = 2000;
const MAX_TEXT = 2000;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, max = MAX_TEXT): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.length > max ? v.slice(0, max) : v;
}

function id(v: unknown): Id | undefined {
  const s = str(v, 128);
  if (!s || FORBIDDEN_KEYS.has(s)) return undefined;
  return s;
}

function num(v: unknown, min = -1e9, max = 1e9): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T;
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined;
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback?: T): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Copia un oggetto tenendo solo i campi definiti. */
function compact<T extends object>(o: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) (out as Obj)[k] = v;
  }
  return out;
}

function dateValue(v: unknown): DateValue | undefined {
  if (v === "unknown") return "unknown";
  if (isObj(v)) {
    const decade = num(v.decade, 1000, 3000);
    return decade !== undefined ? { decade } : undefined;
  }
  return str(v, 10);
}

function age(v: unknown): Age | undefined {
  if (v === "unknown") return "unknown";
  if (!isObj(v)) return undefined;
  if ("decade" in v) {
    const decade = num(v.decade, 0, 150);
    return decade !== undefined ? { decade } : undefined;
  }
  const value = num(v.value, 0, 200);
  const unit = oneOf(v.unit, ["y", "mo", "wk", "d", "gw"] as const);
  if (value === undefined || !unit) return undefined;
  return compact({ value, unit, approx: bool(v.approx) });
}

function individual(raw: unknown, key: Id): Individual | null {
  if (!isObj(raw)) return null;
  const conditions: IndividualCondition[] = Array.isArray(raw.conditions)
    ? raw.conditions.filter(isObj).flatMap((c) => {
        const conditionId = id(c.conditionId);
        const status = oneOf(c.status, ["affected", "carrier", "presymptomatic"] as const);
        if (!conditionId || !status) return [];
        return [compact({ conditionId, status, onset: age(c.onset), diagnosis: age(c.diagnosis) })];
      })
    : [];
  const evaluations: IndividualEvaluation[] = Array.isArray(raw.evaluations)
    ? raw.evaluations.filter(isObj).flatMap((e) => {
        const result = oneOf(e.result, ["+", "-", "u"] as const);
        if (!result) return [];
        const repeats =
          Array.isArray(e.repeats) && e.repeats.length === 2
            ? ([str(e.repeats[0], 40) ?? "", str(e.repeats[1], 40) ?? ""] as [string, string])
            : undefined;
        return [
          compact({
            evaluationId: id(e.evaluationId),
            result,
            detail: str(e.detail, 200),
            gene: str(e.gene, 60),
            variant: str(e.variant, 120),
            classification: str(e.classification, 60),
            date: str(e.date, 10),
            repeats,
          }),
        ];
      })
    : [];
  const death = isObj(raw.death)
    ? compact({ age: age(raw.death.age), date: dateValue(raw.death.date), cause: str(raw.death.cause, 300) })
    : undefined;
  const pregnancy = isObj(raw.pregnancy)
    ? (() => {
        const outcome = oneOf(raw.pregnancy.outcome, ["ongoing", "SAB", "TOP", "ECT", "SB"] as const);
        if (!outcome) return undefined;
        return compact({
          outcome,
          gestationalWeeks: num(raw.pregnancy.gestationalWeeks, 0, 45),
          result: str(raw.pregnancy.result, 120),
          method: str(raw.pregnancy.method, 60),
        });
      })()
    : undefined;
  const twin = isObj(raw.twin)
    ? (() => {
        const groupId = id(raw.twin.groupId);
        if (!groupId) return undefined;
        return compact({
          groupId,
          zygosity: oneOf(raw.twin.zygosity, ["MZ", "DZ", "unknown"] as const, "unknown"),
          proven: bool(raw.twin.proven),
        });
      })()
    : undefined;
  const noChildren = isObj(raw.noChildren)
    ? (() => {
        const kind = oneOf(raw.noChildren.kind, ["by-choice", "infertility"] as const);
        return kind ? compact({ kind, reason: str(raw.noChildren.reason, 200) }) : undefined;
      })()
    : undefined;
  const multiple =
    raw.multiple === "n" ? ("n" as const) : num(raw.multiple, 2, 99);
  return compact<Individual>({
    id: key,
    label: str(raw.label, 120),
    name: str(raw.name, 200),
    sex: oneOf(raw.sex, ["male", "female", "unassigned", "unknown"] as const, "unknown"),
    gender: oneOf(raw.gender, ["man", "woman", "non-binary", "unknown", "not-expressed"] as const, "not-expressed"),
    karyotype: str(raw.karyotype, 120),
    birth: dateValue(raw.birth),
    age: age(raw.age),
    vital: oneOf(raw.vital, ["alive", "deceased", "unknown"] as const, "alive"),
    death: death && Object.keys(death).length ? death : undefined,
    pregnancy,
    populationDescriptors: str(raw.populationDescriptors, 300),
    conditions,
    healthUnknown: bool(raw.healthUnknown),
    evaluations,
    documentedEvaluation: bool(raw.documentedEvaluation),
    familyHistoryUnknown: bool(raw.familyHistoryUnknown),
    multiple,
    twin,
    noChildren,
    birthOrder: num(raw.birthOrder, 1, 999),
    notes: str(raw.notes),
    placeholder: bool(raw.placeholder),
  });
}

function childLink(raw: unknown): ChildLink | null {
  if (!isObj(raw)) return null;
  const cid = id(raw.id);
  if (!cid) return null;
  const link = oneOf(raw.link, ["biological", "adoptive", "foster", "art"] as const, "biological");
  const art = isObj(raw.art)
    ? compact({
        eggFrom: id(raw.art.eggFrom),
        spermFrom: id(raw.art.spermFrom),
        carriedBy: id(raw.art.carriedBy),
        mitoFrom: id(raw.art.mitoFrom),
      })
    : undefined;
  return compact<ChildLink>({ id: cid, link, adoptedOut: bool(raw.adoptedOut), art });
}

function union(raw: unknown, key: Id): Union | null {
  if (!isObj(raw)) return null;
  const partners = Array.isArray(raw.partners)
    ? raw.partners.map(id).filter((x): x is Id => !!x).slice(0, 2)
    : [];
  const children = Array.isArray(raw.children)
    ? raw.children.map(childLink).filter((x): x is ChildLink => !!x)
    : [];
  const noChildren = isObj(raw.noChildren)
    ? (() => {
        const kind = oneOf(raw.noChildren.kind, ["by-choice", "infertility"] as const);
        return kind ? compact({ kind, reason: str(raw.noChildren.reason, 200) }) : undefined;
      })()
    : undefined;
  const partnerOrder = Array.isArray(raw.partnerOrder)
    ? raw.partnerOrder.map(id).filter((x): x is Id => !!x)
    : undefined;
  return compact<Union>({
    id: key,
    partners,
    status: oneOf(raw.status, ["current", "ended"] as const, "current"),
    sequence: num(raw.sequence, 0, 1e6) ?? 0,
    consanguinity: isObj(raw.consanguinity) ? compact({ degree: str(raw.consanguinity.degree, 120) }) : undefined,
    noChildren,
    children,
    childOrder: oneOf(raw.childOrder, ["auto", "manual"] as const, "auto"),
    partnerOrder,
  });
}

function display(raw: unknown): DisplaySettings {
  const d = isObj(raw) ? raw : {};
  const n = (k: keyof DisplaySettings, min: number, max: number) =>
    num(d[k], min, max) ?? (DEFAULT_DISPLAY[k] as number);
  const b = (k: keyof DisplaySettings) => bool(d[k]) ?? (DEFAULT_DISPLAY[k] as boolean);
  return {
    symbolSize: n("symbolSize", 16, 120),
    hSpacing: n("hSpacing", 8, 300),
    vSpacing: n("vSpacing", 16, 400),
    fontSize: n("fontSize", 6, 32),
    textGap: n("textGap", 0, 60),
    fontFamily: oneOf(d.fontFamily, ["Arial", "Helvetica", "Times New Roman", "Courier New"] as const, DEFAULT_DISPLAY.fontFamily),
    labelMaxWidth: n("labelMaxWidth", 40, 600),
    showLabel: b("showLabel"),
    showConditions: b("showConditions"),
    showEvaluations: b("showEvaluations"),
    showNotes: b("showNotes"),
    showNumbers: b("showNumbers"),
    showLegend: b("showLegend"),
    showMetadata: b("showMetadata"),
    color: b("color"),
    language: oneOf(d.language, ["en", "it"] as const, DEFAULT_DISPLAY.language),
    maleLeft: b("maleLeft"),
    straightLines: b("straightLines"),
    hidePriorPartners: b("hidePriorPartners"),
    legacyCarrierDot: b("legacyCarrierDot"),
  };
}

/** Converte un valore qualsiasi (JSON già interpretato) in un genogramma valido. */
export function migrate(input: unknown): MigrateResult {
  if (!isObj(input)) return { ok: false, error: "Il file non contiene un genogramma." };
  const version = input.schemaVersion;
  if (typeof version !== "number") {
    return { ok: false, error: "Il file non indica la versione dello schema (schemaVersion)." };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Il file è stato creato con una versione più recente dello strumento (schema ${version}). Aggiorna la pagina e riprova.`,
    };
  }
  if (version < 1) return { ok: false, error: "Versione dello schema non valida." };

  const warnings: string[] = [];
  const individuals: Record<Id, Individual> = {};
  const rawInd = isObj(input.individuals) ? input.individuals : {};
  const keys = Object.keys(rawInd);
  if (keys.length > MAX_INDIVIDUALS) {
    return { ok: false, error: `Il file contiene troppi familiari (massimo ${MAX_INDIVIDUALS}).` };
  }
  for (const k of keys) {
    const key = id(k);
    const ind = key ? individual(rawInd[k], key) : null;
    if (ind) individuals[ind.id] = ind;
    else warnings.push("Un familiare non valido è stato ignorato.");
  }
  const unions: Record<Id, Union> = {};
  const rawUnions = isObj(input.unions) ? input.unions : {};
  for (const k of Object.keys(rawUnions)) {
    const key = id(k);
    const u = key ? union(rawUnions[k], key) : null;
    if (u) unions[u.id] = u;
    else warnings.push("Un'unione non valida è stata ignorata.");
  }

  const legendRaw = isObj(input.legend) ? input.legend : {};
  const conditions: LegendCondition[] = Array.isArray(legendRaw.conditions)
    ? legendRaw.conditions.filter(isObj).flatMap((c, i) => {
        const cid = id(c.id);
        if (!cid) return [];
        const codes = Array.isArray(c.codes)
          ? c.codes.filter(isObj).flatMap((code) => {
              const system = oneOf(code.system, ["HPO", "ORPHA", "OMIM", "ICD10", "ICD11"] as const);
              const value = str(code.code, 40);
              return system && value ? [{ system, code: value }] : [];
            })
          : [];
        return [
          {
            id: cid,
            label: str(c.label, 200) ?? "Condizione",
            codes,
            pattern: oneOf(c.pattern, PATTERN_ORDER, PATTERN_ORDER[i % PATTERN_ORDER.length]),
            color:
              typeof c.color === "string" && /^#[0-9a-fA-F]{6}$/.test(c.color)
                ? c.color
                : CONDITION_COLORS[i % CONDITION_COLORS.length],
          },
        ];
      })
    : [];
  const evaluations: LegendEvaluation[] = Array.isArray(legendRaw.evaluations)
    ? legendRaw.evaluations.filter(isObj).flatMap((e) => {
        const eid = id(e.id);
        return eid ? [{ id: eid, label: str(e.label, 200) ?? "" }] : [];
      })
    : [];

  const metaRaw = isObj(input.meta) ? input.meta : {};
  const meta = compact({
    title: str(metaRaw.title, 200),
    compiledBy: str(metaRaw.compiledBy, 200),
    compilerRole: str(metaRaw.compilerRole, 200),
    historian: str(metaRaw.historian, 200),
    reason: str(metaRaw.reason, 500),
    ancestryPaternal: str(metaRaw.ancestryPaternal, 300),
    ancestryMaternal: str(metaRaw.ancestryMaternal, 300),
    updated: str(metaRaw.updated, 10),
  });

  const now = new Date().toISOString();
  const proband = id(input.proband);
  const pedigree: Pedigree = compact<Pedigree>({
    id: id(input.id) ?? "importato",
    schemaVersion: SCHEMA_VERSION,
    date: str(input.date, 10) ?? now.slice(0, 10),
    createdAt: str(input.createdAt, 40) ?? now,
    updatedAt: str(input.updatedAt, 40) ?? now,
    proband: proband && individuals[proband] ? proband : undefined,
    consultands: Array.isArray(input.consultands)
      ? input.consultands.map(id).filter((x): x is Id => !!x && !!individuals[x])
      : [],
    meta,
    legend: { conditions, evaluations },
    individuals,
    unions,
    display: display(input.display),
  });
  return { ok: true, pedigree, warnings };
}
