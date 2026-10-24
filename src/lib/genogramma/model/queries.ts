import type { ChildLink, Id, Individual, Pedigree, Union } from "./types";

/**
 * Interrogazioni pure sul grafo del genogramma. Le relazioni sono
 * esplicite nelle unioni; tutto ciò che è "rispetto al probando" si calcola.
 */

export interface ChildEntry {
  union: Union;
  link: ChildLink;
}

/** Tutte le unioni in cui l'individuo compare come figlio. */
export function childEntriesOf(ped: Pedigree, id: Id): ChildEntry[] {
  const out: ChildEntry[] = [];
  for (const union of Object.values(ped.unions)) {
    for (const link of union.children) {
      if (link.id === id) out.push({ union, link });
    }
  }
  return out;
}

/** Unioni in cui l'individuo è partner, in ordine cronologico. */
export function unionsOf(ped: Pedigree, id: Id): Union[] {
  return Object.values(ped.unions)
    .filter((u) => u.partners.includes(id))
    .sort((a, b) => a.sequence - b.sequence);
}

export function partnersOf(ped: Pedigree, id: Id): Id[] {
  const out: Id[] = [];
  for (const u of unionsOf(ped, id)) {
    for (const p of u.partners) if (p !== id && !out.includes(p)) out.push(p);
  }
  return out;
}

export function isBirthLink(link: ChildLink): boolean {
  return link.link === "biological" || link.link === "art";
}

/**
 * Unione "casa" in cui l'individuo è disegnato come figlio:
 * adottato fuori → genitori biologici; adottato dentro o da un parente →
 * genitori adottivi; altrimenti biologica, ART, affidataria.
 */
export function homeEntry(ped: Pedigree, id: Id): ChildEntry | undefined {
  const entries = childEntriesOf(ped, id);
  if (entries.length === 0) return undefined;
  const birth = entries.find((e) => isBirthLink(e.link));
  if (birth?.link.adoptedOut) return birth;
  return (
    entries.find((e) => e.link.link === "adoptive") ??
    birth ??
    entries.find((e) => e.link.link === "foster") ??
    entries[0]
  );
}

/**
 * Genitori genetici di un figlio in una data unione. Con ART contano chi
 * ha fornito ovocita e seme (un partner o un donatore); se il dettaglio
 * manca, si assumono i partner.
 */
export function geneticParentsIn(union: Union, link: ChildLink): Id[] {
  if (link.link === "biological") return [...union.partners];
  if (link.link !== "art") return [];
  const art = link.art ?? {};
  const out: Id[] = [];
  if (art.eggFrom) out.push(art.eggFrom);
  if (art.spermFrom && art.spermFrom !== art.eggFrom) out.push(art.spermFrom);
  if (!art.eggFrom && !art.spermFrom) out.push(...union.partners);
  return out;
}

export interface Parents {
  biological: Id[];
  adoptive: Id[];
  foster: Id[];
  /** Genitori intenzionali di un figlio nato da ART (partner dell'unione). */
  intended: Id[];
  donors: { id: Id; gamete: "egg" | "sperm" | "mito" }[];
  /** Gestante per altri o surrogata (non partner dell'unione). */
  carrier?: Id;
}

export function getParents(ped: Pedigree, id: Id): Parents {
  const res: Parents = { biological: [], adoptive: [], foster: [], intended: [], donors: [] };
  const add = (list: Id[], ids: Id[]) => {
    for (const x of ids) if (!list.includes(x)) list.push(x);
  };
  for (const { union, link } of childEntriesOf(ped, id)) {
    if (link.link === "adoptive") add(res.adoptive, union.partners);
    else if (link.link === "foster") add(res.foster, union.partners);
    else {
      add(res.biological, geneticParentsIn(union, link));
      if (link.link === "art") {
        add(res.intended, union.partners);
        const art = link.art ?? {};
        const isPartner = (x?: Id) => !!x && union.partners.includes(x);
        if (art.eggFrom && !isPartner(art.eggFrom)) res.donors.push({ id: art.eggFrom, gamete: "egg" });
        if (art.spermFrom && !isPartner(art.spermFrom))
          res.donors.push({ id: art.spermFrom, gamete: "sperm" });
        if (art.mitoFrom) res.donors.push({ id: art.mitoFrom, gamete: "mito" });
        if (art.carriedBy && !isPartner(art.carriedBy)) res.carrier = art.carriedBy;
      }
    }
  }
  return res;
}

/** Genitori biologici (genetici) di un individuo. */
export function biologicalParents(ped: Pedigree, id: Id): Id[] {
  return getParents(ped, id).biological;
}

/** Figli biologici (genetici) di un individuo, in tutte le unioni e come donatore. */
export function biologicalChildren(ped: Pedigree, id: Id): Id[] {
  const out: Id[] = [];
  for (const union of Object.values(ped.unions)) {
    for (const link of union.children) {
      if (geneticParentsIn(union, link).includes(id) && !out.includes(link.id)) out.push(link.id);
    }
  }
  return out;
}

/** Lato "maschile" della coppia per le convenzioni di disegno e di parentela. */
export function isMaleLike(ind: Individual | undefined): boolean {
  if (!ind) return false;
  if (ind.gender === "man") return true;
  if (ind.gender === "woman" || ind.gender === "non-binary") return false;
  return ind.sex === "male";
}

export function isFemaleLike(ind: Individual | undefined): boolean {
  if (!ind) return false;
  if (ind.gender === "woman") return true;
  if (ind.gender === "man" || ind.gender === "non-binary") return false;
  return ind.sex === "female";
}

export interface Siblings {
  full: Id[];
  half: { id: Id; side: "paternal" | "maternal" | "unknown" }[];
  /** Fratelli nella stessa unione senza legame biologico (adozione, affido). */
  social: Id[];
}

export function getSiblings(ped: Pedigree, id: Id): Siblings {
  const res: Siblings = { full: [], half: [], social: [] };
  const mine = biologicalParents(ped, id);
  const seen = new Set<Id>([id]);
  const candidates: Id[] = [];
  for (const { union } of childEntriesOf(ped, id)) {
    for (const c of union.children) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        candidates.push(c.id);
      }
    }
  }
  for (const p of mine) {
    for (const c of biologicalChildren(ped, p)) {
      if (!seen.has(c)) {
        seen.add(c);
        candidates.push(c);
      }
    }
  }
  for (const c of candidates) {
    const theirs = biologicalParents(ped, c);
    const shared = theirs.filter((p) => mine.includes(p));
    if (shared.length === 0) res.social.push(c);
    else if (shared.length >= 2 || (shared.length === mine.length && mine.length === theirs.length)) {
      res.full.push(c);
    } else {
      const parent = ped.individuals[shared[0]];
      const side = isMaleLike(parent) ? "paternal" : isFemaleLike(parent) ? "maternal" : "unknown";
      res.half.push({ id: c, side });
    }
  }
  return res;
}

export interface CanAddParents {
  allowed: boolean;
  /** Quanti genitori del tipo richiesto mancano (0, 1 o 2). */
  missing: number;
  /** Unione esistente da completare (genitore solo). */
  unionId?: Id;
  reason?: string;
}

/**
 * Si possono aggiungere genitori del tipo indicato? Contano solo i genitori
 * di quel tipo: adottivi e ART non bloccano né duplicano quelli biologici.
 */
export function canAddParents(
  ped: Pedigree,
  id: Id,
  kind: "biological" | "adoptive" = "biological"
): CanAddParents {
  const entries = childEntriesOf(ped, id).filter((e) =>
    kind === "biological" ? isBirthLink(e.link) : e.link.link === "adoptive"
  );
  if (entries.length === 0) return { allowed: true, missing: 2 };
  const { union, link } = entries[0];
  const count = kind === "biological" ? geneticParentsIn(union, link).length : union.partners.length;
  if (union.partners.length < 2 && count < 2) {
    return { allowed: true, missing: 2 - union.partners.length, unionId: union.id };
  }
  return {
    allowed: false,
    missing: 0,
    unionId: union.id,
    reason:
      kind === "biological"
        ? "Ha già entrambi i genitori biologici."
        : "Ha già entrambi i genitori adottivi.",
  };
}

/* ------------------------------------------------------------------ */
/* Antenati, consanguineità                                            */
/* ------------------------------------------------------------------ */

/** Antenati biologici con la distanza minima (1 = genitore). */
export function ancestorDistances(ped: Pedigree, id: Id): Map<Id, number> {
  const dist = new Map<Id, number>();
  let frontier = [id];
  let d = 0;
  while (frontier.length > 0 && d < 64) {
    d += 1;
    const next: Id[] = [];
    for (const x of frontier) {
      for (const p of biologicalParents(ped, x)) {
        if (!dist.has(p) && p !== id) {
          dist.set(p, d);
          next.push(p);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

/** Vero se `ancestor` è un antenato biologico di `id`. */
export function isAncestor(ped: Pedigree, ancestor: Id, id: Id): boolean {
  return ancestorDistances(ped, id).has(ancestor);
}

/** Tutti i cammini (lista di nodi, escluso l'origine) da `id` a ciascun antenato. */
function ancestorPaths(ped: Pedigree, id: Id, cap = 5000): Map<Id, Id[][]> {
  const paths = new Map<Id, Id[][]>();
  let count = 0;
  const walk = (x: Id, path: Id[]) => {
    for (const p of biologicalParents(ped, x)) {
      if (path.includes(p) || p === id || count > cap) continue;
      const next = [...path, p];
      count += 1;
      const list = paths.get(p) ?? [];
      list.push(next);
      paths.set(p, list);
      walk(p, next);
    }
  };
  walk(id, []);
  return paths;
}

export interface Consanguinity {
  related: boolean;
  /** Antenati comuni più vicini. */
  commonAncestors: Id[];
  /** Generazioni da a e da b all'antenato comune più vicino. */
  steps?: [number, number];
  /** Grado in italiano, es. "cugini di primo grado". */
  label?: string;
  /** Coefficiente di parentela di Wright (antenati comuni considerati non inbred). */
  kinship: number;
}

export function detectConsanguinity(ped: Pedigree, a: Id, b: Id): Consanguinity {
  if (a === b) return { related: false, commonAncestors: [], kinship: 0 };
  const pa = ancestorPaths(ped, a);
  const pb = ancestorPaths(ped, b);
  // Uno dei due è antenato dell'altro (es. zio–nipote no, nonno–nipote sì).
  const common = new Set<Id>();
  for (const x of pa.keys()) if (pb.has(x)) common.add(x);
  if (pa.has(b)) common.add(b);
  if (pb.has(a)) common.add(a);
  if (common.size === 0) return { related: false, commonAncestors: [], kinship: 0 };

  const pathsFrom = (from: Map<Id, Id[][]>, self: Id, anc: Id): Id[][] =>
    anc === self ? [[]] : (from.get(anc) ?? []);

  let kinship = 0;
  let best = Infinity;
  let bestSteps: [number, number] = [0, 0];
  const nearest: Id[] = [];
  for (const anc of common) {
    const p1s = pathsFrom(pa, a, anc);
    const p2s = pathsFrom(pb, b, anc);
    for (const p1 of p1s) {
      for (const p2 of p2s) {
        const inner1 = new Set(p1.slice(0, -1));
        if (p2.slice(0, -1).some((x) => inner1.has(x))) continue;
        if (p1.includes(b) || p2.includes(a)) continue;
        kinship += Math.pow(0.5, p1.length + p2.length + 1);
      }
    }
    const d1 = Math.min(...p1s.map((p) => p.length));
    const d2 = Math.min(...p2s.map((p) => p.length));
    if (d1 + d2 < best) {
      best = d1 + d2;
      bestSteps = [d1, d2];
      nearest.length = 0;
      nearest.push(anc);
    } else if (d1 + d2 === best) {
      nearest.push(anc);
    }
  }
  return {
    related: true,
    commonAncestors: nearest,
    steps: bestSteps,
    label: pairLabel(bestSteps[0], bestSteps[1]),
    kinship,
  };
}

const ORDINALS = ["primo", "secondo", "terzo", "quarto", "quinto", "sesto"];

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}°`;
}

/** Grado di parentela di una coppia, dalle distanze dall'antenato comune. */
export function pairLabel(da: number, db: number): string {
  const [lo, hi] = da <= db ? [da, db] : [db, da];
  if (lo === 0) {
    if (hi === 1) return "genitore e figlio";
    if (hi === 2) return "nonno e nipote";
    return `antenato e discendente (${hi} generazioni)`;
  }
  if (lo === 1 && hi === 1) return "fratelli";
  if (lo === 1 && hi === 2) return "zio e nipote";
  if (lo === 1) return `prozio e pronipote (${hi - 1} generazioni)`;
  const degree = lo - 1;
  const removed = hi - lo;
  const base = `cugini di ${ordinal(degree)} grado`;
  if (removed === 0) return base;
  return `${base}, ${removed === 1 ? "una generazione" : `${removed} generazioni`} di distanza`;
}

/* ------------------------------------------------------------------ */
/* Relazione rispetto al probando                                      */
/* ------------------------------------------------------------------ */

function word(ind: Individual | undefined, m: string, f: string, n?: string): string {
  if (isMaleLike(ind)) return m;
  if (isFemaleLike(ind)) return f;
  return n ?? `${m}/${f.slice(-1)}`;
}

/** Il genitore del probando attraverso cui passa il cammino verso `anc`. */
function sideVia(ped: Pedigree, proband: Id, anc: Id, distance: number): "paterno" | "materno" | "" {
  for (const p of biologicalParents(ped, proband)) {
    const ok = p === anc ? distance === 1 : ancestorDistances(ped, p).get(anc) === distance - 1;
    if (ok) {
      const parent = ped.individuals[p];
      if (isMaleLike(parent)) return "paterno";
      if (isFemaleLike(parent)) return "materno";
      return "";
    }
  }
  return "";
}

function agree(side: string, ind: Individual | undefined): string {
  if (!side) return "";
  return " " + (isFemaleLike(ind) ? side.replace(/o$/, "a") : side);
}

function relationBySteps(
  ped: Pedigree,
  proband: Id,
  target: Id,
  a: number,
  b: number,
  anc: Id
): string {
  const t = ped.individuals[target];
  const side = a >= 2 || (a === 1 && b === 1) ? sideVia(ped, proband, anc, a) : "";
  if (b === 0) {
    if (a === 1) return word(t, "padre", "madre", "genitore");
    if (a === 2) return word(t, "nonno", "nonna") + agree(side, t);
    if (a === 3) return word(t, "bisnonno", "bisnonna") + agree(side, t);
    if (a === 4) return word(t, "trisnonno", "trisnonna") + agree(side, t);
    return `antenato (${a} generazioni)`;
  }
  if (a === 0) {
    if (b === 1) return word(t, "figlio", "figlia");
    if (b === 2) return "nipote (in linea diretta)";
    if (b === 3) return "pronipote (in linea diretta)";
    return `discendente (${b} generazioni)`;
  }
  if (a === 1 && b === 1) {
    const sib = getSiblings(ped, proband).half.find((h) => h.id === target);
    if (sib) {
      const s = sib.side === "paternal" ? " paterno" : sib.side === "maternal" ? " materno" : "";
      return word(t, "mezzo fratello", "mezza sorella", "mezzo/a fratello/sorella") + agree(s.trim(), t);
    }
    return word(t, "fratello", "sorella", "fratello/sorella");
  }
  if (a === 1) return b === 2 ? "nipote (in linea collaterale)" : "pronipote (in linea collaterale)";
  if (b === 1) {
    if (a === 2) return word(t, "zio", "zia") + agree(side, t);
    if (a === 3) return word(t, "prozio", "prozia") + agree(side, t);
    return `${word(t, "fratello", "sorella", "fratello/sorella")} di un antenato`;
  }
  const degree = Math.min(a, b) - 1;
  const removed = Math.abs(a - b);
  let label = `${word(t, "cugino", "cugina")} di ${ordinal(degree)} grado`;
  if (removed > 0) {
    label += `, ${removed === 1 ? "una generazione" : `${removed} generazioni`} ${a > b ? "sopra" : "sotto"}`;
  }
  return label + agree(side, t);
}

/** Relazione biologica: distanze dal più vicino antenato comune. */
function biologicalRelation(ped: Pedigree, proband: Id, target: Id): string | null {
  const ap = ancestorDistances(ped, proband);
  const at = ancestorDistances(ped, target);
  if (ap.has(target)) return relationBySteps(ped, proband, target, ap.get(target)!, 0, target);
  if (at.has(proband)) return relationBySteps(ped, proband, target, 0, at.get(proband)!, proband);
  let best: { a: number; b: number; anc: Id } | null = null;
  for (const [anc, a] of ap) {
    const b = at.get(anc);
    if (b === undefined) continue;
    if (!best || a + b < best.a + best.b) best = { a, b, anc };
  }
  if (!best) return null;
  return relationBySteps(ped, proband, target, best.a, best.b, best.anc);
}

/**
 * Relazione di `target` rispetto al probando, in italiano
 * ("zia materna", "cugino di primo grado paterno", "suocera").
 * Stringa vuota se non c'è un probando o non si trova un legame.
 */
export function getRelationToProband(ped: Pedigree, target: Id): string {
  const proband = ped.proband;
  if (!proband || !ped.individuals[target]) return "";
  if (target === proband) return "probando";
  const t = ped.individuals[target];

  const bio = biologicalRelation(ped, proband, target);
  if (bio) return bio;

  if (partnersOf(ped, proband).includes(target)) return "partner";

  // Legami sociali diretti (adozione, affido).
  const parents = getParents(ped, proband);
  if (parents.adoptive.includes(target)) return word(t, "padre adottivo", "madre adottiva", "genitore adottivo");
  if (parents.foster.includes(target)) return word(t, "padre affidatario", "madre affidataria", "genitore affidatario");
  if (parents.intended.includes(target)) return word(t, "padre", "madre", "genitore") + " (non genetico)";
  if (parents.donors.some((d) => d.id === target)) return "donatore";
  if (parents.carrier === target) return "gestante";
  for (const u of Object.values(ped.unions)) {
    if (!u.partners.includes(target)) continue;
    const link = u.children.find((c) => c.id === proband);
    if (link) return word(t, "padre", "madre", "genitore") + " (non biologico)";
  }

  // Partner di un parente: suocero/a, cognato/a, genero/nuora, "partner di…".
  for (const rel of partnersOf(ped, target)) {
    const r = biologicalRelation(ped, proband, rel);
    if (!r) continue;
    if (r.startsWith("fratello") || r.startsWith("sorella")) return word(t, "cognato", "cognata");
    if (r === "figlio" || r === "figlia") return word(t, "genero", "nuora", "partner del figlio");
    if (r === "padre" || r === "madre") return `partner ${r === "padre" ? "del padre" : "della madre"}`;
    return `partner di ${r}`;
  }
  const probandPartners = partnersOf(ped, proband);
  for (const pp of probandPartners) {
    const ppAnc = ancestorDistances(ped, pp);
    if (ppAnc.get(target) === 1) return word(t, "suocero", "suocera");
    const sib = getSiblings(ped, pp);
    if (sib.full.includes(target) || sib.half.some((h) => h.id === target)) {
      return word(t, "cognato", "cognata");
    }
  }
  return "";
}

/** Componenti connesse del grafo (unioni e figli come archi). */
export function connectedComponents(ped: Pedigree): Id[][] {
  const adj = new Map<Id, Set<Id>>();
  const link = (x: Id, y: Id) => {
    if (!adj.has(x)) adj.set(x, new Set());
    if (!adj.has(y)) adj.set(y, new Set());
    adj.get(x)!.add(y);
    adj.get(y)!.add(x);
  };
  for (const id of Object.keys(ped.individuals)) if (!adj.has(id)) adj.set(id, new Set());
  for (const u of Object.values(ped.unions)) {
    const members = [...u.partners, ...u.children.map((c) => c.id)];
    for (let i = 1; i < members.length; i++) link(members[0], members[i]);
    for (const c of u.children) {
      for (const x of [c.art?.eggFrom, c.art?.spermFrom, c.art?.carriedBy, c.art?.mitoFrom]) {
        if (x) link(c.id, x);
      }
    }
  }
  const seen = new Set<Id>();
  const out: Id[][] = [];
  for (const id of Object.keys(ped.individuals)) {
    if (seen.has(id)) continue;
    const comp: Id[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const x = stack.pop()!;
      if (ped.individuals[x]) comp.push(x);
      for (const y of adj.get(x) ?? []) {
        if (!seen.has(y)) {
          seen.add(y);
          stack.push(y);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Campi "Non lo so" da completare (evidenziati nella vista medico). */
export function unknownFields(ind: Individual): string[] {
  const out: string[] = [];
  if (ind.sex === "unknown" && !ind.pregnancy) out.push("sesso");
  if (ind.birth === "unknown" && (ind.age === undefined || ind.age === "unknown")) out.push("età");
  if (ind.vital === "unknown") out.push("stato in vita");
  if (ind.vital === "deceased" && (ind.death?.age === "unknown" || ind.death?.date === "unknown")) {
    out.push("età al decesso");
  }
  if (ind.healthUnknown) out.push("salute");
  return out;
}
