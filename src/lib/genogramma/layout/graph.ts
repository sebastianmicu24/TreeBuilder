import { homeEntry, unionsOf } from "../model/queries";
import { orderChildren } from "../model/sibling-order";
import type { ChildLinkType, Id, Pedigree, Union } from "../model/types";

/**
 * Grafo di disegno: le unioni del modello più le unioni "virtuali" sotto
 * una gestante per altri o una surrogata (la gravidanza si disegna
 * direttamente sotto chi la porta, NSGC 2025). Calcola anche quali
 * individui sono visibili e in quale unione ciascuno è disegnato ("casa").
 */
export interface LChild {
  id: Id;
  link: ChildLinkType;
  /** Linea tratteggiata (adozione, affido). */
  dashed: boolean;
}

export interface LUnion {
  id: Id;
  partners: Id[];
  /** Donatori e gestanti (non partner) sulla stessa riga dei partner. */
  extras: Id[];
  /** Figli nell'ordine della fratria. */
  children: LChild[];
  sequence: number;
  status: Union["status"];
  consanguinity?: Union["consanguinity"];
  noChildren?: Union["noChildren"];
  partnerOrder?: Id[];
  /** Unione virtuale sotto una gestante: id dell'unione reale. */
  carrierOf?: Id;
}

export interface LGraph {
  visible: Id[];
  unions: LUnion[];
  unionById: Map<Id, LUnion>;
  /** Unioni (anche virtuali) in cui l'individuo è partner, in ordine cronologico. */
  unionsOf: Map<Id, LUnion[]>;
  /** Unione in cui l'individuo è disegnato come figlio. */
  home: Map<Id, Id>;
  /** Unioni di cui l'individuo è donatore/gestante. */
  extraOf: Map<Id, Id[]>;
}

export function buildGraph(ped: Pedigree): LGraph {
  const hidden = new Set<Id>();
  if (ped.display.hidePriorPartners) {
    for (const u of Object.values(ped.unions)) {
      if (u.status !== "ended" || u.children.length > 0 || u.partners.length < 2) continue;
      for (const p of u.partners) {
        if (p === ped.proband) continue;
        const others = unionsOf(ped, p).filter((x) => x.id !== u.id);
        const hasParents = !!homeEntry(ped, p);
        if (others.length === 0 && !hasParents) hidden.add(p);
      }
    }
  }
  const visible = Object.keys(ped.individuals).filter((id) => !hidden.has(id));
  const isVisible = (id: Id | undefined) => !!id && !!ped.individuals[id] && !hidden.has(id);

  const unions: LUnion[] = [];
  const carried = new Map<Id, Id>(); // figlio → gestante non partner
  const sorted = Object.values(ped.unions).sort((a, b) => a.sequence - b.sequence);
  for (const u of sorted) {
    const partners = u.partners.filter(isVisible);
    if (partners.length === 0) continue;
    if (u.partners.length === 2 && partners.length === 1 && u.children.length === 0) continue;
    const order = orderChildren(ped, u).filter(isVisible);
    const linkOf = new Map(u.children.map((c) => [c.id, c]));
    const extras: Id[] = [];
    const virtualKids = new Map<Id, Id[]>();
    for (const cid of order) {
      const art = linkOf.get(cid)?.art;
      if (linkOf.get(cid)?.link !== "art" || !art) continue;
      for (const x of [art.eggFrom, art.spermFrom, art.mitoFrom, art.carriedBy]) {
        if (x && isVisible(x) && !u.partners.includes(x) && !extras.includes(x)) extras.push(x);
      }
      if (art.carriedBy && isVisible(art.carriedBy) && !u.partners.includes(art.carriedBy)) {
        carried.set(cid, art.carriedBy);
        virtualKids.set(art.carriedBy, [...(virtualKids.get(art.carriedBy) ?? []), cid]);
      }
    }
    unions.push({
      id: u.id,
      partners,
      extras,
      children: order.map((cid) => {
        const link = linkOf.get(cid)!.link;
        return { id: cid, link, dashed: link === "adoptive" || link === "foster" };
      }),
      sequence: u.sequence,
      status: u.status,
      consanguinity: u.consanguinity,
      noChildren: u.noChildren,
      partnerOrder: u.partnerOrder,
    });
    for (const [carrier, kids] of virtualKids) {
      unions.push({
        id: `@carrier:${carrier}:${u.id}`,
        partners: [carrier],
        extras: [],
        children: kids.map((id) => ({ id, link: "art", dashed: false })),
        sequence: u.sequence + 0.5,
        status: "current",
        carrierOf: u.id,
      });
    }
  }

  const unionById = new Map(unions.map((u) => [u.id, u]));
  const unionsOfMap = new Map<Id, LUnion[]>();
  const extraOf = new Map<Id, Id[]>();
  for (const id of visible) {
    unionsOfMap.set(id, []);
    extraOf.set(id, []);
  }
  for (const u of unions) {
    for (const p of u.partners) unionsOfMap.get(p)?.push(u);
    for (const x of u.extras) extraOf.get(x)?.push(u.id);
  }
  for (const list of unionsOfMap.values()) list.sort((a, b) => a.sequence - b.sequence);

  const home = new Map<Id, Id>();
  for (const id of visible) {
    const c = carried.get(id);
    if (c) {
      const v = unions.find((u) => u.partners[0] === c && u.carrierOf && u.children.some((k) => k.id === id));
      if (v) {
        home.set(id, v.id);
        continue;
      }
    }
    const entry = homeEntry(ped, id);
    if (entry && unionById.has(entry.union.id)) home.set(id, entry.union.id);
  }
  return { visible, unions, unionById, unionsOf: unionsOfMap, home, extraOf };
}
