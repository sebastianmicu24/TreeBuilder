import type { Box, Layout, LayoutLine } from "./types";

/**
 * Verificatore geometrico del layout: simboli, etichette e testi non si
 * sovrappongono; le linee non attraversano simboli o etichette (esclusi i
 * simboli a cui sono attaccate); due linee non corrono una sull'altra.
 * Usato nei test su tutte le fixture; i messaggi non contengono mai dati
 * inseriti dall'utente, solo tipi ed ID interni.
 */
export interface Overlap {
  kind: "box-box" | "line-box" | "line-line";
  a: string;
  b: string;
}

const EPS = 0.75;

function intersects(a: Box, b: Box): boolean {
  return a.x1 < b.x2 - EPS && a.x2 > b.x1 + EPS && a.y1 < b.y2 - EPS && a.y2 > b.y1 + EPS;
}

function empty(b: Box): boolean {
  return b.x2 - b.x1 < 0.5 || b.y2 - b.y1 < 0.5;
}

/** Il segmento attraversa l'interno del box (Liang-Barsky)? */
function segmentHitsBox(p: [number, number], q: [number, number], box: Box): boolean {
  const b = { x1: box.x1 + EPS, y1: box.y1 + EPS, x2: box.x2 - EPS, y2: box.y2 - EPS };
  if (b.x2 <= b.x1 || b.y2 <= b.y1) return false;
  let t0 = 0;
  let t1 = 1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const clip = (pp: number, qq: number) => {
    if (pp === 0) return qq >= 0;
    const r = qq / pp;
    if (pp < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (
    clip(-dx, p[0] - b.x1) &&
    clip(dx, b.x2 - p[0]) &&
    clip(-dy, p[1] - b.y1) &&
    clip(dy, b.y2 - p[1])
  ) {
    return t1 - t0 > 1e-6;
  }
  return false;
}

function segments(line: LayoutLine): [[number, number], [number, number]][] {
  const out: [[number, number], [number, number]][] = [];
  for (let i = 0; i + 1 < line.points.length; i++) out.push([line.points[i], line.points[i + 1]]);
  return out;
}

export function findOverlaps(layout: Layout): Overlap[] {
  const out: Overlap[] = [];
  const items: { key: string; owner: string; box: Box; symbol: boolean }[] = [];
  for (const n of layout.nodes) {
    items.push({ key: `symbol:${n.id}`, owner: n.id, box: n.symbolBox, symbol: true });
    if (n.arrowBox) items.push({ key: `arrow:${n.id}`, owner: n.id, box: n.arrowBox, symbol: false });
    if (!empty(n.label.box)) items.push({ key: `label:${n.id}`, owner: n.id, box: n.label.box, symbol: false });
  }
  layout.texts.forEach((t, i) => items.push({ key: `text:${t.kind}:${i}`, owner: `text${i}`, box: t.box, symbol: false }));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.owner === b.owner) continue;
      if (intersects(a.box, b.box)) out.push({ kind: "box-box", a: a.key, b: b.key });
    }
  }

  for (const [li, line] of layout.lines.entries()) {
    const attached = new Set(line.ids);
    for (const [p, q] of segments(line)) {
      for (const it of items) {
        if (it.symbol && attached.has(it.owner)) continue;
        // Il testo di un "nessun figlio" sta sotto la propria barra: è parte della stessa notazione.
        if (line.kind === "no-children" && it.key.startsWith("text:no-children")) continue;
        if (line.kind === "twin-bar" && it.key.startsWith("text:twin")) continue;
        if (segmentHitsBox(p, q, it.box)) {
          out.push({ kind: "line-box", a: `line:${line.kind}:${li}`, b: it.key });
        }
      }
    }
  }

  // Linee collineari che corrono una sull'altra (ambiguità di lettura).
  type Seg = { li: number; kind: string; unionId?: string; axis: "h" | "v"; c: number; lo: number; hi: number };
  const segs: Seg[] = [];
  layout.lines.forEach((line, li) => {
    for (const [p, q] of segments(line)) {
      if (Math.abs(p[1] - q[1]) < 0.01) {
        segs.push({ li, kind: line.kind, unionId: line.unionId, axis: "h", c: p[1], lo: Math.min(p[0], q[0]), hi: Math.max(p[0], q[0]) });
      } else if (Math.abs(p[0] - q[0]) < 0.01) {
        segs.push({ li, kind: line.kind, unionId: line.unionId, axis: "v", c: p[0], lo: Math.min(p[1], q[1]), hi: Math.max(p[1], q[1]) });
      }
    }
  });
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i];
      const b = segs[j];
      if (a.li === b.li || a.axis !== b.axis || Math.abs(a.c - b.c) > 0.5) continue;
      if (a.unionId && a.unionId === b.unionId) continue;
      const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      if (overlap > 1) out.push({ kind: "line-line", a: `line:${a.kind}:${a.li}`, b: `line:${b.kind}:${b.li}` });
    }
  }
  return out;
}
