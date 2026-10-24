import type { Id } from "../model/types";

/**
 * Blocco in costruzione: posizioni x (in un sistema locale) e, per ogni
 * riga, gli intervalli occupati. È il "contorno" alla Reingold-Tilford,
 * ma su tutte le righe (anche sopra l'ancora: gli antenati di chi entra
 * in famiglia stanno sopra di lui).
 *
 * Gli ID che iniziano con "@" sono punti ausiliari (posizione della linea
 * di discendenza, segnaposto di un partner lontano): seguono le
 * traslazioni ma non occupano spazio.
 */
export class Shape {
  readonly xs = new Map<Id, number>();
  readonly spans = new Map<number, [number, number][]>();
  /** Proprietario di ciascuno span (stesso indice), per escludere un nodo dai contorni. */
  readonly owners = new Map<number, (Id | null)[]>();

  isEmpty(): boolean {
    return this.xs.size === 0 && this.spans.size === 0;
  }

  setPoint(id: Id, x: number): void {
    this.xs.set(id, x);
  }

  addNode(id: Id, x: number, row: number, extL: number, extR: number): void {
    this.xs.set(id, x);
    this.addSpan(row, x - extL, x + extR, id);
  }

  addSpan(row: number, l: number, r: number, owner: Id | null = null): void {
    const list = this.spans.get(row);
    if (list) {
      list.push([l, r]);
      this.owners.get(row)!.push(owner);
    } else {
      this.spans.set(row, [[l, r]]);
      this.owners.set(row, [owner]);
    }
  }

  /** Trasla tutto tranne i nodi indicati (e i loro span). */
  translateExcept(dx: number, keep: Set<Id>): void {
    if (dx === 0) return;
    for (const [k, v] of this.xs) if (!keep.has(k)) this.xs.set(k, v + dx);
    for (const [row, list] of this.spans) {
      const owners = this.owners.get(row)!;
      list.forEach((s, i) => {
        if (owners[i] && keep.has(owners[i]!)) return;
        s[0] += dx;
        s[1] += dx;
      });
    }
  }

  /** Copia senza i nodi indicati. */
  without(ids: Set<Id>): Shape {
    const out = new Shape();
    for (const [k, v] of this.xs) if (!ids.has(k)) out.xs.set(k, v);
    for (const [row, list] of this.spans) {
      const owners = this.owners.get(row)!;
      list.forEach((s, i) => {
        if (owners[i] && ids.has(owners[i]!)) return;
        out.addSpan(row, s[0], s[1], owners[i]);
      });
    }
    return out;
  }

  translate(dx: number): void {
    if (dx === 0) return;
    for (const [k, v] of this.xs) this.xs.set(k, v + dx);
    for (const list of this.spans.values()) {
      for (const s of list) {
        s[0] += dx;
        s[1] += dx;
      }
    }
  }

  merge(other: Shape, skip?: Set<Id>): void {
    for (const [k, v] of other.xs) if (!skip?.has(k)) this.xs.set(k, v);
    for (const [row, list] of other.spans) {
      const owners = other.owners.get(row)!;
      list.forEach(([l, r], i) => {
        if (skip && owners[i] && skip.has(owners[i]!)) return;
        this.addSpan(row, l, r, owners[i]);
      });
    }
  }

  left(row: number): number | undefined {
    const list = this.spans.get(row);
    if (!list) return undefined;
    let m = Infinity;
    for (const s of list) m = Math.min(m, s[0]);
    return m;
  }

  right(row: number): number | undefined {
    const list = this.spans.get(row);
    if (!list) return undefined;
    let m = -Infinity;
    for (const s of list) m = Math.max(m, s[1]);
    return m;
  }

  rows(): number[] {
    return [...this.spans.keys()];
  }

  x(id: Id): number {
    const v = this.xs.get(id);
    if (v === undefined) throw new Error(`layout: punto mancante ${id}`);
    return v;
  }
}

/**
 * Spostamento minimo da dare a `b` perché stia tutto a destra di `a`
 * (su ogni riga in comune) con lo spazio `gap`. Null se non hanno righe
 * in comune.
 */
export function clearRight(a: Shape, b: Shape, gap: number): number | null {
  let need: number | null = null;
  for (const row of b.rows()) {
    const ar = a.right(row);
    const bl = b.left(row);
    if (ar === undefined || bl === undefined) continue;
    const d = ar + gap - bl;
    need = need === null ? d : Math.max(need, d);
  }
  return need;
}

/** Spostamento (positivo o negativo) più piccolo perché lo span non tocchi gli intervalli. */
export function nearestFree(
  span: [number, number],
  obstacles: [number, number][],
  gap: number,
  prefer: "left" | "right" | "none" = "none"
): number {
  const collides = (dx: number) =>
    obstacles.some(([l, r]) => span[0] + dx < r + gap && span[1] + dx > l - gap);
  if (!collides(0)) return 0;
  const sorted = [...obstacles].sort((a, b) => a[0] - b[0]);
  // Verso destra.
  let right = 0;
  for (let i = 0; i < 200 && collides(right); i++) {
    let next = right;
    for (const [l, r] of sorted) {
      if (span[0] + right < r + gap && span[1] + right > l - gap) next = Math.max(next, r + gap - span[0]);
    }
    if (next === right) break;
    right = next;
  }
  let left = 0;
  for (let i = 0; i < 200 && collides(left); i++) {
    let next = left;
    for (const [l, r] of sorted) {
      if (span[0] + left < r + gap && span[1] + left > l - gap) next = Math.min(next, l - gap - span[1]);
    }
    if (next === left) break;
    left = next;
  }
  if (prefer === "right") return right;
  if (prefer === "left") return left;
  return Math.abs(left) < Math.abs(right) ? left : right;
}
