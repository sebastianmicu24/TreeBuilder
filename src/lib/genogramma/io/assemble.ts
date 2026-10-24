import { createIndividual, createPedigree, createUnion, uuid, type IdFactory } from "../model/create";
import type { ArtDetails, ChildLinkType, Id, Individual, Pedigree, Union } from "../model/types";

/**
 * Ricostruzione del grafo da formati "a relazioni" (PED, Phenopackets,
 * GA4GH/KIN, CSV, GEDCOM): figli raggruppati per coppia di genitori,
 * partner senza figli come unioni a sé. Gli ID esterni diventano UUID.
 */
export interface RawPerson {
  key: string;
  fields: Partial<Omit<Individual, "id">>;
}

export interface RawParentage {
  child: string;
  parents: string[];
  link: ChildLinkType;
  art?: { eggFrom?: string; spermFrom?: string; carriedBy?: string; mitoFrom?: string };
  adoptedOut?: boolean;
}

export interface RawPartnership {
  a: string;
  b: string;
  ended?: boolean;
  consanguineous?: boolean;
}

export interface Assembly {
  persons: RawPerson[];
  parentage: RawParentage[];
  partnerships?: RawPartnership[];
  twins?: { members: string[]; zygosity: "MZ" | "DZ" | "unknown" }[];
  proband?: string;
  date?: string;
}

export function assemble(
  input: Assembly,
  ids: IdFactory = uuid
): { pedigree: Pedigree; warnings: string[]; idOf: Map<string, Id> } {
  const ped = createPedigree({ ids, date: input.date });
  const warnings: string[] = [];
  const map = new Map<string, Id>();
  for (const p of input.persons) {
    if (map.has(p.key)) {
      warnings.push("ID duplicato ignorato.");
      continue;
    }
    const id = ids();
    map.set(p.key, id);
    ped.individuals[id] = createIndividual(id, p.fields);
  }
  const ref = (k: string | undefined) => (k ? map.get(k) : undefined);
  let seq = 0;
  const byKey = new Map<string, Union>();
  const unionFor = (partners: Id[]): Union => {
    const key = [...partners].sort().join("|");
    let u = byKey.get(key);
    if (!u) {
      u = createUnion(ids(), partners, { sequence: ++seq });
      byKey.set(key, u);
      ped.unions[u.id] = u;
    }
    return u;
  };

  const birthAssigned = new Set<Id>();
  for (const pa of input.parentage) {
    const child = ref(pa.child);
    if (!child) {
      warnings.push("Relazione con un individuo inesistente ignorata.");
      continue;
    }
    const parents = pa.parents.map(ref).filter((x): x is Id => !!x && x !== child).slice(0, 2);
    if (parents.length === 0) continue;
    const isBirth = pa.link === "biological" || pa.link === "art";
    if (isBirth && birthAssigned.has(child)) {
      warnings.push("Un figlio con più coppie di genitori biologici: tenuta la prima.");
      continue;
    }
    if (isBirth) birthAssigned.add(child);
    const u = unionFor(parents);
    if (u.children.some((c) => c.id === child)) continue;
    const art: ArtDetails | undefined = pa.art
      ? { eggFrom: ref(pa.art.eggFrom), spermFrom: ref(pa.art.spermFrom), carriedBy: ref(pa.art.carriedBy), mitoFrom: ref(pa.art.mitoFrom) }
      : undefined;
    if (art) for (const k of Object.keys(art) as (keyof ArtDetails)[]) if (!art[k]) delete art[k];
    u.children.push({ id: child, link: pa.link, ...(art && Object.keys(art).length ? { art } : {}), ...(pa.adoptedOut ? { adoptedOut: true } : {}) });
  }
  for (const pp of input.partnerships ?? []) {
    const a = ref(pp.a);
    const b = ref(pp.b);
    if (!a || !b || a === b) continue;
    const u = unionFor([a, b]);
    if (pp.ended) u.status = "ended";
    if (pp.consanguineous) u.consanguinity = u.consanguinity ?? {};
  }
  for (const tw of input.twins ?? []) {
    const members = tw.members.map(ref).filter((x): x is Id => !!x);
    if (members.length < 2) continue;
    const groupId = ids();
    for (const m of members) ped.individuals[m] = { ...ped.individuals[m], twin: { groupId, zygosity: tw.zygosity } };
  }
  const proband = ref(input.proband);
  if (proband) ped.proband = proband;
  return { pedigree: ped, warnings, idOf: map };
}
