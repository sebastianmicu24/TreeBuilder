import { describe, expect, it } from "vitest";
import {
  adoption,
  artScenarios,
  chainUnions,
  CORRUPT_FILES,
  FIXTURES,
  firstCousins,
  largeFamily,
  mixedAgesAndMultiples,
  pregnancies,
  sibshipOfSix,
  singleParent,
  threeGenerations,
  twins,
  twoPartners,
} from "../__fixtures__";
import { computeAge, dateInterval, formatAge, birthInterval } from "../model/age";
import {
  addChild,
  addParents,
  addPartner,
  addSibling,
  expandMultiple,
  GenogramError,
  moveChild,
  planRemoval,
  removeIndividual,
  replaceWithPlaceholder,
  resetChildOrder,
  setTwins,
  updateIndividual,
} from "../model/commands";
import { createIndividual, createPedigree, sequentialIds } from "../model/create";
import { commit, createHistory, redo, undo } from "../model/history";
import { KIN, toKinRelations } from "../model/kin";
import { migrate } from "../model/migrate";
import {
  canAddParents,
  connectedComponents,
  detectConsanguinity,
  getParents,
  getRelationToProband,
  getSiblings,
  homeEntry,
  unknownFields,
} from "../model/queries";
import { orderChildren } from "../model/sibling-order";
import { hasErrors, validate } from "../model/validate";
import type { Pedigree } from "../model/types";

const byLabel = (ped: Pedigree, label: string) =>
  Object.values(ped.individuals).find((i) => i.label === label)!.id;

describe("fixture", () => {
  it.each(Object.entries(FIXTURES))("%s è valida e connessa", (_name, make) => {
    const ped = make();
    const issues = validate(ped);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(connectedComponents(ped)).toHaveLength(1);
  });

  it("la famiglia grande ha almeno 150 individui", () => {
    const ped = largeFamily();
    expect(Object.keys(ped.individuals).length).toBeGreaterThanOrEqual(150);
    expect(hasErrors(validate(ped))).toBe(false);
  });
});

describe("età e date", () => {
  it("converte date parziali in intervalli", () => {
    expect(dateInterval("1980")).toEqual([1980, 1981]);
    expect(dateInterval({ decade: 1960 })).toEqual([1960, 1970]);
    expect(dateInterval("unknown")).toBeNull();
    expect(dateInterval("1980-13")).toBeNull();
  });

  it("calcola l'età rispetto alla data del genogramma, con unità per i neonati", () => {
    const ind = (birth: string) => createIndividual("x", { birth });
    expect(computeAge(ind("2026-01-01"), "2026-01-15")).toEqual({ value: 14, unit: "d" });
    expect(computeAge(ind("2025-12-01"), "2026-01-15")).toEqual({ value: 6, unit: "wk" });
    expect(computeAge(ind("2025-03-01"), "2026-01-15")).toEqual({ value: 10, unit: "mo" });
    expect(computeAge(ind("1990-06-01"), "2026-01-15")).toEqual({ value: 35, unit: "y" });
    // Stessa nascita, data del genogramma diversa: età diversa (mai "oggi").
    expect(computeAge(ind("1990-06-01"), "2030-07-01")).toEqual({ value: 40, unit: "y" });
  });

  it("formatta le età in notazione NSGC", () => {
    expect(formatAge({ value: 34, unit: "y" })).toBe("34y");
    expect(formatAge({ value: 4, unit: "mo" })).toBe("4 mo");
    expect(formatAge({ value: 16, unit: "wk" })).toBe("16 wk");
    expect(formatAge({ decade: 60 })).toBe("60's");
  });

  it("ricava la nascita da età e decesso", () => {
    const ped = mixedAgesAndMultiples();
    const gm = Object.values(ped.individuals).find((i) => i.age && i.age !== "unknown" && "value" in i.age && i.age.value === 85)!;
    const iv = birthInterval(gm, ped.date)!;
    expect(iv[0]).toBeLessThan(1942);
    expect(iv[1]).toBeGreaterThan(1940);
  });
});

describe("ordine della fratria", () => {
  it("ordina dal più grande al più piccolo, gli ignoti restano al loro posto", () => {
    const ped = sibshipOfSix();
    const u = Object.values(ped.unions)[0];
    const labels = orderChildren(ped, u).map((id) => ped.individuals[id].label);
    // Inserimento: 2001, ?, 1985, 30y (≈1996), anni '90 (≈1995), ?
    // → 1985, ?, anni '90, 30y, 2001, ?
    expect(labels).toEqual(["s65", "s64", "s67", "s66", "s63", "s68"]);
    const order = orderChildren(ped, u);
    const year = (id: string) => {
      const iv = birthInterval(ped.individuals[id], ped.date);
      return iv ? (iv[0] + iv[1]) / 2 : null;
    };
    expect(year(order[1])).toBeNull();
    expect(year(order[5])).toBeNull();
    const known = order.map(year).filter((y): y is number => y !== null);
    expect([...known].sort((a, b) => a - b)).toEqual(known);
  });

  it("non ordina mai per sesso", () => {
    const ids = sequentialIds("x");
    let ped = createPedigree({ date: "2026-01-01", ids });
    ped.individuals.f = createIndividual("f", { sex: "male", gender: "man" });
    ped.individuals.m = createIndividual("m", { sex: "female", gender: "woman" });
    ped.individuals.a = createIndividual("a", { sex: "female" });
    ped.individuals.b = createIndividual("b", { sex: "male" });
    ped.unions.u = {
      id: "u",
      partners: ["f", "m"],
      status: "current",
      sequence: 1,
      childOrder: "auto",
      children: [{ id: "a", link: "biological" }, { id: "b", link: "biological" }],
    };
    expect(orderChildren(ped, ped.unions.u)).toEqual(["a", "b"]);
    ped = updateIndividual(ped, "a", { sex: "male" });
    ped = updateIndividual(ped, "b", { sex: "female" });
    expect(orderChildren(ped, ped.unions.u)).toEqual(["a", "b"]);
  });

  it("tiene i gemelli in un blocco e li ordina per nascita", () => {
    const ped = twins();
    const u = Object.values(ped.unions)[0];
    const groups = orderChildren(ped, u).map((id) => ped.individuals[id].twin?.groupId);
    expect(groups).toEqual(["MZ", "MZ", "DZ", "DZ", "UN", "UN", "TRI", "TRI", "TRI"]);
  });

  it("il drag cambia solo union.children e si può ripristinare", () => {
    const ped = sibshipOfSix();
    const u = Object.values(ped.unions)[0];
    const before = orderChildren(ped, u);
    const moved = moveChild(ped, u.id, before[4], 0);
    const after = orderChildren(moved, moved.unions[u.id]);
    expect(after[0]).toBe(before[4]);
    expect(moved.unions[u.id].childOrder).toBe("manual");
    expect(moved.individuals).toBe(ped.individuals);
    const reset = resetChildOrder(moved, u.id);
    expect(reset.unions[u.id].childOrder).toBe("auto");
  });

  it("birthOrder esplicito prevale sulle date", () => {
    const ped = sibshipOfSix();
    const u = Object.values(ped.unions)[0];
    const youngest = orderChildren(ped, u)[4];
    const next = updateIndividual(ped, youngest, { birthOrder: 1 });
    expect(orderChildren(next, next.unions[u.id])[0]).toBe(youngest);
  });
});

describe("relazioni", () => {
  it("riconosce i ruoli rispetto al probando in italiano", () => {
    const ped = threeGenerations();
    const rel = (label: string) => getRelationToProband(ped, byLabel(ped, label));
    expect(rel("tg9")).toBe("nonno paterno");
    expect(rel("tg12")).toBe("nonna materna");
    expect(rel("tg1")).toBe("bisnonno paterno");
    expect(rel("tg8")).toBe("bisnonna materna");
    expect(rel("tg13")).toBe("padre");
    expect(rel("tg15")).toBe("probando");
  });

  it("riconosce mezzi fratelli paterni e materni", () => {
    const ped = twoPartners();
    const sibs = getSiblings(ped, ped.proband!);
    expect(sibs.full).toHaveLength(1);
    expect(sibs.half.map((h) => h.side).sort()).toEqual(["maternal", "paternal"]);
    expect(getRelationToProband(ped, byLabel(ped, "tp5"))).toBe("mezzo fratello paterno");
    expect(getRelationToProband(ped, byLabel(ped, "tp6"))).toBe("mezza sorella materna");
  });

  it("calcola consanguineità e grado tra cugini di primo grado", () => {
    const ped = firstCousins();
    const husband = byLabel(ped, "fc7");
    const wife = byLabel(ped, "fc8");
    const c = detectConsanguinity(ped, husband, wife);
    expect(c.related).toBe(true);
    expect(c.label).toBe("cugini di primo grado");
    expect(c.commonAncestors).toHaveLength(2);
    expect(c.kinship).toBeCloseTo(1 / 16);
    const asProband = { ...ped, proband: husband };
    expect(getRelationToProband(asProband, wife)).toBe("cugina di primo grado paterna");
    expect(getRelationToProband(asProband, byLabel(ped, "fc4"))).toBe("zia paterna");
  });

  it("distingue genitori biologici, adottivi e ART", () => {
    const art = artScenarios().find((s) => s.key === "sperm-hetero")!.pedigree;
    const p = getParents(art, art.proband!);
    expect(p.biological).toHaveLength(2);
    expect(p.intended).toHaveLength(2);
    expect(p.donors.map((d) => d.gamete)).toEqual(["sperm"]);

    const ad = adoption();
    const byRelative = byLabel(ad, "ad8");
    const parents = getParents(ad, byRelative);
    expect(parents.adoptive).toHaveLength(2);
    expect(parents.biological).toHaveLength(2);
    // Disegnato sotto i genitori adottivi.
    expect(homeEntry(ad, byRelative)?.link.link).toBe("adoptive");
    // Adottato fuori: sotto i genitori biologici.
    expect(homeEntry(ad, byLabel(ad, "ad9"))?.link.adoptedOut).toBe(true);
  });

  it("canAddParents conta solo i genitori del tipo richiesto", () => {
    const ped = threeGenerations();
    expect(canAddParents(ped, ped.proband!).allowed).toBe(false);
    const sp = singleParent();
    expect(canAddParents(sp, sp.proband!)).toMatchObject({ allowed: true, missing: 1 });
    const ad = adoption();
    const adoptedIn = ad.proband!;
    expect(canAddParents(ad, adoptedIn, "biological")).toMatchObject({ allowed: true, missing: 2 });
    expect(canAddParents(ad, adoptedIn, "adoptive").allowed).toBe(false);
  });
});

describe("comandi", () => {
  const ids = () => sequentialIds("n");

  it("con un solo genitore noto aggiunge solo quello mancante, nella stessa unione", () => {
    const ped = singleParent();
    const union = homeEntry(ped, ped.proband!)!.union;
    const res = addParents(ped, ped.proband!, ids());
    expect(res.created).toHaveLength(1);
    expect(res.unionId).toBe(union.id);
    expect(res.pedigree.unions[union.id].partners).toHaveLength(2);
    // Il nuovo padre va a sinistra (convenzione di progetto).
    expect(res.pedigree.individuals[res.pedigree.unions[union.id].partners[0]].sex).toBe("male");
    expect(() => addParents(res.pedigree, ped.proband!, ids())).toThrow(GenogramError);
  });

  it("aggiunge fratelli, figli (partner nuovo o ignoto) e partner", () => {
    let ped = threeGenerations();
    const gen = ids();
    ped = addSibling(ped, ped.proband!, { sex: "male" }, gen).pedigree;
    expect(getSiblings(ped, ped.proband!).full).toHaveLength(1);
    const withChild = addChild(ped, ped.proband!, { sex: "female" }, gen, { partner: "none" });
    expect(withChild.pedigree.unions[withChild.unionId!].partners).toEqual([ped.proband]);
    const withPartner = addChild(ped, ped.proband!, {}, gen, { partner: "new" });
    expect(withPartner.pedigree.unions[withPartner.unionId!].partners).toHaveLength(2);
    const second = addPartner(withPartner.pedigree, ped.proband!, {}, gen);
    const seqs = Object.values(second.pedigree.unions).map((u) => u.sequence);
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it("aggiungere un fratello a chi non ha genitori crea la coppia di genitori", () => {
    const ped = createPedigree({ date: "2026-01-01" });
    ped.individuals.p = createIndividual("p", { sex: "female" });
    const res = addSibling(ped, "p", {}, ids());
    expect(res.created).toHaveLength(3);
    expect(getSiblings(res.pedigree, "p").full).toHaveLength(1);
  });

  it("il cambio di sesso non rompe unioni e figli", () => {
    const ped = twoPartners();
    const father = byLabel(ped, "tp2");
    const next = updateIndividual(ped, father, { sex: "female", gender: "woman" });
    expect(Object.values(next.unions).filter((u) => u.partners.includes(father))).toHaveLength(2);
    expect(hasErrors(validate(next))).toBe(false);
  });

  it("non elimina il probando né un individuo ponte; propone il segnaposto", () => {
    const ped = threeGenerations();
    expect(planRemoval(ped, ped.proband!, false).blocked).toBeTruthy();
    const mother = byLabel(ped, "tg14");
    expect(planRemoval(ped, mother, false).disconnects).toBe(true);
    expect(() => removeIndividual(ped, mother, false)).toThrow(GenogramError);
    expect(planRemoval(ped, mother, true).blocked).toMatch(/probando/);
    const replaced = replaceWithPlaceholder(ped, mother);
    expect(replaced.individuals[mother].placeholder).toBe(true);
    expect(connectedComponents(replaced)).toHaveLength(1);
  });

  it("elimina una foglia insieme ai partner che resterebbero isolati", () => {
    const ped = chainUnions();
    const k3 = byLabel(ped, "ch7");
    const next = removeIndividual(ped, k3, false);
    expect(next.individuals[k3]).toBeUndefined();
    expect(hasErrors(validate(next))).toBe(false);
    const twoP = twoPartners();
    const half = byLabel(twoP, "tp5");
    const plan = planRemoval(twoP, half, false);
    expect(plan.disconnects).toBe(false);
  });

  it("i gemelli devono stare nella stessa fratria", () => {
    const ped = twoPartners();
    expect(() =>
      setTwins(ped, [byLabel(ped, "tp5"), byLabel(ped, "tp7")], "DZ", ids())
    ).toThrow(GenogramError);
  });

  it("espande un simbolo multiplo in individui singoli", () => {
    const ped = mixedAgesAndMultiples();
    const three = Object.values(ped.individuals).find((i) => i.multiple === 3)!;
    const res = expandMultiple(ped, three.id, ids());
    expect(res.created).toHaveLength(2);
    expect(res.pedigree.individuals[three.id].multiple).toBeUndefined();
    expect(getSiblings(res.pedigree, three.id).full.length).toBeGreaterThanOrEqual(3);
    const n = Object.values(ped.individuals).find((i) => i.multiple === "n")!;
    expect(() => expandMultiple(ped, n.id, ids())).toThrow(GenogramError);
    expect(expandMultiple(ped, n.id, ids(), 4).created).toHaveLength(3);
  });

  it("undo/redo con istantanee immutabili", () => {
    const a = threeGenerations();
    const b = updateIndividual(a, a.proband!, { notes: "x" });
    let h = commit(createHistory(a), b);
    expect(commit(h, h.present)).toBe(h);
    h = undo(h);
    expect(h.present).toBe(a);
    h = redo(h);
    expect(h.present).toBe(b);
    expect(a.individuals[a.proband!].notes).toBeUndefined();
  });
});

describe("KIN", () => {
  it("esporta donatori, gestanti, surrogate e gemelli con i codici GA4GH", () => {
    const codes = (key: string) =>
      toKinRelations(artScenarios().find((s) => s.key === key)!.pedigree).map((r) => r.relation);
    expect(codes("sperm-hetero")).toContain(KIN.isSpermDonorOf);
    expect(codes("egg")).toContain(KIN.isOvumDonorOf);
    expect(codes("gestational-carrier")).toContain(KIN.isGestationalCarrierOf);
    expect(codes("surrogate")).toContain(KIN.isSurrogateOvumDonorOf);
    expect(codes("surrogate")).not.toContain(KIN.isGestationalCarrierOf);
    const tw = toKinRelations(twins()).map((r) => r.relation);
    expect(tw).toContain(KIN.isMonozygoticMultipleBirthSiblingOf);
    expect(tw).toContain(KIN.isPolyzygoticMultipleBirthSiblingOf);
    expect(tw).toContain(KIN.isMultipleBirthSiblingOf);
    expect(toKinRelations(firstCousins()).map((r) => r.relation)).toContain(KIN.isConsanguineousPartnerOf);
    expect(toKinRelations(twoPartners()).map((r) => r.relation)).toContain(KIN.isSeparatedPartnerOf);
    const preg = toKinRelations(pregnancies());
    expect(preg.filter((r) => r.relation === KIN.isBiologicalMotherOf)).toHaveLength(8);
  });

  it("forma ridotta: niente relazioni tra fratelli implicite", () => {
    const rel = toKinRelations(sibshipOfSix()).map((r) => r.relation);
    expect(rel).not.toContain(KIN.isFullSiblingOf);
  });
});

describe("migrazione e import difensivo", () => {
  it.each(Object.entries(FIXTURES))("%s: JSON andata e ritorno senza perdite", (_n, make) => {
    const ped = make();
    const res = migrate(JSON.parse(JSON.stringify(ped)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.pedigree).toEqual(ped);
  });

  it("rifiuta file non validi o di versione futura con un messaggio", () => {
    for (const [name, raw] of Object.entries(CORRUPT_FILES)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // L'errore di sintassi è gestito dal livello io.
      }
      const res = migrate(parsed);
      if (name === "brokenRefs" || name === "protoPollution") {
        expect(res.ok).toBe(true);
      } else {
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.error.length).toBeGreaterThan(10);
      }
    }
    const future = migrate(JSON.parse(CORRUPT_FILES.futureVersion));
    expect(future.ok === false && future.error).toMatch(/più recente/);
  });

  it("segnala i riferimenti rotti senza crash", () => {
    const res = migrate(JSON.parse(CORRUPT_FILES.brokenRefs));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pedigree.proband).toBeUndefined();
      expect(validate(res.pedigree).some((i) => i.code === "broken-ref")).toBe(true);
    }
  });

  it("non permette prototype pollution", () => {
    const res = migrate(JSON.parse(CORRUPT_FILES.protoPollution));
    expect(res.ok).toBe(true);
    if (res.ok) expect(Object.keys(res.pedigree.individuals)).toEqual(["x"]);
    expect(({} as Record<string, unknown>).sex).toBeUndefined();
  });
});

describe("dati da completare", () => {
  it("\"Non lo so\" resta un dato distinto dal campo vuoto", () => {
    const ind = createIndividual("x", { birth: "unknown", vital: "unknown", healthUnknown: true });
    expect(unknownFields(ind)).toEqual(["sesso", "età", "stato in vita", "salute"]);
    expect(unknownFields(createIndividual("y", { sex: "male" }))).toEqual([]);
  });
});
