import { GEOM } from "../layout/measure";
import type { SymbolShape } from "../model/notation";

/**
 * Geometria pura dei simboli: contorni come poligoni convessi, settori
 * (metà, quadranti, spicchi) e ritaglio di segmenti e punti. Serve ai
 * riempimenti "compatibilità Office": tratteggi disegnati come linee
 * esplicite, senza <pattern> né clipPath.
 */
export type Pt = [number, number];

/** Contorno del simbolo centrato in (cx, cy) con lato s (cerchio approssimato a 64 lati). */
export function shapePolygon(shape: SymbolShape, cx: number, cy: number, s: number): Pt[] {
  const h = s / 2;
  switch (shape) {
    case "square":
      return [
        [cx - h, cy - h],
        [cx + h, cy - h],
        [cx + h, cy + h],
        [cx - h, cy + h],
      ];
    case "diamond":
      return [
        [cx, cy - h],
        [cx + h, cy],
        [cx, cy + h],
        [cx - h, cy],
      ];
    case "triangle":
      return trianglePoints(cx, cy, s);
    default: {
      const out: Pt[] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        out.push([cx + Math.cos(a) * h, cy + Math.sin(a) * h]);
      }
      return out;
    }
  }
}

/** Triangolo (SAB, TOP, ECT): vertice in alto alla quota dei simboli interi. */
export function trianglePoints(cx: number, cy: number, s: number): Pt[] {
  const side = s * GEOM.triangle;
  const top = cy - s / 2;
  const height = side * 0.9;
  return [
    [cx, top],
    [cx + side / 2, top + height],
    [cx - side / 2, top + height],
  ];
}

export function centroid(poly: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

/** Ritaglio di un poligono con il semipiano a·x + b·y ≤ c (Sutherland–Hodgman). */
function clipHalfPlane(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const inside = (p: Pt) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const ci = inside(cur);
    const pi = inside(prev);
    if (ci !== pi) {
      const dx = cur[0] - prev[0];
      const dy = cur[1] - prev[1];
      const t = (c - a * prev[0] - b * prev[1]) / (a * dx + b * dy);
      out.push([prev[0] + dx * t, prev[1] + dy * t]);
    }
    if (ci) out.push(cur);
  }
  return out;
}

/**
 * Settore `index` di `count` (NSGC: 1 intero, 2 metà sinistra/destra,
 * 3–4 quadranti in senso orario dall'alto a sinistra, oltre spicchi
 * uguali dall'alto in senso orario), ritagliato sul poligono del simbolo.
 */
export function sectorPolygon(poly: Pt[], center: Pt, index: number, count: number): Pt[] {
  const [cx, cy] = center;
  if (count <= 1) return poly;
  if (count === 2) {
    return index === 0 ? clipHalfPlane(poly, 1, 0, cx) : clipHalfPlane(poly, -1, 0, -cx);
  }
  if (count <= 4) {
    // Quadranti: 0 alto-sx, 1 alto-dx, 2 basso-dx, 3 basso-sx.
    const left = index === 0 || index === 3;
    const top = index === 0 || index === 1;
    let p = left ? clipHalfPlane(poly, 1, 0, cx) : clipHalfPlane(poly, -1, 0, -cx);
    p = top ? clipHalfPlane(p, 0, 1, cy) : clipHalfPlane(p, 0, -1, -cy);
    return p;
  }
  // Spicchi: angoli misurati dall'alto in senso orario.
  const a0 = (index / count) * Math.PI * 2;
  const a1 = ((index + 1) / count) * Math.PI * 2;
  const dir = (a: number): Pt => [Math.sin(a), -Math.cos(a)];
  const [x0, y0] = dir(a0);
  const [x1, y1] = dir(a1);
  // Semipiano a destra del raggio a0 e a sinistra del raggio a1 (spicchio < 180°).
  let p = clipHalfPlane(poly, y0, -x0, y0 * cx - x0 * cy);
  p = clipHalfPlane(p, -y1, x1, -y1 * cx + x1 * cy);
  return p;
}

/** Poligono scalato attorno al centro (riempimento parziale del portatore). */
export function scalePolygon(poly: Pt[], center: Pt, k: number): Pt[] {
  return poly.map(([x, y]) => [center[0] + (x - center[0]) * k, center[1] + (y - center[1]) * k]);
}

/** Ritaglio di un segmento su un poligono convesso (Cyrus–Beck). */
export function clipSegment(p: Pt, q: Pt, poly: Pt[]): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  const d: Pt = [q[0] - p[0], q[1] - p[1]];
  // Orientamento del poligono.
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    // Normale interna.
    const nx = -(b[1] - a[1]) * sign;
    const ny = (b[0] - a[0]) * sign;
    const num = nx * (p[0] - a[0]) + ny * (p[1] - a[1]);
    const den = nx * d[0] + ny * d[1];
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if (t1 - t0 < 1e-6) return null;
  return [
    [p[0] + d[0] * t0, p[1] + d[1] * t0],
    [p[0] + d[0] * t1, p[1] + d[1] * t1],
  ];
}

export function pointInConvex(p: Pt, poly: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

export function bboxOf(poly: Pt[]): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const [x, y] of poly) {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  }
  return { x1, y1, x2, y2 };
}
