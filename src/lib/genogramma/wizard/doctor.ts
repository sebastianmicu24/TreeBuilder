import { createIndividual, createPedigree, createUnion, type IdFactory } from "../model/create";
import type { Gender, Id, Individual, Pedigree, Sex } from "../model/types";

/**
 * Wizard medico: livello di dettaglio, sesso e genere del probando,
 * composizione della famiglia (uomini / donne / non specificati per
 * fratelli, zii paterni, zii materni, figli). Genera un albero subito
 * modificabile: i familiari non hanno dati (campi "non ancora chiesti").
 */
export type DetailLevel = "parents" | "grandparents" | "great-grandparents";

export interface Counts {
  male: number;
  female: number;
  unknown: number;
}

export interface DoctorWizardInput {
  level: DetailLevel;
  proband: { sex: Sex; gender: Gender };
  siblings: Counts;
  paternal: Counts;
  maternal: Counts;
  children: Counts;
  date?: string;
}

export const EMPTY_COUNTS: Counts = { male: 0, female: 0, unknown: 0 };
const MAX_PER_GROUP = 20;

function people(counts: Counts, make: (fields: Partial<Individual>) => Id): Id[] {
  const out: Id[] = [];
  const clamp = (n: number) => Math.max(0, Math.min(MAX_PER_GROUP, Math.floor(n || 0)));
  for (let i = 0; i < clamp(counts.male); i++) out.push(make({ sex: "male", gender: "not-expressed" }));
  for (let i = 0; i < clamp(counts.female); i++) out.push(make({ sex: "female", gender: "not-expressed" }));
  for (let i = 0; i < clamp(counts.unknown); i++) out.push(make({ sex: "unknown", gender: "unknown" }));
  return out;
}

export function buildFromDoctorWizard(input: DoctorWizardInput, ids: IdFactory, now = new Date()): Pedigree {
  const ped = createPedigree({ ids, date: input.date, now });
  let seq = 0;
  const add = (fields: Partial<Individual>): Id => {
    const id = ids();
    ped.individuals[id] = createIndividual(id, fields);
    return id;
  };
  const union = (partners: Id[], children: Id[]) => {
    const id = ids();
    ped.unions[id] = createUnion(id, partners, {
      sequence: ++seq,
      children: children.map((c) => ({ id: c, link: "biological" })),
    });
    return id;
  };
  const man = () => add({ sex: "male", gender: "man" });
  const woman = () => add({ sex: "female", gender: "woman" });

  const proband = add({ ...input.proband });
  ped.proband = proband;

  const father = man();
  const mother = woman();
  const siblings = people(input.siblings, add);
  union([father, mother], [proband, ...siblings]);

  const children = people(input.children, add);
  if (children.length) {
    const partnerFields: Partial<Individual> =
      input.proband.gender === "man" || (input.proband.gender !== "woman" && input.proband.sex === "male")
        ? { sex: "female", gender: "woman" }
        : input.proband.gender === "woman" || input.proband.sex === "female"
          ? { sex: "male", gender: "man" }
          : { sex: "unknown", gender: "unknown" };
    const partner = add(partnerFields);
    union([proband, partner], children);
  }

  const ancestors = (child: Id, depth: number) => {
    if (depth <= 0) return;
    const gf = man();
    const gm = woman();
    union([gf, gm], [child]);
    ancestors(gf, depth - 1);
    ancestors(gm, depth - 1);
  };

  const depth = input.level === "parents" ? 0 : input.level === "grandparents" ? 1 : 2;
  const paternal = people(input.paternal, add);
  const maternal = people(input.maternal, add);
  if (depth >= 1 || paternal.length || maternal.length) {
    // Zii e zie richiedono i nonni (linea di fratria).
    const gpf = man();
    const gmf = woman();
    union([gpf, gmf], [...paternal, father]);
    const gpm = man();
    const gmm = woman();
    union([gpm, gmm], [mother, ...maternal]);
    for (const g of [gpf, gmf, gpm, gmm]) ancestors(g, depth - 1);
  }
  return ped;
}
