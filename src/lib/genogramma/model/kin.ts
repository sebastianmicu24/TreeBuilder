import { orderChildren } from "./sibling-order";
import type { Id, Individual, Pedigree } from "./types";

/**
 * Codici della Kinship Ontology GA4GH (http://purl.org/ga4gh/kin.owl).
 * L'export usa la forma ridotta: solo le relazioni non implicite
 * (fratelli pieni e mezzi, patrigni e simili si ricavano dai genitori).
 */
export const KIN_IRI = "http://purl.org/ga4gh/kin.owl";

export const KIN = {
  isBiologicalParentOf: "KIN:003",
  isSpermDonorOf: "KIN:004",
  isGestationalCarrierOf: "KIN:005",
  isSurrogateOvumDonorOf: "KIN:006",
  isFullSiblingOf: "KIN:008",
  isMultipleBirthSiblingOf: "KIN:009",
  isMonozygoticMultipleBirthSiblingOf: "KIN:010",
  isPolyzygoticMultipleBirthSiblingOf: "KIN:011",
  isHalfSiblingOf: "KIN:012",
  isFosterParentOf: "KIN:021",
  isAdoptiveParentOf: "KIN:022",
  isStepParentOf: "KIN:023",
  isPartnerOf: "KIN:026",
  isBiologicalMotherOf: "KIN:027",
  isBiologicalFatherOf: "KIN:028",
  isMitochondrialDonorOf: "KIN:029",
  isConsanguineousPartnerOf: "KIN:030",
  isBiologicalChildOf: "KIN:032",
  isOvumDonorOf: "KIN:038",
  isSeparatedPartnerOf: "KIN:050",
  isSeparatedConsanguineousPartnerOf: "KIN:051",
  isMaternalHalfSiblingOf: "KIN:054",
  isPaternalHalfSiblingOf: "KIN:055",
  OtherSex: "KIN:991",
  UnknownSex: "KIN:992",
  Woman: "KIN:993",
  Man: "KIN:994",
  Female: "KIN:995",
  Male: "KIN:996",
} as const;

export type KinCode = (typeof KIN)[keyof typeof KIN];

export const KIN_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(KIN).map(([label, code]) => [code, label])
);

export interface KinRelation {
  subject: Id;
  relation: KinCode;
  object: Id;
}

export function sexCode(ind: Individual): KinCode {
  switch (ind.sex) {
    case "male":
      return KIN.Male;
    case "female":
      return KIN.Female;
    case "unassigned":
      return KIN.OtherSex;
    default:
      return KIN.UnknownSex;
  }
}

/** Genere in KIN: solo uomo e donna hanno un codice; gli altri restano senza. */
export function genderCode(ind: Individual): KinCode | undefined {
  if (ind.gender === "man") return KIN.Man;
  if (ind.gender === "woman") return KIN.Woman;
  return undefined;
}

function parentCode(ind: Individual | undefined): KinCode {
  if (ind?.sex === "male") return KIN.isBiologicalFatherOf;
  if (ind?.sex === "female") return KIN.isBiologicalMotherOf;
  return KIN.isBiologicalParentOf;
}

/** Relazioni KIN in forma ridotta, in ordine deterministico. */
export function toKinRelations(ped: Pedigree): KinRelation[] {
  const out: KinRelation[] = [];
  const push = (subject: Id, relation: KinCode, object: Id) => {
    if (!out.some((r) => r.subject === subject && r.relation === relation && r.object === object)) {
      out.push({ subject, relation, object });
    }
  };
  const unions = Object.values(ped.unions).sort((a, b) => a.sequence - b.sequence);
  for (const u of unions) {
    if (u.partners.length === 2) {
      const [a, b] = u.partners;
      const code = u.consanguinity
        ? u.status === "ended"
          ? KIN.isSeparatedConsanguineousPartnerOf
          : KIN.isConsanguineousPartnerOf
        : u.status === "ended"
          ? KIN.isSeparatedPartnerOf
          : KIN.isPartnerOf;
      push(a, code, b);
    }
    for (const c of u.children) {
      if (c.link === "biological") {
        for (const p of u.partners) push(p, parentCode(ped.individuals[p]), c.id);
      } else if (c.link === "adoptive") {
        for (const p of u.partners) push(p, KIN.isAdoptiveParentOf, c.id);
      } else if (c.link === "foster") {
        for (const p of u.partners) push(p, KIN.isFosterParentOf, c.id);
      } else if (c.link === "art") {
        const art = c.art ?? {};
        const partner = (x?: Id) => !!x && u.partners.includes(x);
        if (!art.eggFrom && !art.spermFrom) {
          for (const p of u.partners) push(p, parentCode(ped.individuals[p]), c.id);
        }
        if (art.eggFrom) {
          if (partner(art.eggFrom)) push(art.eggFrom, KIN.isBiologicalMotherOf, c.id);
          else if (art.carriedBy === art.eggFrom) push(art.eggFrom, KIN.isSurrogateOvumDonorOf, c.id);
          else push(art.eggFrom, KIN.isOvumDonorOf, c.id);
        }
        if (art.spermFrom) {
          push(art.spermFrom, partner(art.spermFrom) ? KIN.isBiologicalFatherOf : KIN.isSpermDonorOf, c.id);
        }
        if (art.carriedBy && art.carriedBy !== art.eggFrom && !partner(art.carriedBy)) {
          push(art.carriedBy, KIN.isGestationalCarrierOf, c.id);
        }
        if (art.mitoFrom) push(art.mitoFrom, KIN.isMitochondrialDonorOf, c.id);
      }
    }
    // Gemelli: non sono impliciti dai genitori.
    const ordered = orderChildren(ped, u);
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ped.individuals[ordered[i]]?.twin;
        const b = ped.individuals[ordered[j]]?.twin;
        if (!a || !b || a.groupId !== b.groupId) continue;
        const code =
          a.zygosity === "MZ"
            ? KIN.isMonozygoticMultipleBirthSiblingOf
            : a.zygosity === "DZ"
              ? KIN.isPolyzygoticMultipleBirthSiblingOf
              : KIN.isMultipleBirthSiblingOf;
        push(ordered[i], code, ordered[j]);
      }
    }
  }
  return out;
}
