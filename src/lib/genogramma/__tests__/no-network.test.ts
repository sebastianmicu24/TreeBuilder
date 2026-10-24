import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCatalog } from "../catalog";
import { conditionsAndEvaluations, FIXTURES, largeFamily } from "../__fixtures__";
import {
  exportCsv,
  exportFhir,
  exportGa4gh,
  exportNativeJson,
  exportPed,
  exportPhenopacket,
  exportSvg,
  importAny,
  stripIdentifying,
} from "../io";
import { layout } from "../layout";
import { addChild, addLegendCondition, addParents, addSibling, moveChild, removeIndividual } from "../model/commands";
import { sequentialIds } from "../model/create";
import { renderPedigree } from "../render/render";
import { MemoryStorage } from "../storage/adapter";
import { searchConditions } from "../vocab/conditions";
import { buildFromDoctorWizard } from "../wizard/doctor";
import { buildFromPatient, emptyAnswers } from "../wizard/patient";

/**
 * Requisito non negoziabile: i moduli dello strumento non fanno rete.
 * 1. Scansione statica dei sorgenti (librerie, componenti, pagine).
 * 2. Esecuzione dell'intero flusso puro con le API di rete sostituite da
 *    funzioni che lanciano un errore.
 */
const ROOT = join(__dirname, "..", "..", "..", "..");
const DIRS = [
  "src/lib/genogramma",
  "src/components/genogramma",
  "src/app",
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name) && !p.includes("__tests__")) out.push(p);
  }
  return out;
}

const FORBIDDEN: [RegExp, string][] = [
  [/\bfetch\s*\(/, "fetch"],
  [/XMLHttpRequest/, "XMLHttpRequest"],
  [/sendBeacon/, "navigator.sendBeacon"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bEventSource\b/, "EventSource"],
  [/["']use server["']/, "Server Action"],
  [/from\s+["']@\/lib\/supabase/, "client Supabase"],
  [/import\(\s*["']https?:/, "import remoto"],
  [/console\.(log|info|warn|error|debug)\s*\(/, "console (possibile log di dati)"],
];

// Lo strumento non usa mai l'autenticazione: nessuna eccezione.
const AUTH_ALLOWED = new Set<string>();

describe("nessuna rete: scansione statica", () => {
  const all = DIRS.flatMap((d) => files(join(ROOT, d)));

  it("trova i sorgenti dello strumento", () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it.each(all.map((f) => [relative(ROOT, f).replace(/\\/g, "/"), f]))("%s", (rel, f) => {
    const src = readFileSync(f, "utf8");
    for (const [re, what] of FORBIDDEN) {
      expect(re.test(src), `${rel} usa ${what}`).toBe(false);
    }
    if (!AUTH_ALLOWED.has(rel)) expect(/from\s+["']@\/lib\/auth["']/.test(src), `${rel} importa l'autenticazione`).toBe(false);
  });
});

describe("nessuna rete: esecuzione con le API di rete bloccate", () => {
  const saved: Record<string, unknown> = {};
  const g = globalThis as Record<string, unknown>;
  const calls: string[] = [];
  beforeAll(() => {
    for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) {
      saved[k] = g[k];
      g[k] = function blocked() {
        calls.push(k);
        throw new Error(`rete vietata: ${k}`);
      };
    }
    saved.navigator = g.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        sendBeacon: () => {
          calls.push("sendBeacon");
          throw new Error("rete vietata: sendBeacon");
        },
      },
    });
  });
  afterAll(() => {
    for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"]) g[k] = saved[k];
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: saved.navigator });
  });

  it("wizard, comandi, layout, render, export e import completi", async () => {
    const ids = sequentialIds("nn");
    let ped = buildFromDoctorWizard(
      {
        level: "great-grandparents",
        proband: { sex: "female", gender: "not-expressed" },
        siblings: { male: 2, female: 1, unknown: 0 },
        paternal: { male: 1, female: 0, unknown: 1 },
        maternal: { male: 0, female: 1, unknown: 0 },
        children: { male: 0, female: 0, unknown: 0 },
      },
      ids
    );
    ped = addSibling(ped, ped.proband!, { sex: "male" }, ids).pedigree;
    ped = addChild(ped, ped.proband!, { sex: "female" }, ids, { partner: "new" }).pedigree;
    const c = addLegendCondition(ped, searchConditions("fibrosi")[0].label, ids);
    ped = c.pedigree;
    const pat = buildFromPatient({ ...emptyAnswers(), respondent: "self" }, ids);
    for (const p of [ped, pat, conditionsAndEvaluations(), largeFamily(), ...Object.values(FIXTURES).map((f) => f())]) {
      const lay = layout(p);
      renderPedigree(p, { interactive: true }, lay);
      renderPedigree(p, { office: true });
      const outputs = [
        exportNativeJson(p),
        exportSvg(p, true),
        exportCsv(p),
        exportPed(p),
        exportGa4gh(p),
        exportPhenopacket(p),
        p.proband ? exportFhir(p) : "{}",
      ];
      for (const [name, text] of [
        ["a.json", outputs[0]],
        ["a.csv", outputs[2]],
        ["a.ped", outputs[3]],
        ["a.json", outputs[4]],
        ["a.json", outputs[5]],
      ] as const) {
        importAny(name, text);
      }
      stripIdentifying(p);
    }
    const u = Object.values(ped.unions).find((x) => x.children.length >= 2)!;
    ped = moveChild(ped, u.id, u.children[1].id, 0);
    const leaf = u.children.map((c) => c.id).find((id) => id !== ped.proband)!;
    removeIndividual(ped, leaf, false);
    const founder = Object.keys(pat.individuals).find((id) => !Object.values(pat.unions).some((x) => x.children.some((k) => k.id === id)))!;
    addParents(pat, founder, ids);
    const store = new MemoryStorage();
    await store.put({ id: "x", kind: "pedigree", title: "t", updatedAt: "", pedigree: ped }, null);
    await store.list();
    for (const s of buildCatalog()) for (const e of s.entries) renderPedigree(e.pedigree);
    expect(calls).toEqual([]);
  });
});
