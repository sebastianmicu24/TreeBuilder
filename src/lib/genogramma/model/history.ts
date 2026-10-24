import type { Pedigree } from "./types";

/**
 * Undo/redo come pila di istantanee immutabili. I comandi condividono la
 * struttura non modificata, quindi ogni passo costa solo i nodi cambiati.
 */
export interface History {
  past: Pedigree[];
  present: Pedigree;
  future: Pedigree[];
}

export const HISTORY_LIMIT = 200;

export function createHistory(present: Pedigree): History {
  return { past: [], present, future: [] };
}

/** Registra un nuovo stato; un comando che non cambia nulla non crea un passo. */
export function commit(h: History, next: Pedigree): History {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, present: next, future: [] };
}

export function undo(h: History): History {
  if (h.past.length === 0) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (h.future.length === 0) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next, future };
}

/** Sostituisce lo stato senza passo di undo (es. import confermato, nuovo genogramma). */
export function reset(present: Pedigree): History {
  return createHistory(present);
}
