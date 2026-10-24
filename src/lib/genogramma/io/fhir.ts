import { formatCode } from "../render/legend";
import { formatDateValue } from "../model/age";
import { ancestorDistances, biologicalParents, getRelationToProband, getSiblings, isFemaleLike, isMaleLike, partnersOf } from "../model/queries";
import type { Age, Id, Individual, Pedigree } from "../model/types";

/**
 * FHIR R4: Bundle con un `Patient` (il probando) e una `FamilyMemberHistory`
 * per familiare. SPERIMENTALE: la FHIR Implementation Guide GA4GH Pedigree
 * è una build di sviluppo; qui si usa la forma R4 classica, centrata sul
 * probando.
 *
 * Perdite: il modello è centrato sul probando, quindi le relazioni tra due
 * parenti non si rappresentano (resta solo la relazione con il probando);
 * gravidanze, ART, gemelli, legenda e impostazioni non sono esportati.
 */
export const FHIR_IG_VERSION = "GA4GH Pedigree IG 0.1.0 (build di sviluppo) — export R4 sperimentale";
export const FHIR_LOSSES =
  "FHIR FamilyMemberHistory è centrato sul probando: si perdono i legami tra parenti, gravidanze, ART, gemelli, legenda e impostazioni.";

const ROLE = "http://terminology.hl7.org/CodeSystem/v3-RoleCode";

/** Codice v3-RoleCode della relazione con il probando, dove definito. */
export function roleCode(ped: Pedigree, id: Id): { code: string; display: string } {
  const proband = ped.proband!;
  const t = ped.individuals[id];
  const male = isMaleLike(t);
  const female = isFemaleLike(t);
  const pick = (m: string, f: string, n: string, dm: string, df: string, dn: string) =>
    male ? { code: m, display: dm } : female ? { code: f, display: df } : { code: n, display: dn };
  const parents = biologicalParents(ped, proband);
  if (parents.includes(id)) return pick("NFTH", "NMTH", "NPRN", "natural father", "natural mother", "natural parent");
  const sibs = getSiblings(ped, proband);
  if (sibs.full.includes(id)) return pick("NBRO", "NSIS", "NSIB", "natural brother", "natural sister", "natural sibling");
  if (sibs.half.some((h) => h.id === id)) return pick("HBRO", "HSIS", "HSIB", "half-brother", "half-sister", "half-sibling");
  if (biologicalParents(ped, id).includes(proband)) return pick("SONC", "DAUC", "CHILD", "son", "daughter", "child");
  if (partnersOf(ped, proband).includes(id)) return { code: "SIGOTHR", display: "significant other" };
  const anc = ancestorDistances(ped, proband);
  const d = anc.get(id);
  const side = (() => {
    for (const p of parents) {
      if (p === id || ancestorDistances(ped, p).has(id)) return isMaleLike(ped.individuals[p]) ? "P" : isFemaleLike(ped.individuals[p]) ? "M" : "";
    }
    return "";
  })();
  if (d === 2) return male ? { code: `${side}GRFTH`.replace(/^GRFTH/, "GRFTH"), display: `${side === "P" ? "paternal" : side === "M" ? "maternal" : ""} grandfather`.trim() } : female ? { code: `${side}GRMTH`, display: `${side === "P" ? "paternal" : side === "M" ? "maternal" : ""} grandmother`.trim() } : { code: "GRPRN", display: "grandparent" };
  if (d === 3) return male ? { code: `${side}GGRFTH`, display: "great grandfather" } : female ? { code: `${side}GGRMTH`, display: "great grandmother" } : { code: "GGRPRN", display: "great grandparent" };
  const rel = getRelationToProband(ped, id);
  if (/^zi[oa] paterna?$/.test(rel)) return male ? { code: "PUNCLE", display: "paternal uncle" } : { code: "PAUNT", display: "paternal aunt" };
  if (/^zi[oa] materna?$/.test(rel)) return male ? { code: "MUNCLE", display: "maternal uncle" } : { code: "MAUNT", display: "maternal aunt" };
  if (/^cugin[oa] di primo grado/.test(rel)) return rel.includes("pater") ? { code: "PCOUSN", display: "paternal cousin" } : rel.includes("mater") ? { code: "MCOUSN", display: "maternal cousin" } : { code: "COUSN", display: "cousin" };
  if (rel === "nipote (in linea collaterale)") return male ? { code: "NEPHEW", display: "nephew" } : female ? { code: "NIECE", display: "niece" } : { code: "NIENEPH", display: "niece/nephew" };
  if (rel === "nipote (in linea diretta)") return male ? { code: "GRNDSON", display: "grandson" } : female ? { code: "GRNDDAU", display: "granddaughter" } : { code: "GRNDCHILD", display: "grandchild" };
  return { code: "FAMMEMB", display: rel || "family member" };
}

function age(a: Age | undefined): { value: number; unit: string; system: string; code: string } | undefined {
  if (!a || a === "unknown" || "decade" in a) return undefined;
  const u = { y: ["a", "years"], mo: ["mo", "months"], wk: ["wk", "weeks"], d: ["d", "days"], gw: ["wk", "weeks"] }[a.unit];
  return { value: a.value, unit: u[1], system: "http://unitsofmeasure.org", code: u[0] };
}

function gender(ind: Individual): string {
  return ind.sex === "male" ? "male" : ind.sex === "female" ? "female" : ind.sex === "unassigned" ? "other" : "unknown";
}

export function exportFhir(ped: Pedigree): string {
  if (!ped.proband) throw new Error("Serve un probando per l'export FHIR.");
  const probandRef = "urn:uuid:" + ped.proband;
  const proband = ped.individuals[ped.proband];
  const entries: unknown[] = [
    {
      fullUrl: probandRef,
      resource: {
        resourceType: "Patient",
        id: ped.proband,
        gender: gender(proband),
        ...(typeof proband.birth === "string" && proband.birth !== "unknown" ? { birthDate: proband.birth } : {}),
      },
    },
  ];
  for (const ind of Object.values(ped.individuals)) {
    if (ind.id === ped.proband || ind.pregnancy) continue;
    const r = roleCode(ped, ind.id);
    const born = formatDateValue(ind.birth);
    const conditions = ind.conditions
      .filter((c) => c.status === "affected")
      .map((c) => {
        const l = ped.legend.conditions.find((x) => x.id === c.conditionId);
        const onset = age(c.onset);
        return {
          code: {
            text: l?.label ?? "condizione",
            coding: (l?.codes ?? []).map((code) => ({ system: systemUri(code.system), code: code.system === "HPO" ? formatCode(code) : code.code, display: l?.label })),
          },
          ...(onset ? { onsetAge: onset } : {}),
        };
      });
    const deathAge = age(ind.death?.age);
    entries.push({
      fullUrl: `urn:uuid:${ind.id}`,
      resource: {
        resourceType: "FamilyMemberHistory",
        id: ind.id,
        status: "completed",
        patient: { reference: probandRef },
        relationship: { coding: [{ system: ROLE, code: r.code, display: r.display }] },
        sex: { coding: [{ system: "http://hl7.org/fhir/administrative-gender", code: gender(ind) }] },
        ...(born && born !== "?" ? { bornString: born } : {}),
        ...(ind.vital === "deceased" ? (deathAge ? { deceasedAge: deathAge } : { deceasedBoolean: true }) : ind.vital === "alive" ? { deceasedBoolean: false } : {}),
        ...(conditions.length ? { condition: conditions } : {}),
      },
    });
  }
  return JSON.stringify(
    {
      resourceType: "Bundle",
      type: "collection",
      meta: { tag: [{ system: "https://www.sebastianmicu.com", code: "experimental", display: FHIR_IG_VERSION }] },
      entry: entries,
    },
    null,
    2
  );
}

function systemUri(s: string): string {
  switch (s) {
    case "HPO":
      return "http://purl.obolibrary.org/obo/hp.owl";
    case "ORPHA":
      return "http://www.orpha.net";
    case "OMIM":
      return "https://omim.org";
    case "ICD10":
      return "http://hl7.org/fhir/sid/icd-10";
    default:
      return "http://id.who.int/icd/release/11/mms";
  }
}
