import { t } from "../i18n";
import { layout as computeLayout } from "../layout";
import { fontStack, wrapText } from "../layout/font-metrics";
import type { Layout, LayoutLine } from "../layout/types";
import { formatDateValue } from "../model/age";
import { getRelationToProband } from "../model/queries";
import type { Pedigree } from "../model/types";
import type { FillContext } from "./fills";
import { renderLegend } from "./legend";
import { el, n, pathD, type SvgNode } from "./svg-tree";
import { INK, letterFor, renderSymbol, STROKE_W } from "./symbols";

/**
 * Renderer puro: genogramma → albero SVG. Lo stesso albero serve alla vista
 * interattiva e all'export (ciò che si vede è ciò che si esporta). Solo
 * attributi di presentazione inline, font sicuri, nessun foreignObject,
 * nessuna risorsa esterna; legenda e metadati inclusi nel disegno.
 */
export interface RenderOptions {
  /** Tratteggi come linee esplicite (PowerPoint, "Converti in forma"). */
  office?: boolean;
  /** Attributi per la vista interattiva (data-gid, ARIA). Mai negli export. */
  interactive?: boolean;
  /** Prefisso degli id interni (più SVG nella stessa pagina). */
  idPrefix?: string;
  legend?: boolean;
  metadata?: boolean;
  margin?: number;
  /** Larghezza minima del disegno (es. per la legenda nella pagina-catalogo). */
  minWidth?: number;
}

export interface Rendered {
  svg: SvgNode;
  width: number;
  height: number;
  /** Traslazione delle coordinate del layout nel sistema dell'SVG. */
  offsetX: number;
  offsetY: number;
  layout: Layout;
}

const DASH = "5 3";

function offsetPolyline(points: [number, number][], d: number): [number, number][] {
  // Offset perpendicolare (segmenti ortogonali o obliqui), con raccordo a spigolo.
  const out: [number, number][] = [];
  const normal = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const n1 = i > 0 ? normal(points[i - 1], p) : null;
    const n2 = i < points.length - 1 ? normal(p, points[i + 1]) : null;
    let nx: number;
    let ny: number;
    if (n1 && n2) {
      nx = n1[0] + n2[0];
      ny = n1[1] + n2[1];
      const len = Math.hypot(nx, ny) || 1;
      const cos = (n1[0] * n2[0] + n1[1] * n2[1] + 1) / 2;
      const k = 1 / Math.max(0.3, Math.sqrt(cos));
      nx = (nx / len) * k;
      ny = (ny / len) * k;
    } else {
      [nx, ny] = (n1 ?? n2)!;
    }
    out.push([p[0] + nx * d, p[1] + ny * d]);
  }
  return out;
}

function renderLine(line: LayoutLine, s: number): SvgNode[] {
  const base = { fill: "none", stroke: INK, "stroke-width": STROKE_W, "stroke-dasharray": line.dashed ? DASH : undefined };
  const out: SvgNode[] = [];
  if (line.double) {
    out.push(el("path", { d: pathD(offsetPolyline(line.points, 1.8)), ...base }));
    out.push(el("path", { d: pathD(offsetPolyline(line.points, -1.8)), ...base }));
  } else {
    out.push(el("path", { d: pathD(line.points), ...base }));
  }
  if (line.breakAt) {
    const [bx, by] = line.breakAt;
    for (const k of [-2.5, 2.5]) {
      out.push(el("line", { x1: n(bx + k - 3), y1: n(by + 5), x2: n(bx + k + 3), y2: n(by - 5), stroke: INK, "stroke-width": STROKE_W }));
    }
  }
  if (line.bars) {
    const [ex, ey] = line.points[line.points.length - 1];
    for (let i = 0; i < line.bars; i++) {
      const y = ey - i * 4;
      out.push(el("line", { x1: n(ex - s * 0.28), y1: n(y), x2: n(ex + s * 0.28), y2: n(y), stroke: INK, "stroke-width": STROKE_W }));
    }
  }
  return out;
}

/** Righe del blocco metadati NSGC (solo i campi compilati). */
function metadataLines(ped: Pedigree): string[] {
  const lang = ped.display.language;
  const m = ped.meta;
  const out: string[] = [];
  if (m.title) out.push(m.title);
  const date = `${t(lang, "pedigreeDate")}: ${formatDateValue(ped.date, true)}`;
  out.push(m.updated ? `${date} · ${t(lang, "updated")}: ${m.updated}` : date);
  if (m.compiledBy) out.push(`${t(lang, "compiledBy")}: ${m.compiledBy}${m.compilerRole ? `, ${m.compilerRole}` : ""}`);
  if (m.historian) out.push(`${t(lang, "historian")}: ${m.historian}`);
  if (m.reason) out.push(`${t(lang, "reason")}: ${m.reason}`);
  if (m.ancestryPaternal) out.push(`${t(lang, "ancestryPaternal")}: ${m.ancestryPaternal}`);
  if (m.ancestryMaternal) out.push(`${t(lang, "ancestryMaternal")}: ${m.ancestryMaternal}`);
  return out;
}

export function renderPedigree(ped: Pedigree, opts: RenderOptions = {}, lay: Layout = computeLayout(ped)): Rendered {
  const display = ped.display;
  const s = display.symbolSize;
  const fs = display.fontSize;
  const font = fontStack(display.fontFamily);
  const margin = opts.margin ?? 20;
  const fill: FillContext = {
    office: !!opts.office,
    idPrefix: opts.idPrefix ?? "g",
    scale: s / 40,
    defs: new Map(),
  };

  const drawingW = lay.bounds.x2 - lay.bounds.x1;
  const drawingH = lay.bounds.y2 - lay.bounds.y1;
  const contentW = Math.max(drawingW, opts.minWidth ?? 0, 260);

  // Metadati in alto.
  const showMeta = opts.metadata ?? display.showMetadata;
  const meta: SvgNode[] = [];
  let metaH = 0;
  if (showMeta) {
    const lh = fs * 1.3;
    const lines = metadataLines(ped).flatMap((l) => wrapText(l, contentW, fs, display.fontFamily));
    lines.forEach((text, i) => {
      meta.push(
        el(
          "text",
          { x: 0, y: n(fs + i * lh), "font-family": font, "font-size": n(fs), "font-weight": i === 0 && ped.meta.title ? "bold" : undefined, fill: INK },
          [text]
        )
      );
    });
    metaH = lines.length * lh + fs;
  }

  // Disegni più stretti della legenda: centrati.
  const offsetX = margin - lay.bounds.x1 + (contentW - drawingW) / 2;
  const offsetY = margin + metaH - lay.bounds.y1;

  const layer: SvgNode[] = [];
  for (const line of lay.lines) layer.push(...renderLine(line, s));

  for (const node of lay.nodes) {
    const ind = ped.individuals[node.id];
    const parts = renderSymbol({
      ped,
      ind,
      shape: node.shape,
      cx: node.x,
      cy: node.y,
      s,
      display,
      fill,
      isProband: ped.proband === node.id,
      isConsultand: ped.consultands.includes(node.id) && ped.proband !== node.id,
      adopted: node.adopted,
      letter: letterFor(ind, node),
    });
    const attrs: Record<string, string> = {};
    if (opts.interactive) {
      attrs["data-gid"] = node.id;
      const rel = getRelationToProband(ped, node.id);
      attrs["aria-label"] = [node.number, rel, ind.label].filter(Boolean).join(", ");
      attrs.role = "img";
    }
    layer.push(el("g", attrs, parts));
    const lbl = node.label;
    lbl.lines.forEach((line, i) => {
      layer.push(
        el(
          "text",
          {
            x: n(lbl.x),
            y: n(lbl.y + i * lbl.lineHeight),
            "text-anchor": lbl.anchor,
            "font-family": font,
            "font-size": n(fs),
            fill: line.kind === "number" ? "#333333" : INK,
          },
          [line.text]
        )
      );
    });
  }

  for (const text of lay.texts) {
    const size = text.kind === "generation" ? fs * 1.1 : text.kind === "consanguinity" ? fs * 0.9 : fs;
    layer.push(
      el(
        "text",
        {
          x: n(text.x),
          y: n(text.y),
          "text-anchor": text.anchor,
          "font-family": font,
          "font-size": n(size),
          "font-weight": text.kind === "generation" || text.kind === "twin" ? "bold" : undefined,
          "font-style": text.kind === "consanguinity" ? "italic" : undefined,
          fill: INK,
        },
        [text.text]
      )
    );
  }

  // Legenda sotto il disegno.
  const showLegend = opts.legend ?? display.showLegend;
  let legendNode: SvgNode | null = null;
  let legendH = 0;
  let legendW = 0;
  if (showLegend) {
    const leg = renderLegend(ped, lay, fill, contentW);
    legendNode = leg.node;
    legendH = leg.height + fs;
    legendW = leg.width;
  }

  const width = Math.ceil(Math.max(contentW, legendW) + margin * 2);
  const height = Math.ceil(margin * 2 + metaH + drawingH + (legendH ? legendH + fs * 1.5 : 0));

  const children: SvgNode[] = [];
  if (fill.defs.size) children.push(el("defs", {}, [...fill.defs.values()]));
  children.push(el("rect", { x: 0, y: 0, width, height, fill: "#ffffff" }));
  if (meta.length) children.push(el("g", { transform: `translate(${n(margin)},${n(margin)})` }, meta));
  children.push(el("g", { transform: `translate(${n(offsetX)},${n(offsetY)})` }, layer));
  if (legendNode) {
    children.push(
      el("g", { transform: `translate(${n(margin)},${n(margin + metaH + drawingH + fs * 1.5)})` }, [legendNode])
    );
  }

  const svg = el(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      version: "1.1",
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      "font-family": font,
      role: opts.interactive ? "group" : undefined,
    },
    children
  );
  return { svg, width, height, offsetX, offsetY, layout: lay };
}
