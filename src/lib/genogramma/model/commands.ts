import { createIndividual, createUnion, nextConditionStyle, type IdFactory } from "./create";
import {
  canAddParents,
  childEntriesOf,
  connectedComponents,
  homeEntry,
  isBirthLink,
  isFemaleLike,
  isMaleLike,
  unionsOf,
} from "./queries";
import { orderChildren } from "./sibling-order";
import type {
  ChildLink,
  ChildLinkType,
  ConditionCode,
  ConditionStatus,
  DisplaySettings,
  Id,
  Individual,
  IndividualCondition,
  LegendCondition,
  Pedigree,
  PedigreeMeta,
  Twin,
  Union,
} from "./types";

/**
 * Comandi immutabili: ogni mutazione riceve un genogramma e ne restituisce
 * uno nuovo (condivisione strutturale), così undo/redo è una pila di
 * istantanee (`history.ts`). Nessun comando tocca DOM, rete o storage.
 */

export class GenogramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenogramError";
  }
}

export type NewIndividual = Partial<Omit<Individual, "id">>;

function nextSequence(ped: Pedigree): number {
  let max = 0;
  for (const u of Object.values(ped.unions)) max = Math.max(max, u.sequence);
  return max + 1;
}

function requireIndividual(ped: Pedigree, id: Id): Individual {
  const ind = ped.individuals[id];
  if (!ind) throw new GenogramError("Familiare non trovato.");
  return ind;
}

function requireUnion(ped: Pedigree, id: Id): Union {
  const u = ped.unions[id];
  if (!u) throw new GenogramError("Unione non trovata.");
  return u;
}

function withIndividual(ped: Pedigree, ind: Individual): Pedigree {
  return { ...ped, individuals: { ...ped.individuals, [ind.id]: ind } };
}

function withUnion(ped: Pedigree, union: Union): Pedigree {
  return { ...ped, unions: { ...ped.unions, [union.id]: union } };
}

/** Sesso e genere "opposti" per il nuovo partner o genitore mancante. */
function oppositeOf(ind: Individual | undefined): Pick<Individual, "sex" | "gender"> {
  if (isMaleLike(ind)) return { sex: "female", gender: "woman" };
  if (isFemaleLike(ind)) return { sex: "male", gender: "man" };
  return { sex: "unknown", gender: "unknown" };
}

/* ------------------------------------------------------------------ */
/* Individui                                                           */
/* ------------------------------------------------------------------ */

export function addIndividual(ped: Pedigree, ind: Individual): Pedigree {
  if (ped.individuals[ind.id]) throw new GenogramError("ID già usato.");
  return withIndividual(ped, ind);
}

export function updateIndividual(
  ped: Pedigree,
  id: Id,
  patch: Partial<Omit<Individual, "id">> | ((ind: Individual) => Individual)
): Pedigree {
  const ind = requireIndividual(ped, id);
  const next = typeof patch === "function" ? patch(ind) : { ...ind, ...patch };
  return withIndividual(ped, { ...next, id });
}

export function setProband(ped: Pedigree, id: Id | undefined): Pedigree {
  if (id !== undefined) requireIndividual(ped, id);
  return { ...ped, proband: id };
}

export function toggleConsultand(ped: Pedigree, id: Id): Pedigree {
  requireIndividual(ped, id);
  const has = ped.consultands.includes(id);
  return {
    ...ped,
    consultands: has ? ped.consultands.filter((x) => x !== id) : [...ped.consultands, id],
  };
}

/* ------------------------------------------------------------------ */
/* Aggiunta di familiari                                               */
/* ------------------------------------------------------------------ */

export interface Created {
  pedigree: Pedigree;
  created: Id[];
  unionId?: Id;
}

/**
 * Aggiunge i genitori mancanti del tipo indicato. Con un solo genitore
 * noto aggiunge solo l'altro, nella stessa unione (i figli restano dove sono).
 */
export function addParents(
  ped: Pedigree,
  childId: Id,
  ids: IdFactory,
  opts: { kind?: "biological" | "adoptive"; fields?: [NewIndividual?, NewIndividual?] } = {}
): Created {
  requireIndividual(ped, childId);
  const kind = opts.kind ?? "biological";
  const check = canAddParents(ped, childId, kind);
  if (!check.allowed) throw new GenogramError(check.reason ?? "Genitori già presenti.");

  if (check.unionId) {
    const union = requireUnion(ped, check.unionId);
    const existing = ped.individuals[union.partners[0]];
    const id = ids();
    const parent = createIndividual(id, { ...oppositeOf(existing), ...opts.fields?.[0] });
    let next = withIndividual(ped, parent);
    const partners = isMaleLike(parent) ? [id, ...union.partners] : [...union.partners, id];
    next = withUnion(next, { ...union, partners });
    return { pedigree: next, created: [id], unionId: union.id };
  }

  const fatherId = ids();
  const motherId = ids();
  const unionId = ids();
  const father = createIndividual(fatherId, { sex: "male", gender: "man", ...opts.fields?.[0] });
  const mother = createIndividual(motherId, { sex: "female", gender: "woman", ...opts.fields?.[1] });
  const link: ChildLinkType = kind === "adoptive" ? "adoptive" : "biological";
  const union = createUnion(unionId, [fatherId, motherId], {
    sequence: nextSequence(ped),
    children: [{ id: childId, link }],
  });
  let next = withIndividual(withIndividual(ped, father), mother);
  next = withUnion(next, union);
  return { pedigree: next, created: [fatherId, motherId], unionId };
}

/**
 * Aggiunge un fratello o una sorella nella stessa unione "casa".
 * Se l'individuo non ha genitori, li crea (servono per la linea di fratria).
 */
export function addSibling(
  ped: Pedigree,
  id: Id,
  fields: NewIndividual,
  ids: IdFactory,
  opts: { link?: ChildLinkType } = {}
): Created {
  requireIndividual(ped, id);
  let next = ped;
  const created: Id[] = [];
  let entry = homeEntry(next, id);
  if (!entry) {
    const res = addParents(next, id, ids);
    next = res.pedigree;
    created.push(...res.created);
    entry = homeEntry(next, id)!;
  }
  const sibId = ids();
  const sib = createIndividual(sibId, fields);
  next = withIndividual(next, sib);
  const union = next.unions[entry.union.id];
  const at = union.children.findIndex((c) => c.id === id);
  const children = [...union.children];
  children.splice(at + 1, 0, { id: sibId, link: opts.link ?? "biological" });
  next = withUnion(next, { ...union, children });
  created.push(sibId);
  return { pedigree: next, created, unionId: union.id };
}

/** Unione esistente tra esattamente questi partner (la più recente). */
export function findUnion(ped: Pedigree, partners: Id[]): Union | undefined {
  const key = [...partners].sort().join("|");
  return unionsOf(ped, partners[0])
    .filter((u) => [...u.partners].sort().join("|") === key)
    .pop();
}

/**
 * Aggiunge un figlio. `partner`: un individuo esistente, "new" (crea un
 * partner) o "none" (genitore senza partner noto: unione con un solo
 * partner, linea dal singolo).
 */
export function addChild(
  ped: Pedigree,
  parentId: Id,
  fields: NewIndividual,
  ids: IdFactory,
  opts: { partner: Id | "new" | "none"; link?: ChildLinkType; art?: ChildLink["art"] }
): Created {
  const parent = requireIndividual(ped, parentId);
  let next = ped;
  const created: Id[] = [];
  let partners: Id[];
  if (opts.partner === "none") {
    partners = [parentId];
  } else if (opts.partner === "new") {
    const pid = ids();
    next = withIndividual(next, createIndividual(pid, oppositeOf(parent)));
    created.push(pid);
    partners = [parentId, pid];
  } else {
    requireIndividual(ped, opts.partner);
    if (opts.partner === parentId) throw new GenogramError("Un individuo non può essere partner di sé stesso.");
    partners = [parentId, opts.partner];
  }
  let union = findUnion(next, partners);
  if (!union) {
    union = createUnion(ids(), orderPartners(next, partners), { sequence: nextSequence(next) });
  }
  const childId = ids();
  next = withIndividual(next, createIndividual(childId, fields));
  const link: ChildLink = { id: childId, link: opts.link ?? (opts.art ? "art" : "biological") };
  if (opts.art) link.art = opts.art;
  next = withUnion(next, { ...union, children: [...union.children, link] });
  created.push(childId);
  return { pedigree: next, created, unionId: union.id };
}

function orderPartners(ped: Pedigree, partners: Id[]): Id[] {
  if (partners.length < 2) return partners;
  const [a, b] = partners;
  if (isFemaleLike(ped.individuals[a]) && isMaleLike(ped.individuals[b])) return [b, a];
  return partners;
}

/** Aggiunge un nuovo partner (nuova unione, cronologicamente l'ultima). */
export function addPartner(
  ped: Pedigree,
  id: Id,
  fields: NewIndividual,
  ids: IdFactory
): Created {
  const ind = requireIndividual(ped, id);
  const pid = ids();
  const partner = createIndividual(pid, { ...oppositeOf(ind), ...fields });
  let next = withIndividual(ped, partner);
  const unionId = ids();
  next = withUnion(
    next,
    createUnion(unionId, orderPartners(next, [id, pid]), { sequence: nextSequence(ped) })
  );
  return { pedigree: next, created: [pid], unionId };
}

/** Collega due individui esistenti (es. coppia consanguinea). */
export function addUnion(ped: Pedigree, a: Id, b: Id, ids: IdFactory, fields: Partial<Union> = {}): Created {
  requireIndividual(ped, a);
  requireIndividual(ped, b);
  if (a === b) throw new GenogramError("Un individuo non può essere partner di sé stesso.");
  const unionId = ids();
  const union = createUnion(unionId, orderPartners(ped, [a, b]), {
    sequence: nextSequence(ped),
    ...fields,
  });
  return { pedigree: withUnion(ped, { ...union, id: unionId }), created: [], unionId };
}

export function updateUnion(
  ped: Pedigree,
  unionId: Id,
  patch: Partial<Omit<Union, "id">>
): Pedigree {
  const u = requireUnion(ped, unionId);
  return withUnion(ped, { ...u, ...patch, id: unionId });
}

export function updateChildLink(
  ped: Pedigree,
  unionId: Id,
  childId: Id,
  patch: Partial<Omit<ChildLink, "id">>
): Pedigree {
  const u = requireUnion(ped, unionId);
  return withUnion(ped, {
    ...u,
    children: u.children.map((c) => (c.id === childId ? { ...c, ...patch, id: childId } : c)),
  });
}

/* ------------------------------------------------------------------ */
/* Ordine della fratria (drag)                                         */
/* ------------------------------------------------------------------ */

/**
 * Sposta un figlio nella posizione `toIndex` dell'ordine visibile. Cambia
 * solo `union.children`: partner e discendenti seguono il figlio nel layout.
 */
export function moveChild(ped: Pedigree, unionId: Id, childId: Id, toIndex: number): Pedigree {
  const u = requireUnion(ped, unionId);
  const visible = orderChildren(ped, u);
  const from = visible.indexOf(childId);
  if (from < 0) throw new GenogramError("Il familiare non appartiene a questa fratria.");
  const order = [...visible];
  order.splice(from, 1);
  order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, childId);
  const byId = new Map(u.children.map((c) => [c.id, c]));
  const children = order.map((id) => byId.get(id)!).filter(Boolean);
  // Figli non visibili (riferimenti rotti) restano in coda.
  for (const c of u.children) if (!order.includes(c.id)) children.push(c);
  return withUnion(ped, { ...u, children, childOrder: "manual" });
}

/** Ripristina l'ordine automatico (età, poi inserimento). */
export function resetChildOrder(ped: Pedigree, unionId: Id): Pedigree {
  const u = requireUnion(ped, unionId);
  return withUnion(ped, { ...u, childOrder: "auto" });
}

/* ------------------------------------------------------------------ */
/* Eliminazione                                                        */
/* ------------------------------------------------------------------ */

export interface RemovalPlan {
  /** Individui che verrebbero rimossi (incluso chi resterebbe isolato). */
  ids: Id[];
  /** Discendenti che l'utente può scegliere di eliminare o mantenere. */
  descendants: Id[];
  /** La rimozione dividerebbe il genogramma: proporre il segnaposto. */
  disconnects: boolean;
  blocked?: string;
}

function descendantsOf(ped: Pedigree, id: Id): Id[] {
  const out: Id[] = [];
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    for (const u of unionsOf(ped, x)) {
      for (const c of u.children) {
        if (!out.includes(c.id) && c.id !== id) {
          out.push(c.id);
          stack.push(c.id);
        }
      }
    }
  }
  return out;
}

export function planRemoval(ped: Pedigree, id: Id, withDescendants: boolean): RemovalPlan {
  requireIndividual(ped, id);
  const descendants = descendantsOf(ped, id);
  if (ped.proband === id) {
    return {
      ids: [id],
      descendants,
      disconnects: false,
      blocked: "Il probando non si può eliminare: scegline prima un altro.",
    };
  }
  if (withDescendants && ped.proband && descendants.includes(ped.proband)) {
    return {
      ids: [id],
      descendants,
      disconnects: false,
      blocked: "Tra i discendenti c'è il probando: scegline prima un altro o elimina senza discendenti.",
    };
  }
  const remove = new Set<Id>([id, ...(withDescendants ? descendants : [])]);
  // Partner che resterebbero isolati (entrati in famiglia, senza altri legami).
  let changed = true;
  while (changed) {
    changed = false;
    for (const pid of Object.keys(ped.individuals)) {
      if (remove.has(pid) || pid === ped.proband) continue;
      if (isIsolatedAfter(ped, pid, remove)) {
        remove.add(pid);
        changed = true;
      }
    }
  }
  const trial = applyRemovalSet(ped, remove);
  const before = connectedComponents(ped).length;
  const after = connectedComponents(trial).length;
  return { ids: [...remove], descendants, disconnects: after > before };
}

function isIsolatedAfter(ped: Pedigree, id: Id, removed: Set<Id>): boolean {
  if (childEntriesOf(ped, id).some((e) => e.union.partners.some((p) => !removed.has(p)))) return false;
  for (const u of unionsOf(ped, id)) {
    if (u.partners.some((p) => p !== id && !removed.has(p))) return false;
    if (u.children.some((c) => !removed.has(c.id))) return false;
  }
  for (const u of Object.values(ped.unions)) {
    for (const c of u.children) {
      const art = c.art;
      if (!art || removed.has(c.id)) continue;
      if ([art.eggFrom, art.spermFrom, art.carriedBy, art.mitoFrom].includes(id)) return false;
    }
  }
  // Un individuo senza alcun legame fin dall'inizio non viene toccato.
  const hadLinks =
    childEntriesOf(ped, id).length > 0 || unionsOf(ped, id).length > 0;
  return hadLinks;
}

function applyRemovalSet(ped: Pedigree, remove: Set<Id>): Pedigree {
  const individuals: Record<Id, Individual> = {};
  for (const [k, v] of Object.entries(ped.individuals)) {
    if (!remove.has(k)) individuals[k] = v;
  }
  const unions: Record<Id, Union> = {};
  for (const [k, u] of Object.entries(ped.unions)) {
    const partners = u.partners.filter((p) => !remove.has(p));
    const children = u.children
      .filter((c) => !remove.has(c.id))
      .map((c) => (c.art ? { ...c, art: pruneArt(c.art, remove) } : c));
    if (partners.length === 0) continue;
    if (partners.length === 1 && u.partners.length === 2 && children.length === 0) continue;
    unions[k] = { ...u, partners, children };
  }
  return {
    ...ped,
    individuals,
    unions,
    consultands: ped.consultands.filter((c) => !remove.has(c)),
  };
}

function pruneArt(art: NonNullable<ChildLink["art"]>, remove: Set<Id>): ChildLink["art"] {
  const out = { ...art };
  for (const key of ["eggFrom", "spermFrom", "carriedBy", "mitoFrom"] as const) {
    if (out[key] && remove.has(out[key]!)) delete out[key];
  }
  return out;
}

/**
 * Applica una rimozione pianificata. Rifiuta se il probando è coinvolto o
 * se il genogramma si dividerebbe (in quel caso usare `replaceWithPlaceholder`).
 */
export function removeIndividual(ped: Pedigree, id: Id, withDescendants: boolean): Pedigree {
  const plan = planRemoval(ped, id, withDescendants);
  if (plan.blocked) throw new GenogramError(plan.blocked);
  if (plan.disconnects) {
    throw new GenogramError(
      "L'eliminazione dividerebbe il genogramma: sostituisci il familiare con un segnaposto ignoto."
    );
  }
  return applyRemovalSet(ped, new Set(plan.ids));
}

/** Sostituisce un individuo "ponte" con un segnaposto ignoto (mantiene i legami). */
export function replaceWithPlaceholder(ped: Pedigree, id: Id): Pedigree {
  const ind = requireIndividual(ped, id);
  if (ped.proband === id) throw new GenogramError("Il probando non si può sostituire.");
  return withIndividual(
    { ...ped, consultands: ped.consultands.filter((c) => c !== id) },
    createIndividual(id, {
      sex: ind.sex,
      gender: ind.gender,
      vital: "unknown",
      placeholder: true,
      twin: ind.twin,
    })
  );
}

/* ------------------------------------------------------------------ */
/* Gemelli, individui multipli                                         */
/* ------------------------------------------------------------------ */

export function setTwins(
  ped: Pedigree,
  memberIds: Id[],
  zygosity: Twin["zygosity"],
  ids: IdFactory,
  proven = false
): Pedigree {
  if (memberIds.length < 2) throw new GenogramError("Servono almeno due gemelli.");
  const homes = memberIds.map((m) => homeEntry(ped, m)?.union.id);
  if (!homes[0] || homes.some((h) => h !== homes[0])) {
    throw new GenogramError("I gemelli devono appartenere alla stessa fratria.");
  }
  const groupId = ped.individuals[memberIds[0]].twin?.groupId ?? ids();
  let next = ped;
  for (const m of memberIds) {
    next = updateIndividual(next, m, { twin: { groupId, zygosity, proven } });
  }
  return next;
}

export function clearTwin(ped: Pedigree, id: Id): Pedigree {
  return updateIndividual(ped, id, (ind) => {
    const copy = { ...ind };
    delete copy.twin;
    return copy;
  });
}

/** Espande un simbolo "N individui" in N individui singoli nella stessa fratria. */
export function expandMultiple(ped: Pedigree, id: Id, ids: IdFactory, count?: number): Created {
  const ind = requireIndividual(ped, id);
  const n = typeof ind.multiple === "number" ? ind.multiple : count;
  if (!n || n < 2) throw new GenogramError("Indica quanti individui rappresenta il simbolo.");
  let next = updateIndividual(ped, id, (x) => {
    const copy = { ...x };
    delete copy.multiple;
    return copy;
  });
  const created: Id[] = [];
  const entry = homeEntry(next, id);
  for (let i = 1; i < n; i++) {
    const base: NewIndividual = { sex: ind.sex, gender: ind.gender, vital: ind.vital };
    if (entry) {
      const res = addSibling(next, created[created.length - 1] ?? id, base, ids, {
        link: entry.link.link,
      });
      next = res.pedigree;
      created.push(...res.created);
    } else {
      const cid = ids();
      next = withIndividual(next, createIndividual(cid, base));
      created.push(cid);
    }
  }
  return { pedigree: next, created };
}

/* ------------------------------------------------------------------ */
/* Legenda, condizioni, valutazioni                                    */
/* ------------------------------------------------------------------ */

export function addLegendCondition(
  ped: Pedigree,
  label: string,
  ids: IdFactory,
  codes: ConditionCode[] = []
): { pedigree: Pedigree; id: Id } {
  const id = ids();
  const style = nextConditionStyle(ped.legend.conditions);
  const cond: LegendCondition = { id, label: label.trim() || "Condizione", codes, ...style };
  return {
    pedigree: { ...ped, legend: { ...ped.legend, conditions: [...ped.legend.conditions, cond] } },
    id,
  };
}

export function updateLegendCondition(
  ped: Pedigree,
  id: Id,
  patch: Partial<Omit<LegendCondition, "id">>
): Pedigree {
  return {
    ...ped,
    legend: {
      ...ped.legend,
      conditions: ped.legend.conditions.map((c) => (c.id === id ? { ...c, ...patch, id } : c)),
    },
  };
}

/** Rimuove la condizione dalla legenda e da tutti gli individui. */
export function removeLegendCondition(ped: Pedigree, id: Id): Pedigree {
  const individuals: Record<Id, Individual> = {};
  for (const [k, ind] of Object.entries(ped.individuals)) {
    individuals[k] = ind.conditions.some((c) => c.conditionId === id)
      ? { ...ind, conditions: ind.conditions.filter((c) => c.conditionId !== id) }
      : ind;
  }
  return {
    ...ped,
    individuals,
    legend: { ...ped.legend, conditions: ped.legend.conditions.filter((c) => c.id !== id) },
  };
}

export function setIndividualCondition(
  ped: Pedigree,
  id: Id,
  conditionId: Id,
  value: Omit<IndividualCondition, "conditionId"> | null
): Pedigree {
  if (!ped.legend.conditions.some((c) => c.id === conditionId)) {
    throw new GenogramError("Condizione non presente in legenda.");
  }
  return updateIndividual(ped, id, (ind) => {
    const rest = ind.conditions.filter((c) => c.conditionId !== conditionId);
    const conditions = value ? [...rest, { conditionId, ...value }] : rest;
    // Mantiene l'ordine della legenda (determina i settori del simbolo).
    const order = new Map(ped.legend.conditions.map((c, i) => [c.id, i]));
    conditions.sort((a, b) => (order.get(a.conditionId) ?? 0) - (order.get(b.conditionId) ?? 0));
    return { ...ind, conditions };
  });
}

export function conditionStatusOf(ind: Individual, conditionId: Id): ConditionStatus | null {
  return ind.conditions.find((c) => c.conditionId === conditionId)?.status ?? null;
}

export function addLegendEvaluation(
  ped: Pedigree,
  label: string,
  ids: IdFactory
): { pedigree: Pedigree; id: Id } {
  const id = ids();
  return {
    pedigree: {
      ...ped,
      legend: { ...ped.legend, evaluations: [...ped.legend.evaluations, { id, label }] },
    },
    id,
  };
}

export function removeLegendEvaluation(ped: Pedigree, id: Id): Pedigree {
  const individuals: Record<Id, Individual> = {};
  for (const [k, ind] of Object.entries(ped.individuals)) {
    individuals[k] = ind.evaluations.some((e) => e.evaluationId === id)
      ? { ...ind, evaluations: ind.evaluations.filter((e) => e.evaluationId !== id) }
      : ind;
  }
  return {
    ...ped,
    individuals,
    legend: { ...ped.legend, evaluations: ped.legend.evaluations.filter((e) => e.id !== id) },
  };
}

/* ------------------------------------------------------------------ */
/* Metadati e impostazioni                                             */
/* ------------------------------------------------------------------ */

export function updateMeta(ped: Pedigree, patch: Partial<PedigreeMeta>): Pedigree {
  return { ...ped, meta: { ...ped.meta, ...patch } };
}

export function updateDisplay(ped: Pedigree, patch: Partial<DisplaySettings>): Pedigree {
  return { ...ped, display: { ...ped.display, ...patch } };
}

export function setPedigreeDate(ped: Pedigree, date: string): Pedigree {
  return { ...ped, date };
}

/** Vero se l'individuo ha già un legame di nascita (biologico o ART). */
export function hasBirthParents(ped: Pedigree, id: Id): boolean {
  return childEntriesOf(ped, id).some((e) => isBirthLink(e.link));
}
