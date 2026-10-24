import { homeEntry, unionsOf } from "../model/queries";
import { orderChildren } from "../model/sibling-order";
import type { Id, Pedigree } from "../model/types";
import type { Layout } from "./types";

/**
 * Logica pura dell'interazione col disegno: trascinamento di un fratello
 * dentro la sua fratria, navigazione da tastiera tra i simboli.
 */
export type DragInfo =
  | { ok: true; unionId: Id; siblings: Id[] }
  | { ok: false; reason: string };

/**
 * Si può trascinare solo dentro la propria fratria (stessa riga, stessa
 * unione). Il connettore resta bloccato all'estremità interna quando anche
 * il suo partner ha la famiglia d'origine nel disegno.
 */
export function dragInfo(ped: Pedigree, lay: Layout, id: Id): DragInfo {
  const entry = homeEntry(ped, id);
  const node = lay.byId.get(id);
  if (!entry || !node) return { ok: false, reason: "Nessuna fratria: aggiungi prima i genitori." };
  const siblings = orderChildren(ped, entry.union)
    .filter((c) => lay.byId.get(c)?.row === node.row && homeEntry(ped, c)?.union.id === entry.union.id)
    .sort((a, b) => lay.byId.get(a)!.x - lay.byId.get(b)!.x);
  if (siblings.length < 2) return { ok: false, reason: "Non ci sono fratelli con cui scambiare la posizione." };
  const pinned = unionsOf(ped, id).some((u) => u.partners.some((p) => p !== id && homeEntry(ped, p)));
  if (pinned) {
    return {
      ok: false,
      reason:
        "Posizione bloccata: chi sposa una persona di cui sono disegnati i genitori sta all'estremità della fratria, così le linee non si incrociano.",
    };
  }
  return { ok: true, unionId: entry.union.id, siblings };
}

/** Indice di rilascio (nell'ordine visibile, senza il trascinato) per la x indicata. */
export function dropIndex(lay: Layout, siblings: Id[], dragged: Id, x: number): number {
  const others = siblings.filter((s) => s !== dragged);
  let i = 0;
  while (i < others.length && lay.byId.get(others[i])!.x < x) i++;
  return i;
}

/** x dell'indicatore di rilascio, tra i due vicini. */
export function dropMarkerX(lay: Layout, siblings: Id[], dragged: Id, index: number): number {
  const others = siblings.filter((s) => s !== dragged).map((s) => lay.byId.get(s)!);
  const s = lay.display.symbolSize;
  if (others.length === 0) return lay.byId.get(dragged)!.x;
  if (index <= 0) return others[0].x - s;
  if (index >= others.length) return others[others.length - 1].x + s;
  return (others[index - 1].x + others[index].x) / 2;
}

/**
 * Traduce l'indice visibile nell'indice di `orderChildren` (ciò che
 * `moveChild` si aspetta): il fratello va subito dopo il vicino di sinistra.
 */
export function modelIndex(ped: Pedigree, unionId: Id, siblings: Id[], dragged: Id, index: number): number {
  const order = orderChildren(ped, ped.unions[unionId]).filter((c) => c !== dragged);
  const others = siblings.filter((s) => s !== dragged);
  if (index <= 0) return Math.max(0, order.indexOf(others[0]));
  const left = others[Math.min(index, others.length) - 1];
  return order.indexOf(left) + 1;
}

/** Simbolo più vicino nella direzione indicata (frecce della tastiera). */
export function nearestInDirection(lay: Layout, from: Id, dir: "left" | "right" | "up" | "down"): Id | null {
  const a = lay.byId.get(from);
  if (!a) return lay.nodes[0]?.id ?? null;
  let best: Id | null = null;
  let bestScore = Infinity;
  for (const b of lay.nodes) {
    if (b.id === from) continue;
    const dx = b.x - a.x;
    let ok = false;
    let score = 0;
    if (dir === "left" || dir === "right") {
      ok = b.row === a.row && (dir === "left" ? dx < 0 : dx > 0);
      score = Math.abs(dx);
    } else {
      ok = dir === "up" ? b.row === a.row - 1 : b.row === a.row + 1;
      score = Math.abs(dx);
    }
    if (ok && score < bestScore) {
      bestScore = score;
      best = b.id;
    }
  }
  return best;
}
