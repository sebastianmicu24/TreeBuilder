import { describe, expect, it } from "vitest";
import {
  artScenarios,
  conditionsAndEvaluations,
  FIXTURES,
  largeFamily,
  sibshipOfSix,
  singleParent,
  threeGenerations,
  twoPartners,
} from "../__fixtures__";
import { PedigreeBuilder } from "../__fixtures__/builder";
import { addChild, addPartner, moveChild, updateDisplay, updateIndividual } from "../model/commands";
import { sequentialIds } from "../model/create";
import { isFemaleLike, isMaleLike } from "../model/queries";
import { orderChildren } from "../model/sibling-order";
import type { Pedigree } from "../model/types";
import { findOverlaps, layout, type Layout } from "../layout";
import { textWidth } from "../layout/font-metrics";

const ALL: Record<string, () => Pedigree> = { ...FIXTURES, largeFamily: () => largeFamily() };

function rowOrder(l: Layout, row: number): string[] {
  return l.nodes
    .filter((n) => n.row === row)
    .sort((a, b) => a.x - b.x)
    .map((n) => n.id);
}

describe("layout: nessuna sovrapposizione", () => {
  it.each(Object.entries(ALL))("%s", (_name, make) => {
    const l = layout(make());
    expect(findOverlaps(l)).toEqual([]);
  });

  it("anche con tutte le etichette attive e testi lunghi", () => {
    let ped = conditionsAndEvaluations();
    ped = updateDisplay(ped, { showNotes: true, showLabel: true, showConditions: true, showEvaluations: true });
    const l = layout(ped);
    expect(findOverlaps(l)).toEqual([]);
    for (const n of l.nodes) {
      for (const line of n.label.lines) {
        expect(textWidth(line.text, ped.display.fontSize, ped.display.fontFamily)).toBeLessThanOrEqual(
          ped.display.labelMaxWidth + 0.01
        );
      }
    }
  });
});

describe("layout: coppie", () => {
  it.each(Object.entries(ALL))("%s: partner adiacenti, uomo a sinistra", (_name, make) => {
    const ped = make();
    const l = layout(ped);
    const unionCount = (id: string) => Object.values(ped.unions).filter((u) => u.partners.includes(id)).length;
    for (const u of Object.values(ped.unions)) {
      if (u.partners.length !== 2) continue;
      const [a, b] = u.partners.map((p) => l.byId.get(p)!);
      if (!a || !b) continue;
      expect(a.row).toBe(b.row);
      const multi = unionCount(a.id) > 2 || unionCount(b.id) > 2;
      if (!multi) {
        const order = rowOrder(l, a.row);
        const gap = Math.abs(order.indexOf(a.id) - order.indexOf(b.id));
        // Le unioni multiple mettono un partner per lato: adiacenti comunque.
        expect(gap).toBe(1);
      }
      const single = unionCount(a.id) === 1 && unionCount(b.id) === 1;
      const ia = ped.individuals[a.id];
      const ib = ped.individuals[b.id];
      if (single && isMaleLike(ia) && isFemaleLike(ib)) expect(a.x).toBeLessThan(b.x);
      if (single && isFemaleLike(ia) && isMaleLike(ib)) expect(b.x).toBeLessThan(a.x);
    }
  });

  it("di default segue la NSGC 2022 (nessun lato prescritto); 'uomo a sinistra' è facoltativo", () => {
    const b = new PedigreeBuilder("ml");
    const w = b.woman({ birth: "1980" });
    const m = b.man({ birth: "1979" });
    const k = b.girl({ birth: "2010" });
    b.union([w, m], [k]);
    let ped = b.build(k);
    expect(ped.display.maleLeft).toBe(false);
    expect(layout(ped).byId.get(w)!.x).toBeLessThan(layout(ped).byId.get(m)!.x);
    ped = updateDisplay(ped, { maleLeft: true });
    expect(layout(ped).byId.get(m)!.x).toBeLessThan(layout(ped).byId.get(w)!.x);
  });

  it("linee dritte: il connettore sta sotto la discendenza dei genitori", () => {
    const ped = threeGenerations();
    const lay = layout(ped);
    for (const u of Object.values(ped.unions)) {
      if (u.children.length !== 1) continue;
      const desc = lay.lines.find((l) => l.kind === "descent" && l.unionId === u.id);
      const child = lay.byId.get(u.children[0].id)!;
      if (desc) expect(Math.abs(desc.points[0][0] - child.x)).toBeLessThan(0.6);
    }
    expect(lay.lines.filter((l) => l.kind === "sibship")).toHaveLength(0);
    const off = layout(updateDisplay(ped, { straightLines: false }));
    expect(off.lines.filter((l) => l.kind === "sibship").length).toBeGreaterThan(0);
    expect(findOverlaps(lay)).toEqual([]);
  });

  it("uomo con due partner al centro, un partner per lato; mezzi fratelli da entrambi i lati", () => {
    const ped = twoPartners();
    const l = layout(ped);
    const x = (label: string) => l.byId.get(Object.values(ped.individuals).find((i) => i.label === label)!.id)!.x;
    // tp1 ex moglie, tp2 padre, tp3 madre, tp4 ex marito della madre.
    expect(x("tp1")).toBeLessThan(x("tp2"));
    expect(x("tp2")).toBeLessThan(x("tp3"));
    expect(x("tp3")).toBeLessThan(x("tp4"));
    expect(x("tp5")).toBeLessThan(x("tp7"));
    expect(x("tp6")).toBeGreaterThan(x("tp8"));
  });

  it("fino a quattro unioni senza sovrapposizioni; oltre, avviso", () => {
    const make = (n: number) => {
      const b = new PedigreeBuilder(`mu${n}`);
      const center = b.man({ birth: "1950" });
      for (let i = 0; i < n; i++) {
        const p = b.woman({ birth: String(1952 + i) });
        const kid = b.person({ sex: i % 2 ? "male" : "female", birth: String(1975 + i * 3) });
        b.union([center, p], [kid], { status: i < n - 1 ? "ended" : "current" });
      }
      return b.build(center);
    };
    for (const n of [3, 4]) {
      const l = layout(make(n));
      expect(findOverlaps(l)).toEqual([]);
      expect(l.warnings.some((w) => w.includes("semplificata"))).toBe(false);
    }
    expect(layout(make(5)).warnings.some((w) => w.includes("semplificata"))).toBe(true);
  });
});

describe("layout: fratrie", () => {
  it.each(Object.entries(ALL))("%s: fratelli in ordine di nascita (mai per sesso)", (_name, make) => {
    const ped = make();
    const l = layout(ped);
    for (const u of Object.values(ped.unions)) {
      const expected = orderChildren(ped, u).filter((id) => {
        // Il connettore (chi sposa una persona con i genitori disegnati) sta all'estremità interna.
        const connector = Object.values(ped.unions).some(
          (v) =>
            v.partners.includes(id) &&
            v.partners.some(
              (p) => p !== id && Object.values(ped.unions).some((w) => w.children.some((c) => c.id === p))
            )
        );
        return !connector && l.byId.get(id) && l.byId.get(id)!.row === (l.byId.get(u.partners[0])?.row ?? -2) + 1;
      });
      const actual = [...expected].sort((a, b) => l.byId.get(a)!.x - l.byId.get(b)!.x);
      expect(actual).toEqual(expected);
    }
  });

  it("il drag riordina il fratello e ne porta con sé partner e discendenti", () => {
    const ids = sequentialIds("dr");
    let ped = sibshipOfSix();
    const u = Object.values(ped.unions)[0];
    const order = orderChildren(ped, u);
    const mover = order[4];
    const p = addPartner(ped, mover, { birth: "2000" }, ids);
    ped = p.pedigree;
    const k = addChild(ped, mover, { sex: "female", birth: "2024" }, ids, { partner: p.created[0] });
    ped = k.pedigree;
    const before = layout(ped);
    const moved = moveChild(ped, u.id, mover, 0);
    const after = layout(moved);
    expect(findOverlaps(after)).toEqual([]);
    const row = after.byId.get(mover)!.row;
    expect(rowOrder(after, row)[0] === mover || rowOrder(after, row)[1] === mover).toBe(true);
    // Partner adiacente e figlio sotto la coppia, come prima.
    const partnerGap = (l: Layout) => Math.abs(l.byId.get(mover)!.x - l.byId.get(p.created[0])!.x);
    expect(partnerGap(after)).toBeCloseTo(partnerGap(before), 5);
    const childOffset = (l: Layout) => l.byId.get(k.created[0])!.x - l.byId.get(mover)!.x;
    expect(childOffset(after)).toBeCloseTo(childOffset(before), 5);
  });
});

describe("layout: lati paterno e materno", () => {
  it("antenati paterni a sinistra, materni a destra, a ogni generazione", () => {
    const ped = threeGenerations();
    const l = layout(ped);
    const x = (label: string) => l.byId.get(Object.values(ped.individuals).find((i) => i.label === label)!.id)!.x;
    const rows = [
      [["tg1", "tg2", "tg3", "tg4"], ["tg5", "tg6", "tg7", "tg8"]],
      [["tg9", "tg10"], ["tg11", "tg12"]],
      [["tg13"], ["tg14"]],
    ];
    for (const [paternal, maternal] of rows) {
      expect(Math.max(...paternal.map(x))).toBeLessThan(Math.min(...maternal.map(x)));
    }
    // Bisnonni nell'ordine dei rispettivi figli.
    expect(x("tg2")).toBeLessThan(x("tg3"));
    expect(x("tg6")).toBeLessThan(x("tg7"));
  });
});

describe("layout: numerazione e generazioni", () => {
  it("numeri romani per le generazioni, arabi da sinistra a destra", () => {
    const ped = threeGenerations();
    const l = layout(ped);
    expect(l.rows.map((r) => r.label)).toEqual(["I", "II", "III", "IV"]);
    const row0 = rowOrder(l, 0).map((id) => l.numbering[id]);
    expect(row0).toEqual(["I-1", "I-2", "I-3", "I-4", "I-5", "I-6", "I-7", "I-8"]);
    expect(l.numbering[ped.proband!]).toBe("IV-1");
  });
});

describe("layout: determinismo e prestazioni", () => {
  it.each(Object.entries(ALL))("%s: stesso input, stesso output", (_name, make) => {
    const a = layout(make());
    const b = layout(make());
    expect(a.nodes.map((n) => [n.id, n.x, n.y])).toEqual(b.nodes.map((n) => [n.id, n.x, n.y]));
    expect(a.lines).toEqual(b.lines);
  });

  it("famiglia di 160 individui in tempi interattivi", () => {
    const ped = largeFamily();
    layout(ped);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) layout(ped);
    expect((performance.now() - t0) / 5).toBeLessThan(150);
  });
});

describe("layout: casi particolari", () => {
  it("cambio di sesso e genere: simbolo e posizione si ricalcolano senza rompere le unioni", () => {
    const ped = twoPartners();
    const father = Object.values(ped.individuals).find((i) => i.label === "tp2")!.id;
    const next = updateIndividual(ped, father, { sex: "female", gender: "woman" });
    const l = layout(next);
    expect(l.byId.get(father)!.shape).toBe("circle");
    expect(findOverlaps(l)).toEqual([]);
    expect(l.lines.filter((x) => x.kind === "relationship" && x.ids.includes(father))).toHaveLength(2);
  });

  it("figlio di un genitore senza partner: linea dal singolo", () => {
    const ped = singleParent();
    const l = layout(ped);
    const mother = Object.values(ped.unions).find((u) => u.partners.length === 1)!;
    const m = l.byId.get(mother.partners[0])!;
    const descent = l.lines.find((x) => x.kind === "descent" && x.unionId === mother.id)!;
    expect(descent.points[0][0]).toBeCloseTo(m.x);
    expect(m.labelsRight).toBe(true);
  });

  it("ART: nessuna linea di relazione con il donatore; gravidanza sotto la gestante", () => {
    for (const s of artScenarios()) {
      const ped = s.pedigree;
      const l = layout(ped);
      expect(findOverlaps(l)).toEqual([]);
      for (const u of Object.values(ped.unions)) {
        for (const c of u.children) {
          const donors = [c.art?.eggFrom, c.art?.spermFrom].filter((d) => d && !u.partners.includes(d));
          for (const d of donors) {
            expect(l.lines.some((x) => x.kind === "relationship" && x.ids.includes(d!))).toBe(false);
          }
          const carrier = c.art?.carriedBy;
          if (carrier && !u.partners.includes(carrier)) {
            expect(Math.abs(l.byId.get(c.id)!.x - l.byId.get(carrier)!.x)).toBeLessThan(
              ped.display.symbolSize * 2.5
            );
          }
        }
      }
    }
    const surrogate = artScenarios().find((s) => s.key === "surrogate")!.pedigree;
    const ls = layout(surrogate);
    const sid = Object.values(surrogate.individuals).find((i) => i.label === "a93")!.id;
    expect(ls.byId.get(sid)!.artRole).toBe("surrogate");
    const donorLines = ls.lines.filter((x) => x.kind === "donor");
    expect(donorLines).toHaveLength(0);
    const hetero = layout(artScenarios().find((s) => s.key === "sperm-hetero")!.pedigree);
    expect(hetero.lines.filter((x) => x.kind === "donor")).toHaveLength(1);
  });

  it("i partner precedenti senza figli si possono nascondere senza cancellare i dati", () => {
    const b = new PedigreeBuilder("hp");
    const m = b.man({ birth: "1960" });
    const ex = b.woman({ birth: "1962" });
    const w = b.woman({ birth: "1965" });
    const k = b.boy({ birth: "2000" });
    b.union([m, ex], [], { status: "ended" });
    b.union([m, w], [k]);
    let ped = b.build(k);
    expect(layout(ped).byId.has(ex)).toBe(true);
    ped = updateDisplay(ped, { hidePriorPartners: true });
    expect(layout(ped).byId.has(ex)).toBe(false);
    expect(ped.individuals[ex]).toBeDefined();
  });
});
