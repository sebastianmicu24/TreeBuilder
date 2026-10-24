import { describe, expect, it } from "vitest";
import { sibshipOfSix, threeGenerations } from "../__fixtures__";
import { findOverlaps, layout } from "../layout";
import { dragInfo, dropIndex, modelIndex, nearestInDirection } from "../layout/interaction";
import { moveChild } from "../model/commands";
import { sequentialIds } from "../model/create";
import { getRelationToProband, getSiblings } from "../model/queries";
import { orderChildren } from "../model/sibling-order";
import { hasErrors, validate } from "../model/validate";
import { searchConditions, CONDITION_VOCAB } from "../vocab/conditions";
import { buildFromDoctorWizard } from "../wizard/doctor";

describe("wizard medico", () => {
  it("genera l'albero richiesto, valido e senza sovrapposizioni", () => {
    const ped = buildFromDoctorWizard(
      {
        level: "great-grandparents",
        proband: { sex: "female", gender: "not-expressed" },
        siblings: { male: 2, female: 1, unknown: 0 },
        paternal: { male: 1, female: 1, unknown: 0 },
        maternal: { male: 0, female: 2, unknown: 1 },
        children: { male: 1, female: 0, unknown: 0 },
      },
      sequentialIds("w"),
      new Date("2026-01-15T00:00:00Z")
    );
    // probando + 2 genitori + 3 fratelli + 4 nonni + 8 bisnonni + 5 zii + figlio + partner
    expect(Object.keys(ped.individuals)).toHaveLength(25);
    expect(hasErrors(validate(ped))).toBe(false);
    expect(findOverlaps(layout(ped))).toEqual([]);
    const rels = Object.keys(ped.individuals).map((id) => getRelationToProband(ped, id));
    expect(rels.filter((r) => r.startsWith("zi") && r.endsWith("paterna"))).toHaveLength(1);
    expect(rels.filter((r) => r.startsWith("bisnonn"))).toHaveLength(8);
    expect(getSiblings(ped, ped.proband!).full).toHaveLength(3);
  });

  it("con i soli genitori non crea i nonni, salvo zii richiesti", () => {
    const base = {
      proband: { sex: "male" as const, gender: "not-expressed" as const },
      siblings: { male: 0, female: 0, unknown: 0 },
      paternal: { male: 0, female: 0, unknown: 0 },
      maternal: { male: 0, female: 0, unknown: 0 },
      children: { male: 0, female: 0, unknown: 0 },
    };
    expect(Object.keys(buildFromDoctorWizard({ ...base, level: "parents" }, sequentialIds("a")).individuals)).toHaveLength(3);
    const withUncle = buildFromDoctorWizard({ ...base, level: "parents", maternal: { male: 1, female: 0, unknown: 0 } }, sequentialIds("b"));
    expect(Object.keys(withUncle.individuals)).toHaveLength(8);
  });
});

describe("vocabolario locale", () => {
  it("cerca per nome, sinonimo e codice senza accenti", () => {
    expect(searchConditions("fibrosi")[0].label).toBe("Fibrosi cistica");
    expect(searchConditions("FC")[0].label).toBe("Fibrosi cistica");
    expect(searchConditions("ORPHA:870")[0].label).toMatch(/Down/);
    expect(searchConditions("atassia")[0].label).toMatch(/Friedreich/);
    expect(searchConditions("x")).toEqual([]);
  });

  it("ha codici nel formato atteso", () => {
    for (const e of CONDITION_VOCAB) {
      for (const c of e.codes) {
        if (c.system === "HPO") expect(c.code).toMatch(/^HP:\d{7}$/);
        if (c.system === "ORPHA" || c.system === "OMIM") expect(c.code).toMatch(/^\d+$/);
        if (c.system === "ICD10") expect(c.code).toMatch(/^[A-Z]\d{2}(\.\d)?$/);
      }
    }
  });
});

describe("interazione col disegno", () => {
  it("trascinamento: indice di rilascio e ordine del modello", () => {
    const ped = sibshipOfSix();
    const lay = layout(ped);
    const u = Object.values(ped.unions)[0];
    const order = orderChildren(ped, u);
    const dragged = order[4];
    const info = dragInfo(ped, lay, dragged);
    expect(info.ok).toBe(true);
    if (!info.ok) return;
    const firstX = lay.byId.get(info.siblings[0])!.x;
    const idx = dropIndex(lay, info.siblings, dragged, firstX - 10);
    expect(idx).toBe(0);
    const moved = moveChild(ped, u.id, dragged, modelIndex(ped, u.id, info.siblings, dragged, idx));
    expect(orderChildren(moved, moved.unions[u.id])[0]).toBe(dragged);
  });

  it("il connettore con la famiglia del partner disegnata è bloccato", () => {
    const ped = threeGenerations();
    const lay = layout(ped);
    const father = Object.values(ped.individuals).find((i) => i.label === "tg13")!.id;
    const info = dragInfo(ped, lay, father);
    expect(info.ok).toBe(false);
  });

  it("navigazione da tastiera tra generazioni e nella riga", () => {
    const ped = threeGenerations();
    const lay = layout(ped);
    const up = nearestInDirection(lay, ped.proband!, "up");
    expect(["padre", "madre"]).toContain(getRelationToProband(ped, up!));
    // Il genitore ha l'altro genitore accanto, da un lato o dall'altro.
    const side = nearestInDirection(lay, up!, "right") ?? nearestInDirection(lay, up!, "left");
    expect(["padre", "madre"]).toContain(getRelationToProband(ped, side!));
    expect(nearestInDirection(lay, ped.proband!, "down")).toBeNull();
  });
});
