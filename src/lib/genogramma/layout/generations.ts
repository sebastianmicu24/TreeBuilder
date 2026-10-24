import type { Id } from "../model/types";
import type { LUnion } from "./graph";

/**
 * Assegnazione delle generazioni (righe).
 *
 * 1. I partner (e donatori/gestanti della stessa unione) formano un
 *    "gruppo di riga" (union-find): stanno sempre sulla stessa riga.
 * 2. Riga = cammino più lungo dalle radici nel DAG gruppo → gruppo dei figli.
 * 3. I gruppi senza genitori (antenati di chi entra in famiglia) scendono
 *    fino alla riga sopra il figlio più alto, così le linee non si allungano.
 *
 * Un ciclo (dati non validi) viene spezzato ignorando l'arco di ritorno.
 */
export function assignRows(ids: Id[], unions: LUnion[]): { row: Map<Id, number>; warnings: string[] } {
  const parent = new Map<Id, Id>();
  for (const id of ids) parent.set(id, id);
  const find = (x: Id): Id => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const join = (a: Id, b: Id) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const u of unions) {
    const mates = [...u.partners, ...u.extras];
    for (let i = 1; i < mates.length; i++) join(mates[0], mates[i]);
  }

  const groups = new Set(ids.map(find));
  const children = new Map<Id, Set<Id>>();
  const parentsOf = new Map<Id, Set<Id>>();
  for (const g of groups) {
    children.set(g, new Set());
    parentsOf.set(g, new Set());
  }
  for (const u of unions) {
    if (u.partners.length === 0) continue;
    const pg = find(u.partners[0]);
    for (const c of u.children) {
      const cg = find(c.id);
      if (cg === pg) continue;
      children.get(pg)!.add(cg);
      parentsOf.get(cg)!.add(pg);
    }
  }

  // Ordinamento topologico (Kahn), deterministico nell'ordine di inserimento.
  const indeg = new Map<Id, number>();
  for (const g of groups) indeg.set(g, parentsOf.get(g)!.size);
  const order: Id[] = [];
  const queue = [...groups].filter((g) => indeg.get(g) === 0);
  const warnings: string[] = [];
  const remaining = new Set(groups);
  while (remaining.size > 0) {
    if (queue.length === 0) {
      // Ciclo: si sblocca il primo gruppo rimasto.
      const g = [...remaining][0];
      warnings.push("Ciclo nella discendenza: disposizione approssimata.");
      queue.push(g);
      indeg.set(g, 0);
    }
    const g = queue.shift()!;
    if (!remaining.has(g)) continue;
    remaining.delete(g);
    order.push(g);
    for (const c of children.get(g)!) {
      const d = (indeg.get(c) ?? 0) - 1;
      indeg.set(c, d);
      if (d === 0 && remaining.has(c)) queue.push(c);
    }
  }

  const rowOf = new Map<Id, number>();
  const pos = new Map(order.map((g, i) => [g, i]));
  for (const g of order) {
    let r = 0;
    for (const p of parentsOf.get(g)!) {
      if ((pos.get(p) ?? 0) < pos.get(g)!) r = Math.max(r, (rowOf.get(p) ?? 0) + 1);
    }
    rowOf.set(g, r);
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const g = order[i];
    if (parentsOf.get(g)!.size > 0) continue;
    let minChild = Infinity;
    for (const c of children.get(g)!) minChild = Math.min(minChild, rowOf.get(c)!);
    if (minChild !== Infinity) rowOf.set(g, Math.max(rowOf.get(g)!, minChild - 1));
  }
  let min = Infinity;
  for (const v of rowOf.values()) min = Math.min(min, v);
  const row = new Map<Id, number>();
  for (const id of ids) row.set(id, rowOf.get(find(id))! - (min === Infinity ? 0 : min));
  return { row, warnings };
}
