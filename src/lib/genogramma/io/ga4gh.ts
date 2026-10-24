import { KIN, KIN_IRI, genderCode, sexCode, toKinRelations, type KinRelation } from "../model/kin";
import type { Pedigree, Sex } from "../model/types";
import { assemble, type RawParentage, type RawPartnership, type RawPerson } from "./assemble";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * GA4GH Pedigree (modello concettuale): individui + relazioni con i codici
 * della Kinship Ontology in forma ridotta. Le proprietà cliniche restano
 * come attributi dell'individuo (etichetta, nascita, stato in vita).
 *
 * Perdite: impostazioni di visualizzazione e riempimenti della legenda,
 * valutazioni, gravidanze come dettaglio (restano individui), note.
 */
export const GA4GH_LOSSES =
  "Il formato GA4GH conserva individui, sesso, genere, relazioni (anche ART, adozione, gemelli) e probando. Si perdono legenda, condizioni, valutazioni e impostazioni.";

export interface Ga4ghPedigree {
  format: "GA4GH-Pedigree";
  ontology: string;
  id: string;
  date: string;
  indexPatients: { proband?: string; consultands: string[] };
  individuals: {
    id: string;
    label?: string;
    sex: string;
    gender?: string;
    /** Estensione: identità di genere senza codice KIN (non binario, non nota). */
    genderIdentity?: string;
    birth?: string;
    deceased?: boolean;
  }[];
  relationships: KinRelation[];
  /**
   * Estensione del formato: genitori intenzionali dei figli nati da ART,
   * che la Kinship Ontology non codifica (es. doppia donazione).
   */
  extensions?: { intendedParents?: { child: string; parents: string[] }[] };
}

export function exportGa4gh(ped: Pedigree): string {
  const doc: Ga4ghPedigree = {
    format: "GA4GH-Pedigree",
    ontology: KIN_IRI,
    id: ped.id,
    date: ped.date,
    indexPatients: { proband: ped.proband, consultands: ped.consultands },
    individuals: Object.values(ped.individuals).map((ind) => ({
      id: ind.id,
      label: ind.label,
      sex: sexCode(ind),
      gender: genderCode(ind),
      genderIdentity: genderCode(ind) ? undefined : ind.gender,
      birth: typeof ind.birth === "string" && ind.birth !== "unknown" ? ind.birth : undefined,
      deceased: ind.vital === "deceased" ? true : undefined,
    })),
    relationships: toKinRelations(ped),
    extensions: {
      intendedParents: Object.values(ped.unions).flatMap((u) =>
        u.children.filter((c) => c.link === "art").map((c) => ({ child: c.id, parents: [...u.partners] }))
      ),
    },
  };
  return JSON.stringify(doc, null, 2);
}

const SEX_IN: Record<string, Sex> = {
  [KIN.Male]: "male",
  [KIN.Female]: "female",
  [KIN.OtherSex]: "unassigned",
  [KIN.UnknownSex]: "unknown",
};

export function importGa4gh(text: string): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  let doc: Partial<Ga4ghPedigree>;
  try {
    doc = JSON.parse(text);
  } catch {
    return fail("Il file non è un JSON valido.");
  }
  if (!doc || doc.format !== "GA4GH-Pedigree" || !Array.isArray(doc.individuals) || !Array.isArray(doc.relationships)) {
    return fail("Il file non è un pedigree GA4GH riconosciuto.");
  }
  if (doc.individuals.length > 2000) return fail("Il file contiene troppi individui (massimo 2000).");
  const persons: RawPerson[] = doc.individuals
    .filter((i) => i && typeof i.id === "string")
    .map((i) => ({
      key: i.id,
      fields: {
        label: typeof i.label === "string" ? i.label.slice(0, 120) : undefined,
        sex: SEX_IN[i.sex] ?? "unknown",
        gender:
          i.gender === KIN.Man
            ? "man"
            : i.gender === KIN.Woman
              ? "woman"
              : i.genderIdentity === "non-binary" || i.genderIdentity === "unknown"
                ? i.genderIdentity
                : "not-expressed",
        birth: typeof i.birth === "string" ? i.birth.slice(0, 10) : undefined,
        vital: i.deceased ? "deceased" : "alive",
      },
    }));
  // Relazioni raggruppate per figlio.
  const byChild = new Map<
    string,
    { parents: string[]; link: RawParentage["link"]; art: NonNullable<RawParentage["art"]>; mothers: string[]; fathers: string[] }
  >();
  const entry = (child: string, link: RawParentage["link"]) => {
    const k = `${child}|${link === "art" ? "biological" : link}`;
    let e = byChild.get(k);
    if (!e) {
      e = { parents: [], link, art: {}, mothers: [], fathers: [] };
      byChild.set(k, e);
    }
    return e;
  };
  const partnerships: RawPartnership[] = [];
  const twins: { members: string[]; zygosity: "MZ" | "DZ" | "unknown" }[] = [];
  const bio = new Set<string>([KIN.isBiologicalParentOf, KIN.isBiologicalMotherOf, KIN.isBiologicalFatherOf]);
  for (const r of doc.relationships) {
    if (!r || typeof r.subject !== "string" || typeof r.object !== "string") continue;
    const { subject: s, relation: code, object: o } = r;
    if (bio.has(code)) {
      const e = entry(o, "biological");
      e.parents.push(s);
      if (code === KIN.isBiologicalMotherOf) e.mothers.push(s);
      if (code === KIN.isBiologicalFatherOf) e.fathers.push(s);
    }
    else if (code === KIN.isBiologicalChildOf) entry(s, "biological").parents.push(o);
    else if (code === KIN.isAdoptiveParentOf) entry(o, "adoptive").parents.push(s);
    else if (code === KIN.isFosterParentOf) entry(o, "foster").parents.push(s);
    else if (code === KIN.isSpermDonorOf) {
      const e = entry(o, "biological");
      e.link = "art";
      e.art.spermFrom = s;
    } else if (code === KIN.isOvumDonorOf) {
      const e = entry(o, "biological");
      e.link = "art";
      e.art.eggFrom = s;
    } else if (code === KIN.isSurrogateOvumDonorOf) {
      const e = entry(o, "biological");
      e.link = "art";
      e.art.eggFrom = s;
      e.art.carriedBy = s;
    } else if (code === KIN.isGestationalCarrierOf) {
      const e = entry(o, "biological");
      e.link = "art";
      e.art.carriedBy = s;
    } else if (code === KIN.isMitochondrialDonorOf) {
      const e = entry(o, "biological");
      e.link = "art";
      e.art.mitoFrom = s;
    } else if (code === KIN.isPartnerOf || code === KIN.isSeparatedPartnerOf || code === KIN.isConsanguineousPartnerOf || code === KIN.isSeparatedConsanguineousPartnerOf) {
      partnerships.push({
        a: s,
        b: o,
        ended: code === KIN.isSeparatedPartnerOf || code === KIN.isSeparatedConsanguineousPartnerOf,
        consanguineous: code === KIN.isConsanguineousPartnerOf || code === KIN.isSeparatedConsanguineousPartnerOf,
      });
    } else if (code === KIN.isMonozygoticMultipleBirthSiblingOf || code === KIN.isPolyzygoticMultipleBirthSiblingOf || code === KIN.isMultipleBirthSiblingOf) {
      const z = code === KIN.isMonozygoticMultipleBirthSiblingOf ? "MZ" : code === KIN.isPolyzygoticMultipleBirthSiblingOf ? "DZ" : "unknown";
      const g = twins.find((t) => t.members.includes(s) || t.members.includes(o));
      if (g) {
        for (const x of [s, o]) if (!g.members.includes(x)) g.members.push(x);
      } else twins.push({ members: [s, o], zygosity: z });
    }
  }
  const intended = new Map<string, string[]>();
  for (const x of doc.extensions?.intendedParents ?? []) {
    if (x && typeof x.child === "string" && Array.isArray(x.parents)) intended.set(x.child, x.parents.filter((p) => typeof p === "string"));
  }
  const parentage: RawParentage[] = [];
  for (const [k, e] of byChild) {
    const child = k.split("|")[0];
    // Con ART i genitori dell'unione sono quelli intenzionali: i donatori non entrano nella coppia.
    const donors = new Set([e.art.eggFrom, e.art.spermFrom, e.art.carriedBy, e.art.mitoFrom].filter(Boolean));
    let parents = e.parents.filter((p) => !donors.has(p));
    if (e.link === "art" && parents.length === 0) {
      // Genitori intenzionali non genetici: si cercano tra i partner del genitore genetico.
      const gen = [e.art.eggFrom, e.art.spermFrom].find((x) => x && !donors.has(x));
      if (gen) parents = [gen];
    }
    if (e.link === "art" && intended.has(child)) parents = intended.get(child)!;
    else if (e.link === "art" && parents.length === 1) {
      // Il genitore intenzionale non genetico è il partner del genitore genetico.
      const mates = partnerships.filter((x) => x.a === parents[0] || x.b === parents[0]);
      if (mates.length === 1) parents = [mates[0].a, mates[0].b];
    }
    if (e.link === "art") {
      // La madre e il padre biologici di un figlio ART hanno fornito ovocita e seme.
      if (!e.art.eggFrom && e.mothers[0]) e.art.eggFrom = e.mothers[0];
      if (!e.art.spermFrom && e.fathers[0]) e.art.spermFrom = e.fathers[0];
    }
    parentage.push({ child, parents: [...new Set(parents)], link: e.link, art: e.link === "art" ? e.art : undefined });
  }
  const { pedigree, warnings } = assemble({
    persons,
    parentage,
    partnerships,
    twins,
    proband: doc.indexPatients?.proband,
    date: typeof doc.date === "string" ? doc.date : undefined,
  });
  return { ok: true, pedigree, warnings: [...warnings, GA4GH_LOSSES], format: "GA4GH" };
}
