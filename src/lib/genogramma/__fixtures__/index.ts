import type { Pedigree } from "../model/types";
import { PedigreeBuilder } from "./builder";

/**
 * Fixture obbligatorie (nessun dato reale). Ogni funzione restituisce un
 * genogramma nuovo; `FIXTURES` le elenca per i test su tutte le fixture.
 */

/** Probando con genitori, nonni e bisnonni completi. */
export function threeGenerations(): Pedigree {
  const b = new PedigreeBuilder("tg");
  const ggf = [b.man({ birth: "1910", vital: "deceased", death: { age: { value: 70, unit: "y" } } }),
    b.woman({ birth: "1912", vital: "deceased" }),
    b.man({ birth: "1915", vital: "deceased" }),
    b.woman({ birth: "1918", vital: "deceased" }),
    b.man({ birth: "1914", vital: "deceased" }),
    b.woman({ birth: "1916", vital: "deceased" }),
    b.man({ birth: "1913", vital: "deceased" }),
    b.woman({ birth: "1919", vital: "deceased" })];
  const gpf = b.man({ birth: "1938" });
  const gmf = b.woman({ birth: "1940" });
  const gpm = b.man({ birth: "1941", vital: "deceased", death: { date: "2007", cause: "infarto" } });
  const gmm = b.woman({ birth: "1943" });
  b.union([ggf[0], ggf[1]], [gpf]);
  b.union([ggf[2], ggf[3]], [gmf]);
  b.union([ggf[4], ggf[5]], [gpm]);
  b.union([ggf[6], ggf[7]], [gmm]);
  const father = b.man({ birth: "1965" });
  const mother = b.woman({ birth: "1967" });
  b.union([gpf, gmf], [father]);
  b.union([gpm, gmm], [mother]);
  const proband = b.girl({ birth: "2019-04-02" });
  b.union([father, mother], [proband]);
  return b.build(proband);
}

/** Fratria di 6 con età note e non note, in diverse precisioni. */
export function sibshipOfSix(): Pedigree {
  const b = new PedigreeBuilder("s6");
  const f = b.man({ birth: "1960" });
  const m = b.woman({ birth: "1962" });
  // Inseriti in ordine sparso: il layout li ordina dal più grande al più piccolo.
  const youngest = b.boy({ birth: "2001-06-10" });
  const unknownA = b.girl({ birth: "unknown" });
  const eldest = b.man({ birth: "1985" });
  const byAge = b.woman({ age: { value: 30, unit: "y" } });
  const decade = b.man({ birth: { decade: 1990 } });
  const unknownB = b.boy();
  b.union([f, m], [youngest, unknownA, eldest, byAge, decade, unknownB]);
  return b.build(youngest);
}

/**
 * Uomo con due partner e figli da entrambe; la madre del probando ha un
 * figlio da una relazione precedente: mezzi fratelli da entrambi i lati.
 */
export function twoPartners(): Pedigree {
  const b = new PedigreeBuilder("tp");
  const exWife = b.woman({ birth: "1966" });
  const father = b.man({ birth: "1964" });
  const mother = b.woman({ birth: "1970" });
  const exHusband = b.man({ birth: "1968" });
  const paternalHalf = b.man({ birth: "1990" });
  const maternalHalf = b.girl({ birth: "1993" });
  const proband = b.boy({ birth: "2005" });
  const sister = b.girl({ birth: "2008" });
  b.union([father, exWife], [paternalHalf], { status: "ended" });
  b.union([exHusband, mother], [maternalHalf], { status: "ended" });
  b.union([father, mother], [proband, sister]);
  return b.build(proband);
}

/** Coppia consanguinea: cugini di primo grado. */
export function firstCousins(): Pedigree {
  const b = new PedigreeBuilder("fc");
  const gp = b.man({ birth: "1930", vital: "deceased" });
  const gm = b.woman({ birth: "1932", vital: "deceased" });
  const uncle = b.man({ birth: "1955" });
  const aunt = b.woman({ birth: "1958" });
  const uncleWife = b.woman({ birth: "1957" });
  const auntHusband = b.man({ birth: "1956" });
  b.union([gp, gm], [uncle, aunt]);
  const husband = b.man({ birth: "1980" });
  const wife = b.woman({ birth: "1982" });
  b.union([uncle, uncleWife], [husband]);
  b.union([auntHusband, aunt], [wife]);
  const proband = b.boy({ birth: "2015" });
  b.union([husband, wife], [proband], { consanguinity: { degree: "cugini di primo grado" } });
  return b.build(proband);
}

/** Gemelli MZ, DZ di sesso diverso, zigosità ignota, trigemini; un gemello deceduto e uno nato morto. */
export function twins(): Pedigree {
  const b = new PedigreeBuilder("tw");
  const f = b.man({ birth: "1975" });
  const m = b.woman({ birth: "1977" });
  const mz1 = b.girl({ birth: "2000", twin: { groupId: "MZ", zygosity: "MZ", proven: true } });
  const mz2 = b.girl({ birth: "2000", twin: { groupId: "MZ", zygosity: "MZ", proven: true } });
  const dz1 = b.boy({ birth: "2003", twin: { groupId: "DZ", zygosity: "DZ" } });
  const dz2 = b.girl({
    birth: "2003",
    twin: { groupId: "DZ", zygosity: "DZ" },
    vital: "deceased",
    death: { age: { value: 4, unit: "mo" } },
  });
  const un1 = b.boy({ birth: "2006", twin: { groupId: "UN", zygosity: "unknown" } });
  const un2 = b.pregnancy("SB", { sex: "male", twin: { groupId: "UN", zygosity: "unknown" }, pregnancy: { outcome: "SB", gestationalWeeks: 34 } });
  const t1 = b.boy({ birth: "2010", twin: { groupId: "TRI", zygosity: "unknown" } });
  const t2 = b.boy({ birth: "2010", twin: { groupId: "TRI", zygosity: "unknown" } });
  const t3 = b.girl({ birth: "2010", twin: { groupId: "TRI", zygosity: "unknown" } });
  b.union([f, m], [t1, t2, t3, mz1, mz2, dz1, dz2, un1, un2]);
  return b.build(dz1);
}

/** Adozione dentro, fuori e da parente (con famiglia biologica nota). */
export function adoption(): Pedigree {
  const b = new PedigreeBuilder("ad");
  const gp = b.man({ birth: "1940" });
  const gm = b.woman({ birth: "1942" });
  const adoptiveFather = b.man({ birth: "1968" });
  const adoptiveMother = b.woman({ birth: "1970" });
  const sister = b.woman({ birth: "1975" });
  const sisterPartner = b.man({ birth: "1974" });
  b.union([gp, gm], [adoptiveMother, sister]);
  const adoptedIn = b.boy({ birth: "2005" });
  const byRelative = b.girl({ birth: "2010" });
  const adoptedOut = b.boy({ birth: "2012" });
  b.union([adoptiveFather, adoptiveMother], [
    { id: adoptedIn, link: "adoptive" },
    { id: byRelative, link: "adoptive" },
  ]);
  // La nipote, figlia biologica della sorella, è adottata dalla zia;
  // un altro figlio della sorella è stato dato in adozione fuori famiglia.
  b.union([sisterPartner, sister], [byRelative, { id: adoptedOut, link: "biological", adoptedOut: true }], {
    status: "ended",
  });
  return b.build(adoptedIn);
}

/** Gravidanza in corso, SAB, TOP, ECT, nato morto (anche affetti). */
export function pregnancies(): Pedigree {
  const b = new PedigreeBuilder("pg");
  const t21 = b.condition("Trisomia 21", [{ system: "ORPHA", code: "870" }]);
  const f = b.man({ birth: "1985" });
  const m = b.woman({ birth: "1987" });
  const child = b.girl({ birth: "2016" });
  const ongoing = b.pregnancy("ongoing", {
    sex: "male",
    karyotype: "46,XY",
    pregnancy: { outcome: "ongoing", gestationalWeeks: 16, result: "46,XY", method: "Amnio" },
  });
  const sab = b.pregnancy("SAB", { pregnancy: { outcome: "SAB", gestationalWeeks: 10 } });
  const sabAffected = b.pregnancy("SAB", {
    karyotype: "47,XX,+21",
    conditions: [{ conditionId: t21, status: "affected" }],
    pregnancy: { outcome: "SAB", gestationalWeeks: 12 },
  });
  const top = b.pregnancy("TOP", { pregnancy: { outcome: "TOP", gestationalWeeks: 9 } });
  const topAffected = b.pregnancy("TOP", {
    sex: "female",
    karyotype: "47,XX,+21",
    conditions: [{ conditionId: t21, status: "affected" }],
    pregnancy: { outcome: "TOP", gestationalWeeks: 18, method: "CVS" },
  });
  const ect = b.pregnancy("ECT", { pregnancy: { outcome: "ECT", gestationalWeeks: 7 } });
  const sb = b.pregnancy("SB", { sex: "female", pregnancy: { outcome: "SB", gestationalWeeks: 34 } });
  b.union([f, m], [child, sab, sabAffected, top, topAffected, ect, sb, ongoing]);
  return b.build(child, [m]);
}

/** Persona transgender e persona non binaria con AMAB/AFAB/UAAB. */
export function genderDiverse(): Pedigree {
  const b = new PedigreeBuilder("gd");
  const f = b.man({ birth: "1960" });
  const m = b.woman({ birth: "1962" });
  const transMan = b.person({ sex: "female", gender: "man", birth: "1988" });
  const transWoman = b.person({ sex: "male", gender: "woman", birth: "1990" });
  const nbAmab = b.person({ sex: "male", gender: "non-binary", birth: "1992" });
  const nbAfab = b.person({ sex: "female", gender: "non-binary", birth: "1994" });
  const uaab = b.person({ sex: "unassigned", gender: "not-expressed", birth: "1996" });
  const unknown = b.person({ sex: "unknown", gender: "unknown", birth: "1998" });
  b.union([f, m], [transMan, transWoman, nbAmab, nbAfab, uaab, unknown]);
  return b.build(transMan);
}

export interface ArtScenario {
  key: string;
  title: string;
  pedigree: Pedigree;
}

/** Tutti gli scenari della Fig. 5 (NSGC 2022, corretta nel 2025). */
export function artScenarios(): ArtScenario[] {
  const out: ArtScenario[] = [];

  {
    const b = new PedigreeBuilder("a1");
    const h = b.man({ birth: "1980" });
    const w = b.woman({ birth: "1982" });
    const donor = b.man();
    const child = b.girl({ birth: "2020" });
    b.union([h, w], [{ id: child, link: "art", art: { eggFrom: w, spermFrom: donor, carriedBy: w } }]);
    out.push({ key: "sperm-hetero", title: "Seme da donatore, coppia eterosessuale", pedigree: b.build(child) });
  }
  {
    const b = new PedigreeBuilder("a2");
    const a = b.woman({ birth: "1984" });
    const c = b.woman({ birth: "1985" });
    const donor = b.man();
    const child = b.boy({ birth: "2021" });
    b.union([a, c], [{ id: child, link: "art", art: { eggFrom: a, spermFrom: donor, carriedBy: a } }]);
    out.push({ key: "sperm-lesbian", title: "Seme da donatore, coppia di donne", pedigree: b.build(child) });
  }
  {
    const b = new PedigreeBuilder("a3");
    const w = b.woman({ birth: "1983" });
    const donor = b.man();
    const child = b.girl({ birth: "2019" });
    const preg = b.pregnancy("ongoing", { pregnancy: { outcome: "ongoing", gestationalWeeks: 20 } });
    b.union([w], [
      { id: child, link: "art", art: { eggFrom: w, spermFrom: donor, carriedBy: w } },
      { id: preg, link: "art", art: { eggFrom: w, spermFrom: donor, carriedBy: w } },
    ]);
    out.push({
      key: "sperm-single",
      title: "Donna senza partner: figlio e gravidanza dallo stesso donatore",
      pedigree: b.build(child),
    });
  }
  {
    const b = new PedigreeBuilder("a4");
    const transMan = b.person({ sex: "female", gender: "man", birth: "1990" });
    const partner = b.woman({ birth: "1989" });
    const donor = b.man();
    const preg = b.pregnancy("ongoing", { pregnancy: { outcome: "ongoing", gestationalWeeks: 24 } });
    b.union([transMan, partner], [
      { id: preg, link: "art", art: { eggFrom: transMan, spermFrom: donor, carriedBy: transMan } },
    ]);
    out.push({ key: "trans-man", title: "Uomo trans in gravidanza, seme da donatore", pedigree: b.build(transMan) });
  }
  {
    const b = new PedigreeBuilder("a5");
    const nb = b.person({ sex: "female", gender: "non-binary", birth: "1991" });
    const donor = b.man();
    const preg = b.pregnancy("ongoing", { pregnancy: { outcome: "ongoing", gestationalWeeks: 12 } });
    b.union([nb], [{ id: preg, link: "art", art: { eggFrom: nb, spermFrom: donor, carriedBy: nb } }]);
    out.push({ key: "non-binary", title: "Persona non binaria in gravidanza, seme da donatore", pedigree: b.build(nb) });
  }
  {
    const b = new PedigreeBuilder("a6");
    const h = b.man({ birth: "1975" });
    const w = b.woman({ birth: "1976" });
    const donor = b.woman();
    const child = b.boy({ birth: "2018" });
    b.union([h, w], [{ id: child, link: "art", art: { eggFrom: donor, spermFrom: h, carriedBy: w } }]);
    out.push({ key: "egg", title: "Ovodonazione", pedigree: b.build(child) });
  }
  {
    const b = new PedigreeBuilder("a7");
    const h = b.man({ birth: "1972" });
    const w = b.woman({ birth: "1974" });
    const eggDonor = b.woman();
    const spermDonor = b.man();
    const child = b.girl({ birth: "2017" });
    b.union([h, w], [
      { id: child, link: "art", art: { eggFrom: eggDonor, spermFrom: spermDonor, carriedBy: w } },
    ]);
    out.push({ key: "double", title: "Doppia donazione", pedigree: b.build(child) });
  }
  {
    const b = new PedigreeBuilder("a8");
    const h = b.man({ birth: "1978" });
    const w = b.woman({ birth: "1979" });
    const carrier = b.woman({ birth: "1985" });
    const preg = b.pregnancy("ongoing", { pregnancy: { outcome: "ongoing", gestationalWeeks: 28 } });
    b.union([h, w], [{ id: preg, link: "art", art: { eggFrom: w, spermFrom: h, carriedBy: carrier } }]);
    out.push({ key: "gestational-carrier", title: "Gestante per altri", pedigree: b.build(h) });
  }
  {
    const b = new PedigreeBuilder("a9");
    const h = b.man({ birth: "1977" });
    const w = b.woman({ birth: "1978" });
    const surrogate = b.woman({ birth: "1986" });
    const preg = b.pregnancy("ongoing", { pregnancy: { outcome: "ongoing", gestationalWeeks: 22 } });
    b.union([h, w], [
      { id: preg, link: "art", art: { eggFrom: surrogate, spermFrom: h, carriedBy: surrogate } },
    ]);
    out.push({ key: "surrogate", title: "Surrogata (ovocita e gravidanza)", pedigree: b.build(h) });
  }
  {
    const b = new PedigreeBuilder("a10");
    const a = b.man({ birth: "1980" });
    const c = b.man({ birth: "1981" });
    const eggDonor = b.woman();
    const carrier = b.woman({ birth: "1988" });
    const child1 = b.girl({ birth: "2020" });
    const child2 = b.boy({ birth: "2022" });
    b.union([a, c], [
      { id: child1, link: "art", art: { eggFrom: eggDonor, spermFrom: a, carriedBy: carrier } },
      { id: child2, link: "art", art: { eggFrom: eggDonor, spermFrom: c, carriedBy: carrier } },
    ]);
    out.push({
      key: "same-sex-men",
      title: "Coppia di uomini: ovodonazione e gestante per altri",
      pedigree: b.build(child1),
    });
  }
  return out;
}

/** Più condizioni e stati di portatore sullo stesso individuo; valutazioni E1+, E2-, Eu. */
export function conditionsAndEvaluations(): Pedigree {
  const b = new PedigreeBuilder("ce");
  const cf = b.condition("Fibrosi cistica", [{ system: "ORPHA", code: "586" }]);
  const hcm = b.condition("Cardiomiopatia ipertrofica", [{ system: "HPO", code: "HP:0001639" }]);
  const brca = b.condition("Tumore della mammella", [{ system: "ICD10", code: "C50" }]);
  const hd = b.condition("Malattia di Huntington", [{ system: "OMIM", code: "143100" }]);
  const echo = b.evaluation("Ecocardiogramma");
  const gene = b.evaluation("Test genetico BRCA1");
  const repeats = b.evaluation("Ripetute CAG (HTT)");
  const f = b.man({
    birth: "1958",
    conditions: [{ conditionId: hd, status: "affected", onset: { value: 52, unit: "y" } }],
    evaluations: [{ evaluationId: repeats, result: "+", repeats: ["44n", "17n"] }],
    documentedEvaluation: true,
  });
  const m = b.woman({
    birth: "1960",
    conditions: [
      { conditionId: brca, status: "affected", diagnosis: { value: 45, unit: "y" } },
      { conditionId: cf, status: "carrier" },
    ],
    evaluations: [{ evaluationId: gene, result: "+", variant: "5385insC", gene: "BRCA1" }],
  });
  const proband = b.woman({
    birth: "1988",
    conditions: [
      { conditionId: cf, status: "affected", onset: { value: 1, unit: "y" } },
      { conditionId: hcm, status: "affected", diagnosis: { value: 30, unit: "y" } },
      { conditionId: brca, status: "carrier" },
      { conditionId: hd, status: "presymptomatic" },
    ],
    evaluations: [
      { evaluationId: echo, result: "+", detail: "echo" },
      { evaluationId: gene, result: "-" },
      { evaluationId: repeats, result: "u", repeats: ["36n", "18n"] },
    ],
    documentedEvaluation: true,
    notes: "Nota molto lunga per verificare che il testo vada a capo senza sovrapporsi ai simboli vicini.",
  });
  const brother = b.man({ birth: "1990", conditions: [{ conditionId: cf, status: "carrier" }] });
  b.union([f, m], [proband, brother]);
  return b.build(proband);
}

/** Unioni a catena: A con B, poi B con C, poi C con D. */
export function chainUnions(): Pedigree {
  const b = new PedigreeBuilder("ch");
  const a = b.woman({ birth: "1960" });
  const bb = b.man({ birth: "1958" });
  const c = b.woman({ birth: "1962" });
  const d = b.man({ birth: "1961" });
  const k1 = b.boy({ birth: "1985" });
  const k2 = b.girl({ birth: "1990" });
  const k3 = b.boy({ birth: "1995" });
  b.union([bb, a], [k1], { status: "ended" });
  b.union([bb, c], [k2], { status: "ended" });
  b.union([d, c], [k3]);
  return b.build(k2);
}

/** Un solo genitore noto (linea dal singolo). */
export function singleParent(): Pedigree {
  const b = new PedigreeBuilder("sp");
  const gp = b.man({ birth: "1950" });
  const gm = b.woman({ birth: "1952" });
  const mother = b.woman({ birth: "1980" });
  b.union([gp, gm], [mother]);
  const proband = b.boy({ birth: "2012" });
  b.union([mother], [proband]);
  return b.build(proband);
}

/** Età miste e approssimative, individui multipli (numero e "n"). */
export function mixedAgesAndMultiples(): Pedigree {
  const b = new PedigreeBuilder("ma");
  const gp = b.man({ birth: { decade: 1930 }, vital: "deceased", death: { age: { decade: 60 } } });
  const gm = b.woman({ age: { value: 85, unit: "y", approx: true } });
  const father = b.man({ birth: "1962-03" });
  const three = b.woman({ multiple: 3, birth: { decade: 1960 } });
  const many = b.person({ multiple: "n", sex: "unknown", gender: "unknown" });
  b.union([gp, gm], [three, father, many]);
  const mother = b.woman({ age: { value: 58, unit: "y" } });
  const baby = b.girl({ birth: "2025-12-20" });
  const toddler = b.boy({ birth: "2025-03-01" });
  const proband = b.girl({ birth: "2023-07-15" });
  b.union([father, mother], [baby, toddler, proband]);
  return b.build(proband);
}

/**
 * Famiglia grande (≥ 150 individui), generata in modo deterministico:
 * più generazioni di discendenti con partner entrati in famiglia.
 */
export function largeFamily(target = 160): Pedigree {
  const b = new PedigreeBuilder("lg");
  let count = 0;
  const founder = b.man({ birth: "1900" });
  const founderWife = b.woman({ birth: "1902" });
  count += 2;
  let generation: string[] = [];
  const kids: string[] = [];
  for (let i = 0; i < 5; i++) {
    kids.push(i % 2 === 0 ? b.man({ birth: String(1925 + i * 2) }) : b.woman({ birth: String(1925 + i * 2) }));
    count += 1;
  }
  b.union([founder, founderWife], kids);
  generation = kids;
  let year = 1950;
  let rng = 7;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };
  let proband: string | undefined;
  while (count < target) {
    const next: string[] = [];
    for (const person of generation) {
      if (count >= target) break;
      const male = b.get(person).sex === "male";
      const partner = male ? b.woman({ birth: String(year) }) : b.man({ birth: String(year) });
      count += 1;
      const n = 1 + Math.floor(rand() * 3);
      const children: string[] = [];
      for (let k = 0; k < n && count < target; k++) {
        const child = rand() < 0.5 ? b.man({ birth: String(year + 25 + k * 2) }) : b.woman({ birth: String(year + 25 + k * 2) });
        children.push(child);
        count += 1;
      }
      b.union(male ? [person, partner] : [partner, person], children);
      next.push(...children);
    }
    if (next.length === 0) break;
    proband = next[0];
    generation = next;
    year += 25;
  }
  return b.build(proband);
}

/** Contenuti ostili nei campi di testo: script, formule CSV, markup. */
export function hostileText(): Pedigree {
  const b = new PedigreeBuilder("ht");
  const f = b.man({ label: "<script>alert(1)</script>", notes: "</text><svg onload=alert(1)>" });
  const m = b.woman({ label: "=cmd|' /C calc'!A0", notes: "+SUM(A1:A2)" });
  const c = b.girl({ label: "@import", notes: "-2+3 & \"quote\" 'apos' <b>" });
  b.union([f, m], [c]);
  return b.build(c);
}

/** File corrotti o non validi per l'import (stringhe grezze). */
export const CORRUPT_FILES: Record<string, string> = {
  notJson: "{ questo non è json",
  empty: "",
  array: "[1,2,3]",
  noVersion: JSON.stringify({ individuals: {} }),
  futureVersion: JSON.stringify({ schemaVersion: 99, individuals: {}, unions: {} }),
  brokenRefs: JSON.stringify({
    schemaVersion: 1,
    individuals: { a: { sex: "male", gender: "man" } },
    unions: { u: { partners: ["a", "ghost"], children: [{ id: "missing" }] } },
    proband: "nobody",
  }),
  protoPollution: '{"schemaVersion":1,"individuals":{"__proto__":{"sex":"male"},"x":{"sex":"female"}},"unions":{}}',
};

export const FIXTURES: Record<string, () => Pedigree> = {
  threeGenerations,
  sibshipOfSix,
  twoPartners,
  firstCousins,
  twins,
  adoption,
  pregnancies,
  genderDiverse,
  conditionsAndEvaluations,
  chainUnions,
  singleParent,
  mixedAgesAndMultiples,
  hostileText,
  ...Object.fromEntries(
    artScenarios().map((s) => [`art:${s.key}`, () => artScenarios().find((x) => x.key === s.key)!.pedigree])
  ),
};
