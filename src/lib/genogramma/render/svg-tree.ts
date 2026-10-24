/**
 * Albero SVG come dato puro: lo stesso albero diventa stringa per l'export
 * (`serialize`) o elementi React per la vista (`components/genogramma/svg-tree`).
 * Solo attributi di presentazione inline: niente classi, niente CSS esterno.
 */
export type AttrValue = string | number | undefined;

export interface SvgNode {
  tag: string;
  attrs: Record<string, AttrValue>;
  children: (SvgNode | string)[];
}

export function el(
  tag: string,
  attrs: Record<string, AttrValue> = {},
  children: (SvgNode | string | null | undefined | false)[] = []
): SvgNode {
  return {
    tag,
    attrs,
    children: children.filter((c): c is SvgNode | string => c !== null && c !== undefined && c !== false),
  };
}

/** Numero compatto e stabile (niente "1.0000000002" negli export). */
export function n(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

export function pts(points: [number, number][]): string {
  return points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
}

export function pathD(points: [number, number][], close = false): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M${n(first[0])} ${n(first[1])}${rest.map(([x, y]) => `L${n(x)} ${n(y)}`).join("")}${close ? "Z" : ""}`;
}
