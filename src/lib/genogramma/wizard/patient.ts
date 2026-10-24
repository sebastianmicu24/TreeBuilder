import { createIndividual, createPedigree, createUnion, nextConditionStyle, type IdFactory } from "../model/create";
import type { Age, DateValue, Gender, Id, Individual, Pedigree, PregnancyOutcome, Sex } from "../model/types";
import { CONDITION_VOCAB } from "../vocab/conditions";

/**
 * Questionario del paziente: risposte strutturate, passi calcolati dalle
 * risposte (una scheda per ogni familiare, con salto e ripresa) e
 * costruzione del genogramma. "Non lo so" diventa "unknown" nel modello,
 * mai un campo vuoto: la vista medico lo mostra come dato da completare.
 */

export type YesNoUnknown = "yes" | "no" | "unknown";

export interface HealthAnswer {
  label: string;
  onset?: Age;
}

export interface PersonAnswer {
  /** Iniziali facoltative (minimizzazione: niente nomi). */
  initials?: string;
  sex?: Sex;
  gender?: Gender;
  birthYear?: DateValue;
  age?: Age;
  alive?: YesNoUnknown;
  deathAge?: Age;
  deathCause?: string;
  health: HealthAnswer[];
  healthUnknown?: boolean;
  /** Il familiare è noto? (per genitori e nonni). */
  known?: YesNoUnknown;
  skipped?: boolean;
}

export interface CountAnswer {
  male: number;
  female: number;
  unknown: number;
}

export type Respondent = "self" | "parent" | "other";

export interface PatientAnswers {
  respondent?: Respondent;
  /** Se compila un genitore: madre o padre del probando. */
  respondentRole?: "mother" | "father" | "other";
  proband: PersonAnswer;
  mother: PersonAnswer;
  father: PersonAnswer;
  parentsRelated?: YesNoUnknown;
  parentsRelatedHow?: string;
  siblings: CountAnswer;
  halfPaternal: CountAnswer;
  halfMaternal: CountAnswer;
  siblingCards: PersonAnswer[];
  children: CountAnswer;
  childCards: PersonAnswer[];
  grandparents: { pf: PersonAnswer; pm: PersonAnswer; mf: PersonAnswer; mm: PersonAnswer };
  unclesPaternal: CountAnswer;
  unclesMaternal: CountAnswer;
  uncleCards: PersonAnswer[];
  losses: { outcome: Exclude<PregnancyOutcome, "ongoing">; weeks?: number }[];
  ancestryPaternal?: string;
  ancestryMaternal?: string;
  reason?: string;
}

const emptyPerson = (fields: Partial<PersonAnswer> = {}): PersonAnswer => ({ health: [], ...fields });
const zero = (): CountAnswer => ({ male: 0, female: 0, unknown: 0 });

export function emptyAnswers(): PatientAnswers {
  return {
    proband: emptyPerson({ sex: undefined }),
    mother: emptyPerson({ sex: "female", gender: "woman" }),
    father: emptyPerson({ sex: "male", gender: "man" }),
    siblings: zero(),
    halfPaternal: zero(),
    halfMaternal: zero(),
    siblingCards: [],
    children: zero(),
    childCards: [],
    grandparents: {
      pf: emptyPerson({ sex: "male", gender: "man" }),
      pm: emptyPerson({ sex: "female", gender: "woman" }),
      mf: emptyPerson({ sex: "male", gender: "man" }),
      mm: emptyPerson({ sex: "female", gender: "woman" }),
    },
    unclesPaternal: zero(),
    unclesMaternal: zero(),
    uncleCards: [],
    losses: [],
  };
}

const MAX = 15;
const clampCount = (c: CountAnswer): CountAnswer => ({
  male: Math.max(0, Math.min(MAX, c.male | 0)),
  female: Math.max(0, Math.min(MAX, c.female | 0)),
  unknown: Math.max(0, Math.min(MAX, c.unknown | 0)),
});

/** Sesso delle schede di un gruppo, nell'ordine maschi, femmine, non specificati. */
export function cardSexes(...counts: CountAnswer[]): Sex[] {
  const out: Sex[] = [];
  for (const raw of counts) {
    const c = clampCount(raw);
    for (let i = 0; i < c.male; i++) out.push("male");
    for (let i = 0; i < c.female; i++) out.push("female");
    for (let i = 0; i < c.unknown; i++) out.push("unknown");
  }
  return out;
}

/** Allinea le schede ripetute ai conteggi (senza perdere quelle già compilate). */
export function syncCards(cards: PersonAnswer[], sexes: Sex[]): PersonAnswer[] {
  return sexes.map((sex, i) => {
    const prev = cards[i];
    if (prev && prev.sex === sex) return prev;
    return emptyPerson({ sex, gender: "not-expressed" });
  });
}

/* ------------------------------------------------------------------ */
/* Passi                                                               */
/* ------------------------------------------------------------------ */

export type StepId =
  | "respondent"
  | "proband"
  | "probandHealth"
  | "mother"
  | "father"
  | "parentsRelated"
  | "siblingsCount"
  | "sibling"
  | "childrenCount"
  | "child"
  | "grandparent"
  | "unclesCount"
  | "uncle"
  | "losses"
  | "origins"
  | "reason"
  | "summary";

export interface Step {
  id: StepId;
  /** Indice della scheda per i passi ripetuti. */
  index?: number;
  /** Nonno/nonna per il passo "grandparent". */
  gp?: "pf" | "pm" | "mf" | "mm";
  title: string;
}

const GP_TITLES = {
  pf: "Nonno paterno",
  pm: "Nonna paterna",
  mf: "Nonno materno",
  mm: "Nonna materna",
} as const;

export function siblingTitle(a: PatientAnswers, i: number): string {
  const full = cardSexes(a.siblings).length;
  const hp = cardSexes(a.halfPaternal).length;
  const sex = a.siblingCards[i]?.sex;
  const base = sex === "male" ? "Fratello" : sex === "female" ? "Sorella" : "Fratello o sorella";
  const group = (k: number) => (k < full ? 0 : k < full + hp ? 1 : 2);
  const kind = ["", " (stesso padre)", " (stessa madre)"][group(i)];
  // Numerati dentro il proprio gruppo: "Sorella 1", non "Sorella 3".
  let n = 0;
  for (let k = 0; k <= i; k++) if (group(k) === group(i) && a.siblingCards[k]?.sex === sex) n += 1;
  return `${base} ${n}${kind}`;
}

export function buildSteps(a: PatientAnswers): Step[] {
  const steps: Step[] = [
    { id: "respondent", title: "Chi compila" },
    { id: "proband", title: a.respondent === "parent" ? "Tuo figlio o tua figlia" : a.respondent === "other" ? "La persona per cui compili" : "Tu" },
    { id: "probandHealth", title: "Problemi di salute" },
    { id: "mother", title: "La madre" },
    { id: "father", title: "Il padre" },
    { id: "parentsRelated", title: "Parentela tra i genitori" },
    { id: "siblingsCount", title: "Fratelli e sorelle" },
  ];
  a.siblingCards.forEach((_, i) => steps.push({ id: "sibling", index: i, title: siblingTitle(a, i) }));
  steps.push({ id: "childrenCount", title: "Figli" });
  const ordinal = (cards: PersonAnswer[], i: number, same: (k: number) => boolean) => {
    let n = 0;
    for (let k = 0; k <= i; k++) if (cards[k]?.sex === cards[i]?.sex && same(k)) n += 1;
    return n;
  };
  a.childCards.forEach((c, i) =>
    steps.push({
      id: "child",
      index: i,
      title: `${c.sex === "male" ? "Figlio" : c.sex === "female" ? "Figlia" : "Figlio o figlia"} ${ordinal(a.childCards, i, () => true)}`,
    })
  );
  const motherKnown = a.mother.known !== "no";
  const fatherKnown = a.father.known !== "no";
  for (const gp of ["pf", "pm", "mf", "mm"] as const) {
    if ((gp[0] === "p" && fatherKnown) || (gp[0] === "m" && motherKnown)) steps.push({ id: "grandparent", gp, title: GP_TITLES[gp] });
  }
  steps.push({ id: "unclesCount", title: "Zii e zie" });
  const pCount = cardSexes(a.unclesPaternal).length;
  a.uncleCards.forEach((c, i) => {
    const paternal = i < pCount;
    const base = c.sex === "male" ? "Zio" : c.sex === "female" ? "Zia" : "Zio o zia";
    const side = paternal ? (c.sex === "female" ? "paterna" : "paterno") : c.sex === "female" ? "materna" : "materno";
    const n = ordinal(a.uncleCards, i, (k) => k < pCount === paternal);
    steps.push({ id: "uncle", index: i, title: `${base} ${side} ${n}` });
  });
  steps.push({ id: "losses", title: "Gravidanze non andate a termine" });
  steps.push({ id: "origins", title: "Origini della famiglia" });
  steps.push({ id: "reason", title: "Motivo della visita" });
  steps.push({ id: "summary", title: "Riepilogo" });
  return steps;
}

/* ------------------------------------------------------------------ */
/* Costruzione del genogramma                                           */
/* ------------------------------------------------------------------ */

export function buildFromPatient(a: PatientAnswers, ids: IdFactory, now = new Date()): Pedigree {
  const ped = createPedigree({ ids, now });
  let seq = 0;
  const conditionIds = new Map<string, Id>();

  const conditionId = (label: string): Id => {
    const key = label.trim().toLowerCase();
    const existing = conditionIds.get(key);
    if (existing) return existing;
    const id = ids();
    const vocab = CONDITION_VOCAB.find((v) => v.label.toLowerCase() === key);
    ped.legend.conditions.push({
      id,
      label: label.trim().slice(0, 120),
      codes: vocab ? vocab.codes : [],
      ...nextConditionStyle(ped.legend.conditions),
    });
    conditionIds.set(key, id);
    return id;
  };

  const person = (p: PersonAnswer, defaults: Partial<Individual>): Id => {
    const id = ids();
    const fields: Partial<Individual> = { ...defaults };
    if (p.sex) fields.sex = p.sex;
    if (p.gender) fields.gender = p.gender;
    if (p.initials?.trim()) fields.label = p.initials.trim().slice(0, 12);
    if (p.birthYear !== undefined) fields.birth = p.birthYear;
    else if (p.age !== undefined) fields.age = p.age;
    if (p.alive === "no") {
      fields.vital = "deceased";
      fields.death = {};
      if (p.deathAge !== undefined) fields.death.age = p.deathAge;
      if (p.deathCause?.trim()) fields.death.cause = p.deathCause.trim().slice(0, 200);
    } else if (p.alive === "unknown") {
      fields.vital = "unknown";
    }
    if (p.healthUnknown) fields.healthUnknown = true;
    fields.conditions = p.health
      .filter((h) => h.label.trim())
      .map((h) => ({ conditionId: conditionId(h.label), status: "affected" as const, onset: h.onset }));
    if (p.known === "no" || p.known === "unknown") {
      fields.placeholder = p.known === "no";
      fields.familyHistoryUnknown = true;
    }
    ped.individuals[id] = createIndividual(id, fields);
    return id;
  };
  const union = (partners: Id[], children: Id[], extra: Partial<Pedigree["unions"][string]> = {}) => {
    const id = ids();
    ped.unions[id] = createUnion(id, partners, {
      sequence: ++seq,
      children: children.map((c) => ({ id: c, link: "biological" })),
      ...extra,
    });
    return id;
  };

  const proband = person(a.proband, { sex: "unknown", gender: "not-expressed" });
  ped.proband = proband;

  // Un genitore "non noto" non diventa un individuo: la linea scende dal
  // solo genitore noto (decisione di progetto). Se nessuno dei due è noto
  // servono due segnaposto per la linea di fratria.
  const motherKnown = a.mother.known !== "no";
  const fatherKnown = a.father.known !== "no";
  const bothUnknown = !motherKnown && !fatherKnown;
  const mother = motherKnown || bothUnknown ? person(a.mother, { sex: "female", gender: "woman" }) : null;
  const father = fatherKnown || bothUnknown ? person(a.father, { sex: "male", gender: "man" }) : null;

  const full = cardSexes(a.siblings).length;
  const hp = cardSexes(a.halfPaternal).length;
  const sibs = a.siblingCards.map((c) => person(c, { sex: c.sex ?? "unknown", gender: "not-expressed" }));
  const fullSibs = sibs.slice(0, full);
  const halfP = sibs.slice(full, full + hp);
  const halfM = sibs.slice(full + hp);

  const parentsUnion = union([father, mother].filter((x): x is Id => !!x), [proband, ...fullSibs], {
    consanguinity:
      a.parentsRelated === "yes" && father && mother ? { degree: a.parentsRelatedHow?.trim() || undefined } : undefined,
  });
  // Mezzi fratelli: figli dello stesso genitore con un altro partner (non noto).
  if (halfP.length && father) union([father], halfP, { status: "ended", sequence: 0 });
  if (halfM.length && mother) union([mother], halfM, { status: "ended", sequence: 0 });

  if (a.childCards.length) {
    const p = a.proband;
    const partnerFields: Partial<Individual> =
      p.gender === "man" || (p.gender !== "woman" && p.sex === "male")
        ? { sex: "female", gender: "woman" }
        : p.gender === "woman" || p.sex === "female"
          ? { sex: "male", gender: "man" }
          : { sex: "unknown", gender: "unknown" };
    const kids = a.childCards.map((c) => person(c, { sex: c.sex ?? "unknown", gender: "not-expressed" }));
    union([proband, person(emptyPerson(), partnerFields)], kids);
  }

  const paternalCount = cardSexes(a.unclesPaternal).length;
  const uncles = a.uncleCards.map((c) => person(c, { sex: c.sex ?? "unknown", gender: "not-expressed" }));
  const paternalUncles = uncles.slice(0, paternalCount);
  const maternalUncles = uncles.slice(paternalCount);

  const gpFilled = (p: PersonAnswer) =>
    p.known !== undefined || p.birthYear !== undefined || p.age !== undefined || p.alive !== undefined || p.health.length > 0;
  if (father && fatherKnown && (gpFilled(a.grandparents.pf) || gpFilled(a.grandparents.pm) || paternalUncles.length)) {
    union([person(a.grandparents.pf, { sex: "male", gender: "man" }), person(a.grandparents.pm, { sex: "female", gender: "woman" })], [
      ...paternalUncles,
      father,
    ]);
  }
  if (mother && motherKnown && (gpFilled(a.grandparents.mf) || gpFilled(a.grandparents.mm) || maternalUncles.length)) {
    union([person(a.grandparents.mf, { sex: "male", gender: "man" }), person(a.grandparents.mm, { sex: "female", gender: "woman" })], [
      mother,
      ...maternalUncles,
    ]);
  }

  // Gravidanze della madre del probando non andate a termine.
  for (const loss of a.losses.slice(0, 20)) {
    const id = ids();
    ped.individuals[id] = createIndividual(id, {
      vital: "deceased",
      pregnancy: { outcome: loss.outcome, gestationalWeeks: loss.weeks },
    });
    ped.unions[parentsUnion].children.push({ id, link: "biological" });
  }

  // Chi compila: il consultando (genitore che compila per un figlio).
  if (a.respondent === "parent") {
    if (a.respondentRole === "mother" && mother) ped.consultands = [mother];
    else if (a.respondentRole === "father" && father) ped.consultands = [father];
  } else if (a.respondent === "self") {
    ped.consultands = [proband];
  }

  ped.meta = {
    historian:
      a.respondent === "parent"
        ? a.respondentRole === "father"
          ? "padre del probando"
          : a.respondentRole === "mother"
            ? "madre del probando"
            : "genitore del probando"
        : a.respondent === "self"
          ? "probando"
          : a.respondent === "other"
            ? "familiare o assistente"
            : undefined,
    reason: a.reason?.trim().slice(0, 500) || undefined,
    ancestryPaternal: a.ancestryPaternal?.trim().slice(0, 200) || undefined,
    ancestryMaternal: a.ancestryMaternal?.trim().slice(0, 200) || undefined,
  };
  return ped;
}

/** Schede saltate, da riprendere (passo e titolo). */
export function skippedSteps(a: PatientAnswers, steps: Step[]): Step[] {
  return steps.filter((s) => {
    if (s.id === "sibling") return a.siblingCards[s.index!]?.skipped;
    if (s.id === "child") return a.childCards[s.index!]?.skipped;
    if (s.id === "uncle") return a.uncleCards[s.index!]?.skipped;
    if (s.id === "grandparent") return a.grandparents[s.gp!].skipped;
    if (s.id === "mother") return a.mother.skipped;
    if (s.id === "father") return a.father.skipped;
    return false;
  });
}
