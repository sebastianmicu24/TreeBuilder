import type { Id } from "../model/types";
import { descentKey } from "./build";
import type { LGraph, LUnion } from "./graph";
import type { Measured } from "./measure";

/**
 * Opzione "linee dritte": quando un figlio unico non sta sotto la linea di
 * discendenza dei genitori (la linea scende, gira e riscende "a gradino"),
 * lo si sposta sotto la discendenza.
 *
 * - Se il figlio è un connettore (sposato con una persona di cui sono
 *   disegnati i genitori), si sposta solo lui: la coppia si allarga.
 * - Altrimenti si sposta con tutto il suo sottoalbero (partner entrati in
 *   famiglia e discendenti), così le linee sotto restano dritte.
 *
 * Uno spostamento si applica solo se l'ordine su ogni riga resta lo stesso
 * e nessun ingombro si sovrappone. Restituisce true se ha cambiato qualcosa.
 */
export function straighten(
  xs: Map<Id, number>,
  g: LGraph,
  row: Map<Id, number>,
  m: Map<Id, Pick<Measured, "extL" | "extR">>,
  gap: number
): boolean {
  const byRow = new Map<number, Id[]>();
  for (const id of g.visible) {
    if (!xs.has(id)) continue;
    const r = row.get(id)!;
    byRow.set(r, [...(byRow.get(r) ?? []), id]);
  }
  const unions = [...g.unions].sort((a, b) => (row.get(a.partners[0]) ?? 0) - (row.get(b.partners[0]) ?? 0));
  const adjacent = (u: LUnion) => {
    if (u.partners.length !== 2) return false;
    const r = row.get(u.partners[0]);
    if (r !== row.get(u.partners[1])) return false;
    const [a, b] = u.partners.map((p) => xs.get(p)!).sort((x, y) => x - y);
    return !(byRow.get(r!) ?? []).some((id) => !u.partners.includes(id) && xs.get(id)! > a && xs.get(id)! < b);
  };

  const subtree = (root: Id): Set<Id> => {
    const out = new Set<Id>([root]);
    const stack = [root];
    while (stack.length) {
      const p = stack.pop()!;
      for (const u of g.unionsOf.get(p) ?? []) {
        for (const q of u.partners) {
          // Partner entrati in famiglia (senza famiglia d'origine disegnata) seguono.
          if (!out.has(q) && !g.home.has(q) && (g.unionsOf.get(q) ?? []).every((v) => v.partners.includes(p))) {
            out.add(q);
            stack.push(q);
          }
        }
        for (const c of u.children) {
          if (!out.has(c.id) && g.home.get(c.id) === u.id) {
            out.add(c.id);
            stack.push(c.id);
          }
        }
      }
    }
    return out;
  };

  /** Prova a spostare `set` di `delta`: ordine invariato e nessuna sovrapposizione. */
  const tryMove = (set: Set<Id>, delta: number): boolean => {
    const rows = new Set([...set].map((id) => row.get(id)!));
    for (const r of rows) {
      const ids = byRow.get(r) ?? [];
      const pos = (id: Id) => xs.get(id)! + (set.has(id) ? delta : 0);
      const before = [...ids].sort((a, b) => xs.get(a)! - xs.get(b)!);
      const after = [...ids].sort((a, b) => pos(a) - pos(b));
      if (before.some((id, i) => id !== after[i])) return false;
      for (let i = 0; i + 1 < after.length; i++) {
        const a = after[i];
        const b = after[i + 1];
        if (pos(a) + m.get(a)!.extR + gap > pos(b) - m.get(b)!.extL + 0.01) return false;
      }
    }
    for (const id of set) xs.set(id, xs.get(id)! + delta);
    return true;
  };

  const refreshDescent = () => {
    for (const u of g.unions) {
      if (u.partners.length === 1) xs.set(descentKey(u.id), xs.get(u.partners[0])!);
      else if (adjacent(u)) xs.set(descentKey(u.id), (xs.get(u.partners[0])! + xs.get(u.partners[1])!) / 2);
    }
  };

  let changed = false;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const u of unions) {
      if (u.partners.length === 0 || u.carrierOf) continue;
      if (u.partners.length === 2 && !adjacent(u)) continue;
      const dx = xs.get(descentKey(u.id));
      if (dx === undefined) continue;
      const childRow = (row.get(u.partners[0]) ?? 0) + 1;
      const local = u.children.filter((c) => g.home.get(c.id) === u.id && row.get(c.id) === childRow && xs.has(c.id));
      if (local.length !== 1) continue;
      const c = local[0].id;
      const delta = dx - xs.get(c)!;
      if (Math.abs(delta) < 0.5) continue;
      const couples = (g.unionsOf.get(c) ?? []).filter((v) => v.partners.length === 2);
      const connector = couples.some((v) => v.partners.some((p) => p !== c && g.home.has(p)));
      if (connector) {
        // Si allarga la coppia solo se è una coppia semplice e resta adiacente.
        if (couples.length !== 1 || !adjacent(couples[0])) continue;
        if (!tryMove(new Set([c]), delta)) continue;
        if (!adjacent(couples[0])) {
          xs.set(c, xs.get(c)! - delta);
          continue;
        }
      } else if (!tryMove(subtree(c), delta)) {
        continue;
      }
      refreshDescent();
      moved = true;
      changed = true;
    }
    if (!moved) break;
  }
  return changed;
}
