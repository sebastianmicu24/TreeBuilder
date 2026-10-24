import { formatCode } from "../render/legend";
import { addLegendCondition, setIndividualCondition } from "../model/commands";
import { uuid } from "../model/create";
import { biologicalParents, isFemaleLike, isMaleLike } from "../model/queries";
import type { Age, Id, Individual, Pedigree } from "../model/types";
import { assemble, type RawParentage, type RawPerson } from "./assemble";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * GA4GH Phenopackets v2, messaggio `Family` in JSON (nomi dei campi in
 * lowerCamelCase secondo la mappatura JSON di protobuf: `consanguinousParents`
 * corrisponde a `consanguinous_parents`, con la grafia dello schema).
 *
 * Perdite: relazioni non biologiche, gravidanze (escluse), genere, note,
 * valutazioni; `affectedStatus` riflette una sola condizione scelta.
 */
export const PHENOPACKET_LOSSES =
  "Phenopackets conserva genitori biologici, sesso, fenotipi HPO e diagnosi. Si perdono adozioni, ART, gravidanze, genere, note e valutazioni; lo stato di affetto riguarda una sola condizione.";

type Sex = "UNKNOWN_SEX" | "FEMALE" | "MALE" | "OTHER_SEX";
type Affected = "MISSING" | "UNAFFECTED" | "AFFECTED";

interface Term {
  id: string;
  label: string;
}

interface PpIndividual {
  id: string;
  sex: Sex;
  vitalStatus?: { status: "ALIVE" | "DECEASED" | "UNKNOWN_STATUS" };
}

interface Phenopacket {
  id: string;
  subject: PpIndividual;
  phenotypicFeatures?: { type: Term; onset?: { age: { iso8601duration: string } } }[];
  diseases?: { term: Term; onset?: { age: { iso8601duration: string } } }[];
  metaData: MetaData;
}

interface MetaData {
  created: string;
  createdBy: string;
  phenopacketSchemaVersion: "2.0";
  resources: { id: string; name: string; namespacePrefix: string; url: string; version: string; iriPrefix: string }[];
}

export interface PpFamily {
  id: string;
  proband: Phenopacket;
  relatives: Phenopacket[];
  consanguinousParents: boolean;
  pedigree: { persons: { familyId: string; individualId: string; paternalId: string; maternalId: string; sex: Sex; affectedStatus: Affected }[] };
  metaData: MetaData;
}

function iso(age: Age | undefined): string | undefined {
  if (!age || age === "unknown") return undefined;
  if ("decade" in age) return `P${age.decade}Y`;
  const u = { y: "Y", mo: "M", wk: "W", d: "D", gw: "W" }[age.unit];
  return `P${age.value}${u}`;
}

function fromIso(s: string | undefined): Age | undefined {
  const m = /^P(\d+(?:\.\d+)?)([YMWD])$/.exec(s ?? "");
  if (!m) return undefined;
  return { value: Number(m[1]), unit: ({ Y: "y", M: "mo", W: "wk", D: "d" } as const)[m[2] as "Y"] };
}

function sexOf(ind: Individual): Sex {
  if (ind.sex === "male") return "MALE";
  if (ind.sex === "female") return "FEMALE";
  if (ind.sex === "unassigned") return "OTHER_SEX";
  return "UNKNOWN_SEX";
}

const RESOURCES: MetaData["resources"] = [
  { id: "hp", name: "human phenotype ontology", namespacePrefix: "HP", url: "http://purl.obolibrary.org/obo/hp.owl", version: "unknown", iriPrefix: "http://purl.obolibrary.org/obo/HP_" },
  { id: "ordo", name: "Orphanet Rare Disease Ontology", namespacePrefix: "ORPHA", url: "http://www.orpha.net/ORDO/", version: "unknown", iriPrefix: "http://www.orpha.net/ORDO/Orphanet_" },
  { id: "omim", name: "Online Mendelian Inheritance in Man", namespacePrefix: "OMIM", url: "https://www.omim.org", version: "unknown", iriPrefix: "https://omim.org/entry/" },
];

export function exportPhenopacket(ped: Pedigree, affectedCondition?: Id, now = new Date()): string {
  const meta: MetaData = { created: now.toISOString(), createdBy: "TreeBuilder (genogramma)", phenopacketSchemaVersion: "2.0", resources: RESOURCES };
  const people = Object.values(ped.individuals).filter((i) => !i.pregnancy || i.pregnancy.outcome === "SB");
  const included = new Set(people.map((i) => i.id));
  const packet = (ind: Individual): Phenopacket => {
    const features: NonNullable<Phenopacket["phenotypicFeatures"]> = [];
    const diseases: NonNullable<Phenopacket["diseases"]> = [];
    for (const c of ind.conditions) {
      if (c.status !== "affected") continue;
      const l = ped.legend.conditions.find((x) => x.id === c.conditionId);
      if (!l) continue;
      const onset = iso(c.onset ?? c.diagnosis);
      const hpo = l.codes.find((x) => x.system === "HPO");
      const other = l.codes.find((x) => x.system !== "HPO");
      if (hpo) features.push({ type: { id: formatCode(hpo), label: l.label }, ...(onset ? { onset: { age: { iso8601duration: onset } } } : {}) });
      else diseases.push({ term: { id: other ? formatCode(other).replace("ICD-10 ", "ICD10:").replace("ICD-11 ", "ICD11:") : `LOCAL:${l.id}`, label: l.label }, ...(onset ? { onset: { age: { iso8601duration: onset } } } : {}) });
    }
    return {
      id: `pp-${ind.id}`,
      subject: {
        id: ind.id,
        sex: sexOf(ind),
        vitalStatus: { status: ind.vital === "alive" ? "ALIVE" : ind.vital === "deceased" ? "DECEASED" : "UNKNOWN_STATUS" },
      },
      ...(features.length ? { phenotypicFeatures: features } : {}),
      ...(diseases.length ? { diseases } : {}),
      metaData: meta,
    };
  };
  const proband = ped.proband ? ped.individuals[ped.proband] : people[0];
  const persons = people.map((ind) => {
    const parents = biologicalParents(ped, ind.id).filter((p) => included.has(p));
    const father = parents.find((p) => isMaleLike(ped.individuals[p]) || ped.individuals[p].sex === "male");
    const mother = parents.find((p) => p !== father && (isFemaleLike(ped.individuals[p]) || ped.individuals[p].sex === "female"));
    const status: Affected = affectedCondition
      ? ind.conditions.some((c) => c.conditionId === affectedCondition && c.status === "affected")
        ? "AFFECTED"
        : ind.healthUnknown || ind.placeholder
          ? "MISSING"
          : "UNAFFECTED"
      : "MISSING";
    return {
      familyId: ped.id,
      individualId: ind.id,
      paternalId: father ?? "0",
      maternalId: mother ?? "0",
      sex: sexOf(ind),
      affectedStatus: status,
    };
  });
  const family: PpFamily = {
    id: ped.id,
    proband: packet(proband),
    relatives: people.filter((i) => i.id !== proband.id).map(packet),
    consanguinousParents: Object.values(ped.unions).some((u) => u.consanguinity && u.children.some((c) => c.id === proband.id)),
    pedigree: { persons },
    metaData: meta,
  };
  return JSON.stringify(family, null, 2);
}

export function importPhenopacket(text: string): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  let doc: Partial<PpFamily> & { consanguinous_parents?: boolean };
  try {
    doc = JSON.parse(text);
  } catch {
    return fail("Il file non è un JSON valido.");
  }
  const persons0 = doc?.pedigree?.persons;
  if (!doc || !Array.isArray(persons0) || !doc.proband) return fail("Il file non è una Family di Phenopackets v2.");
  if (persons0.length > 2000) return fail("Il file contiene troppi individui (massimo 2000).");
  const sexIn = (s: string | undefined) => (s === "MALE" ? "male" : s === "FEMALE" ? "female" : s === "OTHER_SEX" ? "unassigned" : "unknown") as Individual["sex"];
  const packets = [doc.proband, ...(Array.isArray(doc.relatives) ? doc.relatives : [])].filter((p): p is Phenopacket => !!p?.subject?.id);
  const byId = new Map(packets.map((p) => [p.subject.id, p]));
  const persons: RawPerson[] = persons0
    .filter((p) => p && typeof p.individualId === "string")
    .map((p) => {
      const pk = byId.get(p.individualId);
      const st = pk?.subject.vitalStatus?.status;
      return {
        key: p.individualId,
        fields: {
          label: p.individualId.slice(0, 40),
          sex: sexIn(p.sex),
          gender: "not-expressed",
          vital: st === "DECEASED" ? "deceased" : st === "UNKNOWN_STATUS" ? "unknown" : "alive",
        },
      };
    });
  const parentage: RawParentage[] = persons0
    .map((p) => ({ child: p.individualId, parents: [p.paternalId, p.maternalId].filter((x) => x && x !== "0"), link: "biological" as const }))
    .filter((p) => p.parents.length);
  const { pedigree, warnings, idOf } = assemble({ persons, parentage, proband: doc.proband.subject.id });
  let ped = pedigree;
  if (doc.consanguinousParents || doc.consanguinous_parents) {
    const pid = ped.proband;
    const u = Object.values(ped.unions).find((x) => x.children.some((c) => c.id === pid));
    if (u && u.partners.length === 2) ped = { ...ped, unions: { ...ped.unions, [u.id]: { ...u, consanguinity: {} } } };
  }
  const legend = new Map<string, Id>();
  for (const pk of packets) {
    const id = idOf.get(pk.subject.id);
    if (!id) continue;
    const terms = [
      ...(pk.phenotypicFeatures ?? []).map((f) => ({ term: f.type, onset: f.onset?.age?.iso8601duration })),
      ...(pk.diseases ?? []).map((d) => ({ term: d.term, onset: d.onset?.age?.iso8601duration })),
    ];
    for (const t of terms) {
      if (!t.term?.id) continue;
      let cid = legend.get(t.term.id);
      if (!cid) {
        const [prefix, ...rest] = t.term.id.split(":");
        const code = rest.join(":");
        const system = prefix === "HP" ? "HPO" : prefix === "ORPHA" ? "ORPHA" : prefix === "OMIM" ? "OMIM" : prefix === "ICD10" ? "ICD10" : null;
        const codes = system ? [{ system, code: system === "HPO" ? t.term.id : code } as const] : [];
        const res = addLegendCondition(ped, (t.term.label || t.term.id).slice(0, 120), uuid, codes.map((c) => ({ ...c })));
        ped = res.pedigree;
        cid = res.id;
        legend.set(t.term.id, cid);
      }
      ped = setIndividualCondition(ped, id, cid, { status: "affected", onset: fromIso(t.onset) });
    }
  }
  return { ok: true, pedigree: ped, warnings: [...warnings, PHENOPACKET_LOSSES], format: "Phenopackets" };
}
