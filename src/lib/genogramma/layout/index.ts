import type { Id, Pedigree } from "../model/types";
import { familyBlock, personUnit, type BuildCtx } from "./build";
import { textWidth } from "./font-metrics";
import { assignRows } from "./generations";
import { buildGraph, type LGraph } from "./graph";
import { labelLines, measureLabel, roman } from "./labels";
import { measureAll, type Measured } from "./measure";
import { findOverlaps } from "./overlap";
import { routeLines } from "./route";
import { straighten } from "./straighten";
import { clearRight, Shape } from "./shape";
import type { Box, Layout, LayoutNode, LayoutOptions, LayoutRow } from "./types";

export type { Layout, LayoutNode, LayoutLine, LayoutText, Box } from "./types";
export { findOverlaps } from "./overlap";

/**
 * Layout deterministico del genogramma: `layout(pedigree) → nodi, linee,
 * testi, righe, bounds`. Funzione pura (nessun DOM): le larghezze del testo
 * vengono dalle metriche del font, così vista ed export coincidono.
 *
 * Passi: generazioni → misura delle etichette → blocchi familiari
 * ricorsivi (ordine e x) → riparazione monotona delle sovrapposizioni
 * residue → numerazione → quote verticali → linee.
 */
export function layout(ped: Pedigree, options: LayoutOptions = {}): Layout {
  const display = ped.display;
  const g = buildGraph(ped);
  const { row, warnings } = assignRows(g.visible, g.unions);
  const m = measureAll(ped, g, row, display);
  const ctx: BuildCtx = {
    ped,
    g,
    row,
    m,
    display,
    claimed: new Set(),
    built: new Set(),
    warnings,
  };

  // Componenti: prima quella del probando, poi le altre (grafo non connesso).
  const roots: Id[] = [];
  if (ped.proband && row.has(ped.proband)) roots.push(ped.proband);
  roots.push(...g.visible);
  let all: Shape | null = null;
  let components = 0;
  for (const id of roots) {
    if (ctx.claimed.has(id)) continue;
    const home = g.home.get(id);
    const shape = home && !ctx.built.has(home) ? familyBlock(ctx, home, null, new Shape()) : personUnit(ctx, id);
    if (!ctx.claimed.has(id)) shape.merge(personUnit(ctx, id));
    components += 1;
    if (!all) all = shape;
    else {
      shape.translate(clearRight(all, shape, display.hSpacing * 3) ?? 0);
      all.merge(shape);
    }
  }
  if (components > 1) warnings.push("Il genogramma contiene gruppi di familiari non collegati tra loro.");

  const xs = new Map<Id, number>(all ? all.xs : []);
  repair(xs, g.visible, row, m, display.hSpacing * 0.4);

  const base = finalize(ped, g, row, m, xs, [...warnings], options);
  if (!display.straightLines) return base;
  // Linee dritte: coppie un po' più distanti invece delle linee a gradino.
  // Si accetta solo se il disegno resta senza sovrapposizioni in più.
  const straight = new Map(xs);
  if (!straighten(straight, g, row, m, display.hSpacing * 0.6)) return base;
  const alt = finalize(ped, g, row, m, straight, [...warnings], options);
  return findOverlaps(alt).length <= findOverlaps(base).length ? alt : base;
}

function finalize(
  ped: Pedigree,
  g: LGraph,
  row: Map<Id, number>,
  m: Map<Id, Measured>,
  xs: Map<Id, number>,
  warnings: string[],
  options: LayoutOptions
): Layout {
  const display = ped.display;
  const s = display.symbolSize;
  // Quote verticali.
  const maxRow = Math.max(0, ...g.visible.map((id) => row.get(id)!));
  const sibDrop = Math.max(12, Math.min(40, display.vSpacing * 0.42));
  const rowY: number[] = [];
  let y = s / 2 + sibDrop + display.fontSize;
  for (let r = 0; r <= maxRow; r++) {
    rowY.push(y);
    let bottom = s / 2;
    for (const id of g.visible) if (row.get(id) === r) bottom = Math.max(bottom, m.get(id)!.bottom);
    y += bottom + display.vSpacing + s / 2;
  }
  const sibY = (r: number) => (rowY[r] ?? y) - s / 2 - sibDrop;

  // Numerazione: generazioni in numeri romani, individui da sinistra a destra.
  const numbering: Record<Id, string> = {};
  for (let r = 0; r <= maxRow; r++) {
    const ids = g.visible.filter((id) => row.get(id) === r).sort((a, b) => xs.get(a)! - xs.get(b)!);
    ids.forEach((id, i) => (numbering[id] = `${roman(r + 1)}-${i + 1}`));
  }

  const nodes: LayoutNode[] = [];
  const byId = new Map<Id, LayoutNode>();
  for (const id of g.visible) {
    const meas = m.get(id)!;
    const x = xs.get(id) ?? 0;
    const cy = rowY[row.get(id)!];
    const lines = measureLabel(labelLines(ped, ped.individuals[id], numbering[id], display), display);
    const w = lines.width;
    const lb = meas.labelBox;
    const labelBox: Box =
      lines.lines.length === 0
        ? { x1: x, y1: cy + lb.y1, x2: x, y2: cy + lb.y1 }
        : meas.labelsRight
          ? { x1: x + lb.x1, y1: cy + lb.y1, x2: x + lb.x1 + w, y2: cy + lb.y1 + lines.height }
          : { x1: x - w / 2, y1: cy + lb.y1, x2: x + w / 2, y2: cy + lb.y1 + lines.height };
    const symbolBox: Box = {
      x1: x + meas.symbolBox.x1,
      y1: cy + meas.symbolBox.y1,
      x2: x + meas.symbolBox.x2,
      y2: cy + meas.symbolBox.y2,
    };
    const arrowBox: Box | undefined = meas.arrowBox
      ? { x1: x + meas.arrowBox.x1, y1: cy + meas.arrowBox.y1, x2: x + meas.arrowBox.x2, y2: cy + meas.arrowBox.y2 }
      : undefined;
    const node: LayoutNode = {
      id,
      x,
      y: cy,
      row: row.get(id)!,
      number: numbering[id],
      shape: meas.shape,
      size: meas.size,
      artRole: meas.artRole,
      adopted: meas.adopted,
      labelsRight: meas.labelsRight,
      symbolBox,
      arrowBox,
      label: {
        x: x + meas.labelAnchor.x,
        y: cy + meas.labelAnchor.y,
        anchor: meas.labelAnchor.anchor,
        lines: lines.lines,
        lineHeight: lines.lineHeight,
        box: labelBox,
      },
      box: {
        x1: Math.min(symbolBox.x1, labelBox.x1, arrowBox?.x1 ?? Infinity),
        y1: Math.min(symbolBox.y1, labelBox.y1),
        x2: Math.max(symbolBox.x2, labelBox.x2),
        y2: Math.max(symbolBox.y2, labelBox.y2, arrowBox?.y2 ?? -Infinity),
      },
    };
    nodes.push(node);
    byId.set(id, node);
  }

  const { lines, texts } = routeLines({ ped, g, nodes: byId, points: xs, rowY, sibY, display });

  // Bounds e numeri di generazione a sinistra.
  let bx1 = Infinity;
  let by1 = Infinity;
  let bx2 = -Infinity;
  let by2 = -Infinity;
  const grow = (b: Box) => {
    bx1 = Math.min(bx1, b.x1);
    by1 = Math.min(by1, b.y1);
    bx2 = Math.max(bx2, b.x2);
    by2 = Math.max(by2, b.y2);
  };
  for (const n of nodes) grow(n.box);
  for (const t of texts) grow(t.box);
  for (const l of lines) for (const [px, py] of l.points) grow({ x1: px, y1: py, x2: px, y2: py });
  if (!Number.isFinite(bx1)) {
    bx1 = 0;
    by1 = 0;
    bx2 = 0;
    by2 = 0;
  }
  const rows: LayoutRow[] = display.showNumbers
    ? rowY.map((ry, r) => ({ row: r, y: ry, label: roman(r + 1) }))
    : [];
  const genW = Math.max(0, ...rows.map((r) => textWidth(r.label, display.fontSize * 1.1, display.fontFamily, true)));
  const genX = bx1 - display.hSpacing - genW;
  for (const r of rows) {
    const tx = genX;
    texts.push({
      kind: "generation",
      text: r.label,
      x: tx,
      y: r.y + display.fontSize * 0.4,
      anchor: "start",
      box: { x1: tx, y1: r.y - display.fontSize, x2: tx + genW, y2: r.y + display.fontSize * 0.5 },
    });
  }
  if (rows.length) bx1 = genX;

  const result: Layout = {
    nodes,
    byId,
    lines,
    texts,
    rows,
    bounds: { x1: bx1, y1: Math.min(by1, 0), x2: bx2, y2: by2 },
    numbering,
    warnings,
    display,
  };
  if (options.check) {
    const overlaps = findOverlaps(result);
    if (overlaps.length) result.warnings.push(`Sovrapposizioni nel disegno: ${overlaps.length}.`);
  }
  return result;
}

/**
 * Riparazione monotona: se su una riga due ingombri si toccano, tutto ciò
 * che sta a destra del primo (su ogni riga) si sposta a destra. La mappa
 * x → x' è crescente, quindi l'ordine su ogni riga resta lo stesso e non
 * nascono incroci nuovi; le linee al più si allungano.
 */
function repair(
  xs: Map<Id, number>,
  ids: Id[],
  row: Map<Id, number>,
  m: Map<Id, { extL: number; extR: number }>,
  gap: number
) {
  const byRow = new Map<number, Id[]>();
  for (const id of ids) {
    if (!xs.has(id)) continue;
    const r = row.get(id)!;
    byRow.set(r, [...(byRow.get(r) ?? []), id]);
  }
  for (let iter = 0; iter < 2000; iter++) {
    let fixed = false;
    for (const list of byRow.values()) {
      list.sort((a, b) => xs.get(a)! - xs.get(b)! || ids.indexOf(a) - ids.indexOf(b));
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i];
        const b = list[i + 1];
        const need = xs.get(a)! + m.get(a)!.extR + gap - (xs.get(b)! - m.get(b)!.extL);
        if (need <= 0.01) continue;
        const cut = xs.get(a)!;
        for (const [k, v] of xs) {
          if (v > cut + 1e-6 || k === b) xs.set(k, v + need);
        }
        fixed = true;
        break;
      }
      if (fixed) break;
    }
    if (!fixed) return;
  }
}
