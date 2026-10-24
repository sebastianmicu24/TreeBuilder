import { GEOM } from "../layout/measure";
import { fontStack, textWidth } from "../layout/font-metrics";
import type { LayoutNode } from "../layout/types";
import { innerLetter, multipleLabel, type SymbolShape } from "../model/notation";
import type { DisplaySettings, Individual, LegendCondition, Pedigree } from "../model/types";
import { fillRegion, type FillContext } from "./fills";
import { centroid, scalePolygon, sectorPolygon, shapePolygon, trianglePoints, type Pt } from "./geometry";
import { el, n, pathD, pts, type SvgNode } from "./svg-tree";

export const INK = "#111111";
export const STROKE_W = 1.5;

/** Stile di linea del portatore presintomatico per indice di condizione. */
export function presymptomaticDash(i: number): string | undefined {
  return [undefined, "4 2.5", "1.2 2.2", "7 2 1.5 2"][i % 4];
}

export function outline(shape: SymbolShape, cx: number, cy: number, s: number, attrs: Record<string, string | number>): SvgNode {
  const h = s / 2;
  if (shape === "square") return el("rect", { x: n(cx - h), y: n(cy - h), width: n(s), height: n(s), ...attrs });
  if (shape === "circle") return el("circle", { cx: n(cx), cy: n(cy), r: n(h), ...attrs });
  if (shape === "triangle") return el("polygon", { points: pts(trianglePoints(cx, cy, s)), ...attrs });
  return el("polygon", { points: pts(shapePolygon("diamond", cx, cy, s)), ...attrs });
}

interface SymbolInput {
  ped: Pedigree;
  ind: Individual;
  shape: SymbolShape;
  cx: number;
  cy: number;
  s: number;
  display: DisplaySettings;
  fill: FillContext;
  isProband: boolean;
  isConsultand: boolean;
  adopted: boolean;
  letter: string | null;
}

function legendOf(ped: Pedigree, id: string): LegendCondition | undefined {
  return ped.legend.conditions.find((c) => c.id === id);
}

/**
 * Simbolo NSGC completo: contorno, settori delle condizioni (affetto,
 * portatore come riempimento parziale, presintomatico come linea
 * verticale), lettera o numero interno, linea del decesso, parentesi
 * dell'adozione, freccia del probando/consultando, "?" e "*".
 */
export function renderSymbol(input: SymbolInput): SvgNode[] {
  const { ped, ind, shape, cx, cy, s, display, fill } = input;
  const out: SvgNode[] = [];
  const poly = shapePolygon(shape, cx, cy, s);
  const center: Pt = shape === "triangle" ? centroid(poly) : [cx, cy];

  // Sfondo bianco: il simbolo copre le linee che vi arrivano.
  out.push(outline(shape, cx, cy, s, { fill: "#ffffff", stroke: "none" }));

  const sectorConds = ind.conditions.filter((c) => c.status !== "presymptomatic");
  const count = sectorConds.length;
  sectorConds.forEach((c, i) => {
    const legend = legendOf(ped, c.conditionId);
    if (!legend) return;
    const style = { pattern: legend.pattern, color: display.color ? legend.color : INK };
    const region = sectorPolygon(poly, center, i, count);
    if (c.status === "affected") {
      out.push(...fillRegion(region, style, fill));
    } else if (c.status === "carrier" && !display.legacyCarrierDot) {
      out.push(...fillRegion(sectorPolygon(scalePolygon(poly, center, 0.45), center, i, count), style, fill));
    }
  });
  if (display.legacyCarrierDot && ind.conditions.some((c) => c.status === "carrier")) {
    out.push(el("circle", { cx: n(center[0]), cy: n(center[1]), r: n(s * 0.09), fill: INK }));
  }

  // Presintomatici: linee verticali al centro, una per condizione con stile diverso.
  const pre = ind.conditions.filter((c) => c.status === "presymptomatic");
  pre.forEach((c, i) => {
    const legend = legendOf(ped, c.conditionId);
    const legendIndex = Math.max(0, ped.legend.conditions.findIndex((l) => l.id === c.conditionId));
    const offset = (i - (pre.length - 1) / 2) * s * 0.14;
    const x = center[0] + offset;
    const top = shape === "triangle" ? poly[0][1] : edgeY(shape, cx, cy, s, x, -1);
    const bottom = shape === "triangle" ? poly[1][1] : edgeY(shape, cx, cy, s, x, 1);
    out.push(
      el("line", {
        x1: n(x),
        y1: n(top),
        x2: n(x),
        y2: n(bottom),
        stroke: display.color && legend ? legend.color : INK,
        "stroke-width": 2,
        "stroke-dasharray": presymptomaticDash(legendIndex),
      })
    );
  });

  out.push(outline(shape, cx, cy, s, { fill: "none", stroke: INK, "stroke-width": STROKE_W }));

  // Lettera (P, D, G) o numero di individui dentro il simbolo.
  const inner = input.letter ?? multipleLabel(ind);
  if (inner) {
    const fs = shape === "triangle" ? s * 0.3 : s * 0.42;
    const w = textWidth(inner, fs, display.fontFamily, true);
    const filled = ind.conditions.some((c) => c.status === "affected");
    if (filled) {
      out.push(
        el("rect", {
          x: n(center[0] - w / 2 - 2),
          y: n(center[1] - fs * 0.55),
          width: n(w + 4),
          height: n(fs * 1.1),
          fill: "#ffffff",
          stroke: "none",
          rx: 2,
        })
      );
    }
    out.push(
      el(
        "text",
        {
          x: n(center[0]),
          y: n(center[1] + fs * 0.36),
          "text-anchor": "middle",
          "font-family": fontStack(display.fontFamily),
          "font-size": n(fs),
          "font-weight": "bold",
          fill: INK,
        },
        [inner]
      )
    );
  }

  // Decesso / nato morto / TOP / ECT: diagonale che sporge oltre il simbolo.
  const outcome = ind.pregnancy?.outcome;
  // Lo SAB è un triangolo senza diagonale; TOP ed ECT la hanno.
  if ((ind.vital === "deceased" && outcome !== "SAB") || outcome === "TOP" || outcome === "ECT") {
    const r = shape === "triangle" ? ((s * GEOM.triangle) / 2) * 1.25 : s * GEOM.deathReach;
    out.push(
      el("line", {
        x1: n(center[0] - r),
        y1: n(center[1] + r),
        x2: n(center[0] + r),
        y2: n(center[1] - r),
        stroke: INK,
        "stroke-width": STROKE_W,
      })
    );
  }

  if (input.adopted) {
    const bx = s * GEOM.bracketX;
    const by = s * GEOM.bracketY;
    const lip = s * 0.12;
    const bracket = (sign: number) =>
      el("path", {
        d: pathD([
          [cx + sign * (bx - lip), cy - by],
          [cx + sign * bx, cy - by],
          [cx + sign * bx, cy + by],
          [cx + sign * (bx - lip), cy + by],
        ]),
        fill: "none",
        stroke: INK,
        "stroke-width": STROKE_W,
      });
    out.push(bracket(-1), bracket(1));
  }

  if (input.isProband || input.isConsultand) {
    const tail: Pt = [cx + s * GEOM.arrowTail[0], cy + s * GEOM.arrowTail[1]];
    const tip: Pt = [cx + s * GEOM.arrowTip[0], cy + s * GEOM.arrowTip[1]];
    const ang = Math.atan2(tip[1] - tail[1], tip[0] - tail[0]);
    const head = s * 0.16;
    const left: Pt = [tip[0] - head * Math.cos(ang - 0.45), tip[1] - head * Math.sin(ang - 0.45)];
    const right: Pt = [tip[0] - head * Math.cos(ang + 0.45), tip[1] - head * Math.sin(ang + 0.45)];
    out.push(
      el("line", { x1: n(tail[0]), y1: n(tail[1]), x2: n(tip[0]), y2: n(tip[1]), stroke: INK, "stroke-width": STROKE_W }),
      el("polygon", { points: pts([tip, left, right]), fill: INK, stroke: "none" })
    );
    if (input.isProband) {
      out.push(
        el(
          "text",
          {
            x: n(tail[0] - 2),
            y: n(tail[1] + display.fontSize * 0.35),
            "text-anchor": "end",
            "font-family": fontStack(display.fontFamily),
            "font-size": n(display.fontSize),
            "font-weight": "bold",
            fill: INK,
          },
          ["P"]
        )
      );
    }
  }

  if (ind.familyHistoryUnknown) {
    out.push(
      el(
        "text",
        {
          x: n(cx + s * 0.3),
          y: n(cy - s / 2 - 2),
          "font-family": fontStack(display.fontFamily),
          "font-size": n(display.fontSize * 1.1),
          "font-weight": "bold",
          fill: INK,
        },
        ["?"]
      )
    );
  }
  if (ind.documentedEvaluation) {
    out.push(
      el(
        "text",
        {
          x: n(cx + s / 2 + 2),
          y: n(cy + s * 0.48),
          "font-family": fontStack(display.fontFamily),
          "font-size": n(display.fontSize * 1.3),
          fill: INK,
        },
        ["*"]
      )
    );
  }
  return out;
}

/** Quota del bordo (sopra: dir −1, sotto: +1) alla x indicata. */
function edgeY(shape: SymbolShape, cx: number, cy: number, s: number, x: number, dir: -1 | 1): number {
  const d = Math.abs(x - cx);
  const h = s / 2;
  if (shape === "circle") return cy + dir * Math.sqrt(Math.max(0, h * h - d * d));
  if (shape === "diamond") return cy + dir * Math.max(0, h - d);
  return cy + dir * h;
}

export function letterFor(ind: Individual, node: LayoutNode): string | null {
  return innerLetter(ind, node.artRole);
}
