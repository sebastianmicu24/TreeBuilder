"use client";

import { useCallback, useMemo, useReducer } from "react";
import { GenogramError } from "@/lib/genogramma/model/commands";
import { commit, createHistory, redo, reset, undo, type History } from "@/lib/genogramma/model/history";
import type { Id, Pedigree } from "@/lib/genogramma/model/types";

/**
 * Stato dell'editor: storia immutabile (undo/redo), selezione, ultimo
 * errore leggibile. Tutto resta in memoria nel browser; la persistenza
 * locale è un livello separato.
 */
interface State {
  history: History | null;
  selected: Id | null;
  error: string | null;
  /** Chiave dell'ultima modifica "continua" (cursori): i passi si fondono in uno. */
  coalesce: string | null;
}

type Action =
  | { type: "load"; pedigree: Pedigree | null }
  | { type: "commit"; pedigree: Pedigree; select?: Id | null; coalesce?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; id: Id | null }
  | { type: "error"; message: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load":
      return { history: action.pedigree ? reset(action.pedigree) : null, selected: action.pedigree?.proband ?? null, error: null, coalesce: null };
    case "commit": {
      if (!state.history) return { ...state, history: createHistory(action.pedigree), error: null };
      const next = { ...action.pedigree, updatedAt: new Date().toISOString() };
      const merge = !!action.coalesce && action.coalesce === state.coalesce;
      return {
        history: merge ? { ...state.history, present: next, future: [] } : commit(state.history, next),
        selected: action.select !== undefined ? action.select : state.selected,
        error: null,
        coalesce: action.coalesce ?? null,
      };
    }
    case "undo":
      return state.history ? { ...state, history: undo(state.history), error: null, coalesce: null } : state;
    case "redo":
      return state.history ? { ...state, history: redo(state.history), error: null, coalesce: null } : state;
    case "select":
      return { ...state, selected: action.id };
    case "error":
      return { ...state, error: action.message };
  }
}

export interface GenogramStore {
  pedigree: Pedigree | null;
  selected: Id | null;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  load: (p: Pedigree | null) => void;
  /** Applica un comando puro; un GenogramError diventa un messaggio, non un crash. */
  run: (
    fn: (p: Pedigree) => Pedigree | { pedigree: Pedigree; created?: Id[] },
    opts?: { select?: Id | null | "created"; coalesce?: string }
  ) => boolean;
  undo: () => void;
  redo: () => void;
  select: (id: Id | null) => void;
  clearError: () => void;
}

export function useGenogramStore(initial: Pedigree | null = null): GenogramStore {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    history: initial ? createHistory(initial) : null,
    selected: initial?.proband ?? null,
    error: null,
    coalesce: null,
  }));
  const pedigree = state.history?.present ?? null;

  const run = useCallback<GenogramStore["run"]>(
    (fn, opts) => {
      if (!pedigree) return false;
      try {
        const out = fn(pedigree);
        const next = "schemaVersion" in out ? out : out.pedigree;
        const created = "schemaVersion" in out ? undefined : out.created;
        let select: Id | null | undefined;
        if (opts?.select === "created") select = created?.[created.length - 1] ?? undefined;
        else select = opts?.select;
        if (next === pedigree) return true;
        dispatch({ type: "commit", pedigree: next, select, coalesce: opts?.coalesce });
        return true;
      } catch (e) {
        dispatch({
          type: "error",
          message: e instanceof GenogramError ? e.message : "Operazione non riuscita.",
        });
        return false;
      }
    },
    [pedigree]
  );

  const load = useCallback((p: Pedigree | null) => dispatch({ type: "load", pedigree: p }), []);
  const select = useCallback((id: Id | null) => dispatch({ type: "select", id }), []);

  return useMemo(
    () => ({
      pedigree,
      selected: state.selected && pedigree?.individuals[state.selected] ? state.selected : null,
      error: state.error,
      canUndo: (state.history?.past.length ?? 0) > 0,
      canRedo: (state.history?.future.length ?? 0) > 0,
      load,
      run,
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      select,
      clearError: () => dispatch({ type: "error", message: null }),
    }),
    [pedigree, state, run, load, select]
  );
}
