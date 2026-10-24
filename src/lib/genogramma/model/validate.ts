import { isPartialDate } from "./age";
import { biologicalParents, connectedComponents, homeEntry, isBirthLink } from "./queries";
import type { Id, Pedigree } from "./types";

/**
 * Controlli di coerenza del grafo. Gli errori rendono il genogramma non
 * disegnabile in modo affidabile (import rifiutato o da correggere), gli
 * avvisi vanno solo mostrati.
 */
export type IssueCode =
  | "broken-ref"
  | "union-partners"
  | "self-union"
  | "child-is-partner"
  | "multiple-birth-parents"
  | "descent-cycle"
  | "twin-group"
  | "disconnected"
  | "invalid-date"
  | "duplicate-child";

export interface Issue {
  level: "error" | "warning";
  code: IssueCode;
  message: string;
  ids: Id[];
}

export function validate(ped: Pedigree): Issue[] {
  const issues: Issue[] = [];
  const has = (id: Id | undefined) => !!id && !!ped.individuals[id];
  const err = (code: IssueCode, message: string, ids: Id[] = []) =>
    issues.push({ level: "error", code, message, ids });
  const warn = (code: IssueCode, message: string, ids: Id[] = []) =>
    issues.push({ level: "warning", code, message, ids });

  if (ped.proband !== undefined && !has(ped.proband)) {
    err("broken-ref", "Il probando indicato non esiste.", [ped.proband]);
  }
  for (const c of ped.consultands) {
    if (!has(c)) err("broken-ref", "Un consultando indicato non esiste.", [c]);
  }

  const conditionIds = new Set(ped.legend.conditions.map((c) => c.id));
  const evaluationIds = new Set(ped.legend.evaluations.map((e) => e.id));
  for (const ind of Object.values(ped.individuals)) {
    for (const c of ind.conditions) {
      if (!conditionIds.has(c.conditionId)) {
        err("broken-ref", "Una condizione non è presente in legenda.", [ind.id]);
      }
    }
    for (const e of ind.evaluations) {
      if (e.evaluationId && !evaluationIds.has(e.evaluationId)) {
        err("broken-ref", "Una valutazione non è presente in legenda.", [ind.id]);
      }
    }
    for (const d of [ind.birth, ind.death?.date]) {
      if (typeof d === "string" && d !== "unknown" && !isPartialDate(d)) {
        warn("invalid-date", "Data non valida (usa AAAA, AAAA-MM o AAAA-MM-GG).", [ind.id]);
      }
    }
  }

  const birthCount = new Map<Id, number>();
  for (const u of Object.values(ped.unions)) {
    if (u.partners.length < 1 || u.partners.length > 2) {
      err("union-partners", "Un'unione deve avere uno o due partner.", u.partners);
    }
    if (u.partners.length === 2 && u.partners[0] === u.partners[1]) {
      err("self-union", "Un individuo non può essere partner di sé stesso.", u.partners);
    }
    for (const p of u.partners) {
      if (!has(p)) err("broken-ref", "Un partner indicato non esiste.", [p]);
    }
    const seen = new Set<Id>();
    for (const c of u.children) {
      if (!has(c.id)) err("broken-ref", "Un figlio indicato non esiste.", [c.id]);
      if (seen.has(c.id)) err("duplicate-child", "Lo stesso figlio compare due volte nella fratria.", [c.id]);
      seen.add(c.id);
      if (u.partners.includes(c.id)) {
        err("child-is-partner", "Un individuo non può essere figlio della propria unione.", [c.id]);
      }
      if (isBirthLink(c)) birthCount.set(c.id, (birthCount.get(c.id) ?? 0) + 1);
      for (const ref of [c.art?.eggFrom, c.art?.spermFrom, c.art?.carriedBy, c.art?.mitoFrom]) {
        if (ref !== undefined && !has(ref)) err("broken-ref", "Un donatore o una gestante non esiste.", [c.id]);
      }
    }
  }
  for (const [id, n] of birthCount) {
    if (n > 1) {
      err("multiple-birth-parents", "Un figlio biologico può appartenere a una sola unione.", [id]);
    }
  }

  const cycle = findDescentCycle(ped);
  if (cycle) err("descent-cycle", "Un individuo risulta antenato di sé stesso.", cycle);

  const groups = new Map<Id, Id[]>();
  for (const ind of Object.values(ped.individuals)) {
    if (ind.twin) groups.set(ind.twin.groupId, [...(groups.get(ind.twin.groupId) ?? []), ind.id]);
  }
  for (const members of groups.values()) {
    if (members.length < 2) {
      warn("twin-group", "Un gemello non ha il proprio gemello nel genogramma.", members);
      continue;
    }
    const homes = new Set(members.map((m) => homeEntry(ped, m)?.union.id ?? "-"));
    if (homes.size > 1) err("twin-group", "I gemelli devono appartenere alla stessa fratria.", members);
  }

  const components = connectedComponents(ped);
  if (components.length > 1) {
    warn(
      "disconnected",
      `Il genogramma ha ${components.length} gruppi di familiari non collegati tra loro.`,
      components.slice(1).flat()
    );
  }
  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/** Ciclo nella discendenza biologica (DFS a tre colori). */
function findDescentCycle(ped: Pedigree): Id[] | null {
  const state = new Map<Id, 1 | 2>();
  const stack: Id[] = [];
  const visit = (id: Id): Id[] | null => {
    state.set(id, 1);
    stack.push(id);
    for (const p of biologicalParents(ped, id)) {
      if (!ped.individuals[p]) continue;
      const s = state.get(p);
      if (s === 1) return stack.slice(stack.indexOf(p));
      if (s === undefined) {
        const found = visit(p);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of Object.keys(ped.individuals)) {
    if (!state.has(id)) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}
