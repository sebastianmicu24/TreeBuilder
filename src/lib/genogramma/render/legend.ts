import { t, type Lang } from "../i18n";
import { fontStack, textWidth, wrapText } from "../layout/font-metrics";
import { GEOM } from "../layout/measure";
import type { Layout } from "../layout/types";
import { sexAnnotation, type SymbolShape } from "../model/notation";
import type { DisplaySettings, Individual, Pedigree } from "../model/types";
import { fillRegion, type FillContext } from "./fills";
import { scalePolygon, shapePolygon } from "./geometry";
import { el, n, type SvgNode } from "./svg-tree";
import { INK, outline, presymptomaticDash, STROKE_W } from "./symbols";

/**
 * Legenda obbligatoria, generata dal modello: ogni riempimento e motivo,
 * le valutazioni E1…En, le sigle e i simboli effettivamente usati nel
 * disegno. Nessuna voce è letta dal DOM: vista ed export coincidono.
 */
type Icon = (x: number, y: number, size: number) => SvgNode[];

interface Entry {
  icon: Icon;
  text: string;
}

const ICON = 16;

function square(fn?: (x: number, y: number, s: number) => SvgNode[]): Icon {
  return (x, y, s) => [
    outline("square", x, y, s, { fill: "#ffffff", stroke: "none" }),
    ...(fn ? fn(x, y, s) : []),
    outline("square", x, y, s, { fill: "none", stroke: INK, "stroke-width": STROKE_W }),
  ];
}

function textIcon(label: string, display: DisplaySettings): Icon {
  return (x, y) => [
    el(
      "text",
      {
        x: n(x),
        y: n(y + display.fontSize * 0.35),
        "text-anchor": "middle",
        "font-family": fontStack(display.fontFamily),
        "font-size": n(display.fontSize),
        "font-weight": "bold",
        fill: INK,
      },
      [label]
    ),
  ];
}

function shapeIcon(shape: SymbolShape, extra?: (x: number, y: number, s: number) => SvgNode[]): Icon {
  return (x, y, s) => [
    outline(shape, x, y, s, { fill: "#ffffff", stroke: INK, "stroke-width": STROKE_W }),
    ...(extra ? extra(x, y, s) : []),
  ];
}

const line = (x1: number, y1: number, x2: number, y2: number, dash?: string): SvgNode =>
  el("line", { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke: INK, "stroke-width": STROKE_W, "stroke-dasharray": dash });

/** Codice nella forma abituale: HP:0001639, ORPHA:586, OMIM:143100, ICD-10 C50, ICD-11 LD40.0. */
export function formatCode(c: { system: string; code: string }): string {
  const bare = c.code.trim().replace(/^(HPO?|ORPHA|OMIM|ICD-?1[01]):?\s*/i, "");
  switch (c.system) {
    case "HPO":
      return `HP:${bare}`;
    case "ORPHA":
      return `ORPHA:${bare}`;
    case "OMIM":
      return `OMIM:${bare}`;
    case "ICD10":
      return `ICD-10 ${bare}`;
    case "ICD11":
      return `ICD-11 ${bare}`;
    default:
      return bare;
  }
}

export function legendEntries(ped: Pedigree, lay: Layout, fill: FillContext): Entry[] {
  const display = ped.display;
  const lang: Lang = display.language;
  const out: Entry[] = [];
  const inds = lay.nodes.map((nd) => ped.individuals[nd.id]);
  const any = (pred: (i: Individual) => boolean) => inds.some(pred);

  ped.legend.conditions.forEach((c, index) => {
    const style = { pattern: c.pattern, color: display.color ? c.color : INK };
    const codes = c.codes.map(formatCode).join(", ");
    const label = codes ? `${c.label} (${codes})` : c.label;
    out.push({
      icon: square((x, y, s) => fillRegion(shapePolygon("square", x, y, s), style, fill)),
      text: `${label}: ${t(lang, "affected")}`,
    });
    if (any((i) => i.conditions.some((k) => k.conditionId === c.id && k.status === "carrier"))) {
      out.push({
        icon: square((x, y, s) =>
          display.legacyCarrierDot
            ? [el("circle", { cx: n(x), cy: n(y), r: n(s * 0.12), fill: INK })]
            : fillRegion(scalePolygon(shapePolygon("square", x, y, s), [x, y], 0.45), style, fill)
        ),
        text: `${c.label}: ${t(lang, "carrier")}`,
      });
    }
    if (any((i) => i.conditions.some((k) => k.conditionId === c.id && k.status === "presymptomatic"))) {
      out.push({
        icon: square((x, y, s) => [
          el("line", {
            x1: n(x),
            y1: n(y - s / 2),
            x2: n(x),
            y2: n(y + s / 2),
            stroke: display.color ? c.color : INK,
            "stroke-width": 2,
            "stroke-dasharray": presymptomaticDash(index),
          }),
        ]),
        text: `${c.label}: ${t(lang, "presymptomatic")}`,
      });
    }
  });

  const evals = ped.legend.evaluations;
  if (any((i) => i.evaluations.length > 0)) {
    if (evals.length > 1) {
      evals.forEach((e, i) => out.push({ icon: textIcon(`E${i + 1}`, display), text: e.label || t(lang, "evaluationGeneric") }));
    } else {
      out.push({ icon: textIcon("E", display), text: evals[0]?.label || t(lang, "evaluationGeneric") });
    }
    out.push({ icon: textIcon("±", display), text: t(lang, "results") });
  }
  if (any((i) => !!i.documentedEvaluation)) out.push({ icon: textIcon("*", display), text: t(lang, "documented") });

  if (any((i) => i.vital === "deceased" && !i.pregnancy)) {
    out.push({ icon: square((x, y, s) => [line(x - s * 0.65, y + s * 0.65, x + s * 0.65, y - s * 0.65)]), text: t(lang, "deceased") });
  }
  const outcomes = new Set(inds.map((i) => i.pregnancy?.outcome).filter(Boolean));
  if (outcomes.has("ongoing")) out.push({ icon: shapeIcon("diamond", (x, y, s) => textIcon("P", display)(x, y, s)), text: `P: ${t(lang, "pregnancy")}` });
  if (outcomes.has("SB")) {
    out.push({ icon: square((x, y, s) => [line(x - s * 0.65, y + s * 0.65, x + s * 0.65, y - s * 0.65)]), text: `SB: ${t(lang, "sb")}` });
  }
  const tri = (diag: boolean): Icon => (x, y, s) => {
    const big = s / GEOM.triangle;
    const yc = y + big / 2 - (s * 0.9) / 2;
    const nodes = [outline("triangle", x, yc, big, { fill: "#ffffff", stroke: INK, "stroke-width": STROKE_W })];
    if (diag) nodes.push(line(x - s * 0.55, y + s * 0.5, x + s * 0.55, y - s * 0.5));
    return nodes;
  };
  if (outcomes.has("SAB")) out.push({ icon: tri(false), text: `SAB: ${t(lang, "sab")}` });
  if (outcomes.has("TOP")) out.push({ icon: tri(true), text: `TOP: ${t(lang, "top")}` });
  if (outcomes.has("ECT")) out.push({ icon: tri(true), text: `ECT: ${t(lang, "ect")}` });

  const roles = new Set(lay.nodes.map((nd) => nd.artRole).filter(Boolean));
  if (roles.has("donor")) out.push({ icon: shapeIcon("diamond", (x, y, s) => textIcon("D", display)(x, y, s)), text: `D: ${t(lang, "donor")}` });
  if (roles.has("surrogate")) out.push({ icon: shapeIcon("circle", (x, y, s) => textIcon("D", display)(x, y, s)), text: `D: ${t(lang, "surrogate")}` });
  if (roles.has("gestationalCarrier")) {
    out.push({ icon: shapeIcon("circle", (x, y, s) => textIcon("G", display)(x, y, s)), text: `G: ${t(lang, "gestationalCarrier")}` });
  }

  if (lay.nodes.some((nd) => nd.adopted)) {
    out.push({
      icon: (x, y, s) => [
        outline("square", x, y, s * 0.75, { fill: "#ffffff", stroke: INK, "stroke-width": STROKE_W }),
        el("path", { d: `M${n(x - s * 0.45)} ${n(y - s * 0.55)}H${n(x - s * 0.6)}V${n(y + s * 0.55)}H${n(x - s * 0.45)}`, fill: "none", stroke: INK, "stroke-width": STROKE_W }),
        el("path", { d: `M${n(x + s * 0.45)} ${n(y - s * 0.55)}H${n(x + s * 0.6)}V${n(y + s * 0.55)}H${n(x + s * 0.45)}`, fill: "none", stroke: INK, "stroke-width": STROKE_W }),
      ],
      text: t(lang, "adopted"),
    });
  }

  const zyg = new Set(inds.map((i) => i.twin?.zygosity).filter(Boolean));
  const twinIcon = (kind: "MZ" | "DZ" | "unknown"): Icon => (x, y, s) => {
    const nodes = [line(x, y - s / 2, x - s / 2, y + s / 2), line(x, y - s / 2, x + s / 2, y + s / 2)];
    if (kind === "MZ") nodes.push(line(x - s / 4, y, x + s / 4, y));
    if (kind === "unknown") nodes.push(...textIcon("?", display)(x, y + 3, s));
    return nodes;
  };
  if (zyg.has("MZ")) out.push({ icon: twinIcon("MZ"), text: t(lang, "mz") });
  if (zyg.has("DZ")) out.push({ icon: twinIcon("DZ"), text: t(lang, "dz") });
  if (zyg.has("unknown")) out.push({ icon: twinIcon("unknown"), text: t(lang, "twinUnknown") });

  const unions = Object.values(ped.unions);
  if (unions.some((u) => u.consanguinity)) {
    out.push({ icon: (x, y, s) => [line(x - s / 2, y - 2, x + s / 2, y - 2), line(x - s / 2, y + 2, x + s / 2, y + 2)], text: t(lang, "consanguinity") });
  }
  if (unions.some((u) => u.status === "ended" && u.partners.length === 2)) {
    out.push({
      icon: (x, y, s) => [line(x - s / 2, y, x + s / 2, y), line(x - 5, y + 4, x - 1, y - 4), line(x + 1, y + 4, x + 5, y - 4)],
      text: t(lang, "ended"),
    });
  }
  const noKids = [...unions.map((u) => u.noChildren), ...inds.map((i) => i.noChildren)].filter(Boolean);
  const bars = (k: number): Icon => (x, y, s) => {
    const nodes = [line(x, y - s / 2, x, y + s * 0.2)];
    for (let i = 0; i < k; i++) nodes.push(line(x - s * 0.3, y + s * 0.2 - i * 4, x + s * 0.3, y + s * 0.2 - i * 4));
    return nodes;
  };
  if (noKids.some((x) => x!.kind === "by-choice")) out.push({ icon: bars(1), text: t(lang, "noChildren") });
  if (noKids.some((x) => x!.kind === "infertility")) out.push({ icon: bars(2), text: t(lang, "infertility") });

  const arrow = (withP: boolean): Icon => (x, y, s) => {
    const nodes = [line(x - s * 0.45, y + s * 0.4, x + s * 0.25, y - s * 0.3)];
    nodes.push(el("polygon", { points: `${n(x + s * 0.35)},${n(y - s * 0.4)} ${n(x + s * 0.05)},${n(y - s * 0.28)} ${n(x + s * 0.23)},${n(y - s * 0.1)}`, fill: INK }));
    if (withP) nodes.push(...textIcon("P", display)(x - s * 0.55, y + s * 0.35, s));
    return nodes;
  };
  if (ped.proband && lay.byId.has(ped.proband)) out.push({ icon: arrow(true), text: t(lang, "proband") });
  if (ped.consultands.some((c) => lay.byId.has(c))) out.push({ icon: arrow(false), text: t(lang, "consultand") });
  if (any((i) => !!i.familyHistoryUnknown)) out.push({ icon: textIcon("?", display), text: t(lang, "familyHistoryUnknown") });

  const sexes = new Set(inds.map(sexAnnotation).filter(Boolean));
  if (sexes.has("AMAB")) out.push({ icon: textIcon("AMAB", display), text: t(lang, "amab") });
  if (sexes.has("AFAB")) out.push({ icon: textIcon("AFAB", display), text: t(lang, "afab") });
  if (sexes.has("UAAB")) out.push({ icon: textIcon("UAAB", display), text: t(lang, "uaab") });
  if (any((i) => i.multiple !== undefined)) out.push({ icon: shapeIcon("diamond", (x, y, s) => textIcon("n", display)(x, y, s)), text: t(lang, "multiple") });
  const units = /\d(y| mo| wk| d)/;
  if (lay.nodes.some((nd) => nd.label.lines.some((l) => units.test(l.text)))) {
    out.push({ icon: textIcon("y", display), text: t(lang, "ageUnits") });
  }
  return out;
}

/** Blocco della legenda alla larghezza indicata (colonne), coordinate locali da (0,0). */
export function renderLegend(
  ped: Pedigree,
  lay: Layout,
  fill: FillContext,
  width: number
): { node: SvgNode; height: number; width: number } {
  const display = ped.display;
  const lang = display.language;
  const fs = display.fontSize;
  const lh = fs * 1.3;
  const colW = 250;
  const iconW = 44;
  const cols = Math.max(1, Math.floor(Math.max(width, colW) / colW));
  const entries = legendEntries(ped, lay, fill);
  const blocks = entries.map((e) => ({ e, lines: wrapText(e.text, colW - iconW - 10, fs, display.fontFamily) }));
  const heights = blocks.map((b) => Math.max(ICON + 6, b.lines.length * lh + 6));
  const total = heights.reduce((a, b) => a + b, 0);
  const perCol = total / cols;
  const children: SvgNode[] = [
    el(
      "text",
      { x: 0, y: n(fs), "font-family": fontStack(display.fontFamily), "font-size": n(fs * 1.1), "font-weight": "bold", fill: INK },
      [t(lang, "legend")]
    ),
  ];
  let col = 0;
  let y = fs * 1.9;
  let used = 0;
  let maxY = y;
  blocks.forEach((b, i) => {
    if (used > perCol && col < cols - 1) {
      col += 1;
      y = fs * 1.9;
      used = 0;
    }
    const x = col * colW;
    const cy = y + heights[i] / 2 - 3;
    children.push(el("g", {}, b.e.icon(x + iconW / 2, cy, ICON)));
    b.lines.forEach((text, k) => {
      children.push(
        el(
          "text",
          {
            x: n(x + iconW),
            y: n(cy - ((b.lines.length - 1) * lh) / 2 + k * lh + fs * 0.35),
            "font-family": fontStack(display.fontFamily),
            "font-size": n(fs),
            fill: INK,
          },
          [text]
        )
      );
    });
    y += heights[i];
    used += heights[i];
    maxY = Math.max(maxY, y);
  });
  const hasCouple = Object.values(ped.unions).some((u) => u.partners.length === 2);
  if (display.maleLeft && hasCouple) {
    const lines = wrapText(t(lang, "convention"), cols * colW - 10, fs * 0.9, display.fontFamily);
    lines.forEach((text, k) => {
      children.push(
        el(
          "text",
          { x: 0, y: n(maxY + fs + k * lh), "font-family": fontStack(display.fontFamily), "font-size": n(fs * 0.9), fill: "#444444" },
          [text]
        )
      );
    });
    maxY += fs + lines.length * lh;
  }
  const w = Math.max(cols * colW, textWidth(t(lang, "legend"), fs * 1.1, display.fontFamily));
  return { node: el("g", {}, children), height: maxY, width: w };
}
