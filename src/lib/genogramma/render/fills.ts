import type { PatternId } from "../model/types";
import { bboxOf, clipSegment, pointInConvex, type Pt } from "./geometry";
import { el, n, pathD, type SvgNode } from "./svg-tree";

/**
 * Riempimenti generati da codice (nessuna immagine): pieno, tratteggi,
 * incrociato, puntini, griglia. Due modalità:
 * - "pattern": <pattern> in <defs> (vista e SVG standard, file leggero);
 * - "office": linee e punti espliciti ritagliati geometricamente sulla
 *   regione, così PowerPoint ("Converti in forma") li conserva.
 */
export interface FillStyle {
  pattern: PatternId;
  color: string;
}

export interface FillContext {
  office: boolean;
  /** Prefisso per gli id dei <pattern> (più SVG nella stessa pagina). */
  idPrefix: string;
  /** Scala dei motivi (lato del simbolo / 40). */
  scale: number;
  defs: Map<string, SvgNode>;
}

const STROKE = 1.1;

function spacing(ctx: FillContext): number {
  return Math.max(3, 4.5 * ctx.scale);
}

function safeColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#111111";
}

function patternId(ctx: FillContext, style: FillStyle): string {
  return `${ctx.idPrefix}p-${style.pattern}-${safeColor(style.color).slice(1)}`;
}

function ensureDef(ctx: FillContext, style: FillStyle): string {
  const id = patternId(ctx, style);
  if (ctx.defs.has(id)) return id;
  const w = spacing(ctx);
  const color = safeColor(style.color);
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    el("line", { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), stroke: color, "stroke-width": STROKE });
  let children: SvgNode[] = [];
  switch (style.pattern) {
    case "hatch":
      children = [line(0, w, w, 0), line(-w / 2, w / 2, w / 2, -w / 2), line(w / 2, w * 1.5, w * 1.5, w / 2)];
      break;
    case "hatch-reverse":
      children = [line(0, 0, w, w), line(-w / 2, w / 2, w / 2, w * 1.5), line(w / 2, -w / 2, w * 1.5, w / 2)];
      break;
    case "crosshatch":
      children = [line(0, w, w, 0), line(0, 0, w, w)];
      break;
    case "vertical":
      children = [line(w / 2, 0, w / 2, w)];
      break;
    case "horizontal":
      children = [line(0, w / 2, w, w / 2)];
      break;
    case "grid":
      children = [line(w / 2, 0, w / 2, w), line(0, w / 2, w, w / 2)];
      break;
    case "dots":
      children = [el("circle", { cx: n(w / 2), cy: n(w / 2), r: n(Math.max(0.8, w * 0.18)), fill: color })];
      break;
    default:
      break;
  }
  ctx.defs.set(
    id,
    el("pattern", { id, patternUnits: "userSpaceOnUse", width: n(w), height: n(w) }, [
      el("rect", { x: 0, y: 0, width: n(w), height: n(w), fill: "#ffffff" }),
      ...children,
    ])
  );
  return id;
}

/** Linee di tratteggio esplicite (modalità Office) ritagliate sulla regione. */
function hatchLines(region: Pt[], angles: number[], w: number): [Pt, Pt][] {
  const b = bboxOf(region);
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  const r = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 2 + w;
  const out: [Pt, Pt][] = [];
  for (const deg of angles) {
    const a = (deg * Math.PI) / 180;
    const dir: Pt = [Math.cos(a), -Math.sin(a)];
    const normal: Pt = [-dir[1], dir[0]];
    // Linee allineate a una griglia globale: regioni adiacenti si raccordano.
    const offset0 = Math.ceil((-r + (cx * normal[0] + cy * normal[1])) / w) * w;
    for (let o = offset0; o <= r + (cx * normal[0] + cy * normal[1]); o += w) {
      const base: Pt = [normal[0] * o, normal[1] * o];
      const t = (cx - base[0]) * dir[0] + (cy - base[1]) * dir[1];
      const mid: Pt = [base[0] + dir[0] * t, base[1] + dir[1] * t];
      const p: Pt = [mid[0] - dir[0] * r * 2, mid[1] - dir[1] * r * 2];
      const q: Pt = [mid[0] + dir[0] * r * 2, mid[1] + dir[1] * r * 2];
      const seg = clipSegment(p, q, region);
      if (seg) out.push(seg);
    }
  }
  return out;
}

const ANGLES: Partial<Record<PatternId, number[]>> = {
  hatch: [45],
  "hatch-reverse": [135],
  crosshatch: [45, 135],
  vertical: [90],
  horizontal: [0],
  grid: [0, 90],
};

/** Elementi che riempiono la regione (poligono convesso) con lo stile indicato. */
export function fillRegion(region: Pt[], style: FillStyle, ctx: FillContext): SvgNode[] {
  if (region.length < 3) return [];
  const color = safeColor(style.color);
  if (style.pattern === "solid") {
    return [el("path", { d: pathD(region, true), fill: color, stroke: "none" })];
  }
  if (!ctx.office) {
    const id = ensureDef(ctx, style);
    return [el("path", { d: pathD(region, true), fill: `url(#${id})`, stroke: "none" })];
  }
  const w = spacing(ctx);
  if (style.pattern === "dots") {
    const b = bboxOf(region);
    const dots: SvgNode[] = [];
    const rr = Math.max(0.8, w * 0.18);
    for (let y = Math.ceil(b.y1 / w) * w + w / 2; y < b.y2; y += w) {
      for (let x = Math.ceil(b.x1 / w) * w + w / 2; x < b.x2; x += w) {
        if (pointInConvex([x, y], region)) dots.push(el("circle", { cx: n(x), cy: n(y), r: n(rr), fill: color }));
      }
    }
    return dots;
  }
  const segs = hatchLines(region, ANGLES[style.pattern] ?? [45], w);
  if (segs.length === 0) return [];
  const d = segs.map(([p, q]) => `M${n(p[0])} ${n(p[1])}L${n(q[0])} ${n(q[1])}`).join("");
  return [el("path", { d, fill: "none", stroke: color, "stroke-width": STROKE })];
}
