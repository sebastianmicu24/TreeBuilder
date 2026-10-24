import { describe, expect, it } from "vitest";
import {
  adoption,
  artScenarios,
  conditionsAndEvaluations,
  CORRUPT_FILES,
  FIXTURES,
  firstCousins,
  hostileText,
  pregnancies,
  threeGenerations,
  twins,
  twoPartners,
} from "../__fixtures__";
import {
  exportCsv,
  exportFhir,
  exportGa4gh,
  exportNativeJson,
  exportPed,
  exportPhenopacket,
  exportSvg,
  identifyingData,
  importAny,
  importCsv,
  importGa4gh,
  importGedcom,
  importNativeJson,
  importPed,
  importPhenopacket,
  MAX_IMPORT_BYTES,
  stripIdentifying,
} from "../io";
import { csvCell, parseCsv } from "../io/csv";
import { findOverlaps, layout } from "../layout";
import { updateIndividual } from "../model/commands";
import { artRoles } from "../model/notation";
import { getRelationToProband } from "../model/queries";
import { hasErrors, validate } from "../model/validate";
import type { Pedigree } from "../model/types";

/** Firma strutturale: relazioni rispetto al probando (multinsieme ordinato). */
function relations(ped: Pedigree): string[] {
  return Object.keys(ped.individuals)
    .map((id) => getRelationToProband(ped, id))
    .sort();
}

function ok(res: ReturnType<typeof importAny>): Pedigree {
  if (!res.ok) throw new Error(res.error);
  return res.pedigree;
}

describe("JSON nativo", () => {
  it.each(Object.entries(FIXTURES))("%s: export → import senza perdita", (_n, make) => {
    const ped = make();
    expect(ok(importNativeJson(exportNativeJson(ped)))).toEqual(ped);
  });

  it("messaggi chiari per file non validi, di versione futura o troppo grandi", () => {
    const msg = (t: string) => {
      const r = importNativeJson(t);
      return r.ok ? "" : r.error;
    };
    expect(msg(CORRUPT_FILES.notJson)).toMatch(/JSON valido/);
    expect(msg(CORRUPT_FILES.empty)).toMatch(/vuoto/);
    expect(msg(CORRUPT_FILES.futureVersion)).toMatch(/più recente/);
    expect(msg(CORRUPT_FILES.brokenRefs)).toMatch(/errori di struttura/);
    expect(msg("x".repeat(MAX_IMPORT_BYTES + 1))).toMatch(/troppo grande/);
  });
});

describe("CSV", () => {
  it.each([
    ["threeGenerations", threeGenerations],
    ["twoPartners", twoPartners],
    ["firstCousins", firstCousins],
    ["twins", twins],
    ["adoption", adoption],
    ["pregnancies", pregnancies],
  ])("%s: andata e ritorno della struttura", (_n, make) => {
    const ped = make();
    const back = ok(importCsv(exportCsv(ped)));
    expect(hasErrors(validate(back))).toBe(false);
    expect(Object.keys(back.individuals)).toHaveLength(Object.keys(ped.individuals).length);
    expect(relations(back)).toEqual(relations(ped));
    expect(findOverlaps(layout(back))).toEqual([]);
  });

  it("conserva gemelli, condizioni e consanguineità", () => {
    const t = ok(importCsv(exportCsv(twins())));
    expect(Object.values(t.individuals).filter((i) => i.twin?.zygosity === "MZ")).toHaveLength(2);
    const c = ok(importCsv(exportCsv(conditionsAndEvaluations())));
    expect(c.legend.conditions.map((x) => x.label).sort()).toEqual(conditionsAndEvaluations().legend.conditions.map((x) => x.label).sort());
    const f = ok(importCsv(exportCsv(firstCousins())));
    expect(Object.values(f.unions).some((u) => u.consanguinity)).toBe(true);
  });

  it("protegge dalle formule e ripristina il testo all'import", () => {
    expect(csvCell("=cmd|' /C calc'!A0", ";")).toBe("'=cmd|' /C calc'!A0");
    expect(csvCell("+SUM(A1)", ";")).toBe("'+SUM(A1)");
    expect(csvCell("a;b", ";")).toBe('"a;b"');
    const csv = exportCsv(hostileText());
    expect(csv).not.toMatch(/;=cmd/);
    const back = ok(importCsv(csv));
    expect(Object.values(back.individuals).map((i) => i.label).sort()).toEqual(
      Object.values(hostileText().individuals).map((i) => i.label).sort()
    );
  });

  it("parser RFC 4180 con virgolette e a capo", () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;2;3', ";")).toEqual([
      ["a", "b;c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("PED", () => {
  it("6 colonne, 0 per genitore ignoto, sesso e fenotipo codificati", () => {
    const ped = conditionsAndEvaluations();
    const cf = ped.legend.conditions[0].id;
    const text = exportPed(ped, cf);
    const rows = text.trim().split("\n").map((l) => l.split("\t"));
    expect(rows.every((r) => r.length === 6)).toBe(true);
    expect(rows.some((r) => r[2] === "0" && r[3] === "0")).toBe(true);
    expect(rows.filter((r) => r[5] === "2")).toHaveLength(1);
    const back = ok(importPed(text));
    expect(Object.keys(back.individuals)).toHaveLength(Object.keys(ped.individuals).length);
    expect(Object.values(back.individuals).filter((i) => i.conditions.length)).toHaveLength(1);
  });

  it("andata e ritorno della struttura biologica", () => {
    const ped = threeGenerations();
    const back = ok(importPed(exportPed(ped)));
    expect(Object.values(back.unions).filter((u) => u.children.length)).toHaveLength(7);
    expect(Object.values(back.individuals).filter((i) => i.sex === "male")).toHaveLength(
      Object.values(ped.individuals).filter((i) => i.sex === "male").length
    );
  });

  it("rifiuta righe incomplete", () => {
    expect(importPed("F1 A 0 0 1").ok).toBe(false);
  });
});

describe("GA4GH Pedigree (KIN)", () => {
  it.each(Object.entries(FIXTURES).filter(([n]) => n !== "hostileText"))("%s: andata e ritorno delle relazioni", (_n, make) => {
    const ped = make();
    const back = ok(importGa4gh(exportGa4gh(ped)));
    expect(relations(back)).toEqual(relations(ped));
  });

  it("conserva i ruoli ART (D, G, surrogata)", () => {
    for (const s of artScenarios()) {
      const back = ok(importGa4gh(exportGa4gh(s.pedigree)));
      const before = [...artRoles(s.pedigree).values()].sort();
      const after = [...artRoles(back).values()].sort();
      expect(after).toEqual(before);
    }
  });
});

describe("Phenopackets v2 Family", () => {
  it("export con struttura dello schema e import dei fenotipi", () => {
    const ped = conditionsAndEvaluations();
    const json = JSON.parse(exportPhenopacket(ped, ped.legend.conditions[0].id));
    expect(json.metaData.phenopacketSchemaVersion).toBe("2.0");
    expect(json).toHaveProperty("consanguinousParents");
    expect(json.pedigree.persons[0]).toHaveProperty("paternalId");
    expect(json.proband.phenotypicFeatures.map((f: { type: { id: string } }) => f.type.id)).toContain("HP:0001639");
    const back = ok(importPhenopacket(JSON.stringify(json)));
    expect(Object.keys(back.individuals)).toHaveLength(Object.keys(ped.individuals).length);
    expect(back.legend.conditions.some((c) => c.codes.some((x) => x.code === "HP:0001639"))).toBe(true);
    expect(relations(back)).toEqual(relations(ped));
  });
});

describe("FHIR R4 (sperimentale)", () => {
  it("Bundle con Patient e FamilyMemberHistory e codici v3-RoleCode", () => {
    const ped = threeGenerations();
    const bundle = JSON.parse(exportFhir(ped));
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.meta.tag[0].code).toBe("experimental");
    const codes = bundle.entry.slice(1).map((e: { resource: { relationship: { coding: { code: string }[] } } }) => e.resource.relationship.coding[0].code);
    expect(codes).toEqual(expect.arrayContaining(["NFTH", "NMTH", "PGRFTH", "PGRMTH", "MGRFTH", "MGRMTH", "PGGRFTH", "MGGRMTH"]));
    expect(bundle.entry).toHaveLength(Object.keys(ped.individuals).length);
  });
});

describe("GEDCOM (solo import)", () => {
  it("importa individui e famiglie, nomi ridotti a iniziali", () => {
    const ged = [
      "0 HEAD",
      "0 @I1@ INDI",
      "1 NAME Mario /Rossi/",
      "1 SEX M",
      "1 BIRT",
      "2 DATE 12 MAR 1950",
      "0 @I2@ INDI",
      "1 NAME Anna /Bianchi/",
      "1 SEX F",
      "0 @I3@ INDI",
      "1 SEX F",
      "1 DEAT",
      "2 DATE 2001",
      "0 @F1@ FAM",
      "1 HUSB @I1@",
      "1 WIFE @I2@",
      "1 CHIL @I3@",
      "0 TRLR",
    ].join("\n");
    const ped = ok(importGedcom(ged));
    expect(Object.values(ped.individuals).map((i) => i.label)).toContain("M.R.");
    expect(Object.values(ped.individuals).some((i) => i.name)).toBe(false);
    expect(Object.values(ped.individuals).find((i) => i.birth === "1950")).toBeTruthy();
    expect(Object.values(ped.unions)[0].children).toHaveLength(1);
  });
});

describe("rilevamento del formato", () => {
  it("riconosce i formati dal nome e dal contenuto", () => {
    const ped = threeGenerations();
    expect(importAny("x.json", exportNativeJson(ped)).ok && importAny("x.json", exportNativeJson(ped))).toMatchObject({ format: "JSON" });
    expect(importAny("x.json", exportGa4gh(ped))).toMatchObject({ format: "GA4GH" });
    expect(importAny("x.json", exportPhenopacket(ped))).toMatchObject({ format: "Phenopackets" });
    expect(importAny("x.csv", exportCsv(ped))).toMatchObject({ format: "CSV" });
    expect(importAny("x.ped", exportPed(ped))).toMatchObject({ format: "PED" });
    expect(importAny("x.json", exportFhir(ped)).ok).toBe(false);
    expect(importAny("x.txt", "ciao").ok).toBe(false);
  });
});

describe("minimizzazione ed export grafici", () => {
  it("segnala e rimuove nomi e date complete", () => {
    let ped = threeGenerations();
    ped = updateIndividual(ped, ped.proband!, { name: "Nome Cognome" });
    expect(identifyingData(ped)).toEqual({ names: 1, fullDates: 1 });
    const clean = stripIdentifying(ped);
    expect(identifyingData(clean)).toEqual({ names: 0, fullDates: 0 });
    expect(clean.individuals[clean.proband!].birth).toBe("2019");
  });

  it("SVG di export: documento XML completo, compatibilità Office senza <pattern>", () => {
    const svg = exportSvg(conditionsAndEvaluations(), true);
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).not.toContain("<pattern");
    expect(svg).not.toContain("data-gid");
  });
});
