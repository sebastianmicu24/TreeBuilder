import { describe, expect, it } from "vitest";
import { findOverlaps, layout } from "../layout";
import { sequentialIds } from "../model/create";
import { getRelationToProband, unknownFields } from "../model/queries";
import { hasErrors, validate } from "../model/validate";
import { buildFromPatient, buildSteps, cardSexes, emptyAnswers, skippedSteps, syncCards } from "../wizard/patient";

function sample() {
  const a = emptyAnswers();
  a.respondent = "parent";
  a.respondentRole = "mother";
  a.proband = { ...a.proband, sex: "female", gender: "not-expressed", birthYear: "2019", health: [{ label: "Epilessia", onset: { value: 2, unit: "y" } }] };
  a.mother = { ...a.mother, known: "yes", birthYear: "1988", alive: "yes", health: [{ label: "Fibrosi cistica" }] };
  a.father = { ...a.father, known: "yes", alive: "unknown", birthYear: "unknown" };
  a.parentsRelated = "yes";
  a.parentsRelatedHow = "cugini di secondo grado";
  a.siblings = { male: 1, female: 1, unknown: 0 };
  a.halfMaternal = { male: 0, female: 1, unknown: 0 };
  a.siblingCards = syncCards([], cardSexes(a.siblings, a.halfPaternal, a.halfMaternal));
  a.siblingCards[0] = { ...a.siblingCards[0], alive: "no", deathAge: { value: 4, unit: "mo" }, deathCause: "cardiopatia" };
  a.grandparents.mf = { ...a.grandparents.mf, known: "yes", alive: "no", deathAge: { decade: 60 }, health: [{ label: "Infarto miocardico" }] };
  a.unclesMaternal = { male: 0, female: 2, unknown: 0 };
  a.uncleCards = syncCards([], cardSexes(a.unclesPaternal, a.unclesMaternal));
  a.losses = [{ outcome: "SAB", weeks: 10 }, { outcome: "SB", weeks: 34 }];
  a.ancestryMaternal = "Veneto";
  a.reason = "crisi convulsive";
  return a;
}

describe("questionario del paziente", () => {
  it("crea un genogramma valido, connesso e senza sovrapposizioni", () => {
    const ped = buildFromPatient(sample(), sequentialIds("p"), new Date("2026-01-15T00:00:00Z"));
    expect(hasErrors(validate(ped))).toBe(false);
    expect(validate(ped).filter((i) => i.code === "disconnected")).toEqual([]);
    expect(findOverlaps(layout(ped))).toEqual([]);
    const rel = (r: string) => Object.keys(ped.individuals).filter((id) => getRelationToProband(ped, id) === r);
    expect(rel("madre")).toHaveLength(1);
    expect(rel("padre")).toHaveLength(1);
    expect(rel("zia materna")).toHaveLength(2);
    expect(rel("nonno materno")).toHaveLength(1);
    expect(rel("mezza sorella materna")).toHaveLength(1);
    expect(ped.consultands).toEqual(rel("madre"));
    expect(Object.values(ped.unions).some((u) => u.consanguinity?.degree === "cugini di secondo grado")).toBe(true);
    expect(ped.legend.conditions.map((c) => c.label).sort()).toEqual(["Epilessia", "Fibrosi cistica", "Infarto miocardico"]);
    expect(ped.legend.conditions.find((c) => c.label === "Fibrosi cistica")!.codes.length).toBeGreaterThan(0);
    expect(Object.values(ped.individuals).filter((i) => i.pregnancy)).toHaveLength(2);
    expect(ped.meta.historian).toBe("madre del probando");
  });

  it("'Non lo so' resta un dato da completare", () => {
    const ped = buildFromPatient(sample(), sequentialIds("q"));
    const father = Object.keys(ped.individuals).find((id) => getRelationToProband(ped, id) === "padre")!;
    expect(unknownFields(ped.individuals[father])).toEqual(expect.arrayContaining(["età", "stato in vita"]));
  });

  it("padre non noto: linea dal solo genitore, nessun individuo fantasma", () => {
    const a = sample();
    a.father = { ...a.father, known: "no" };
    const ped = buildFromPatient(a, sequentialIds("r"));
    const parents = Object.values(ped.unions).find((u) => u.children.some((c) => c.id === ped.proband))!;
    expect(parents.partners).toHaveLength(1);
    expect(Object.keys(ped.individuals).some((id) => getRelationToProband(ped, id) === "padre")).toBe(false);
    expect(buildSteps(a).some((s) => s.gp === "pf")).toBe(false);
  });

  it("schede ripetute: una per familiare, numerate nel proprio gruppo, con salto e ripresa", () => {
    const a = sample();
    const steps = buildSteps(a);
    const sibs = steps.filter((s) => s.id === "sibling").map((s) => s.title);
    expect(sibs).toEqual(["Fratello 1", "Sorella 1", "Sorella 1 (stessa madre)"]);
    expect(steps.filter((s) => s.id === "uncle").map((s) => s.title)).toEqual(["Zia materna 1", "Zia materna 2"]);
    a.uncleCards[1] = { ...a.uncleCards[1], skipped: true };
    expect(skippedSteps(a, steps).map((s) => s.title)).toEqual(["Zia materna 2"]);
    // Cambiare i conteggi non perde le schede già compilate.
    const kept = syncCards(a.siblingCards, cardSexes({ male: 1, female: 2, unknown: 0 }));
    expect(kept[0].deathCause).toBe("cardiopatia");
  });

  it("nessun nome: solo iniziali facoltative", () => {
    const a = sample();
    a.proband.initials = "  A.B.  ";
    const ped = buildFromPatient(a, sequentialIds("s"));
    expect(ped.individuals[ped.proband!].label).toBe("A.B.");
    expect(Object.values(ped.individuals).every((i) => i.name === undefined)).toBe(true);
  });
});
