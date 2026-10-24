import { birthInterval, midpoint } from "./age";
import type { Id, Pedigree, Union } from "./types";

/**
 * Ordine della fratria, da sinistra (il più grande) a destra (il più piccolo).
 *
 * Priorità: ordine manuale (drag, `childOrder: "manual"`) > `birthOrder`
 * esplicito > data/anno di nascita > età rispetto alla data del genogramma >
 * ordine di inserimento. Il sesso non entra mai nel confronto.
 *
 * I gemelli formano un blocco unico (la posizione del primo del gruppo).
 * Chi non ha dati di età resta nel proprio posto di inserimento; i
 * fratelli con età nota si ordinano tra loro nei posti rimanenti.
 */
export function orderChildren(ped: Pedigree, union: Union): Id[] {
  const ids = union.children.map((c) => c.id).filter((id) => ped.individuals[id]);
  if (union.childOrder === "manual") return groupTwins(ped, ids);

  // Blocchi: un individuo o un gruppo di gemelli.
  const blocks: Id[][] = [];
  const byGroup = new Map<Id, Id[]>();
  for (const id of ids) {
    const g = ped.individuals[id].twin?.groupId;
    if (g) {
      const existing = byGroup.get(g);
      if (existing) {
        existing.push(id);
        continue;
      }
      const block = [id];
      byGroup.set(g, block);
      blocks.push(block);
    } else {
      blocks.push([id]);
    }
  }
  for (const block of blocks) {
    block.sort((a, b) => explicitOrder(ped, a) - explicitOrder(ped, b));
  }

  const n = blocks.length;
  const result: (Id[] | null)[] = new Array(n).fill(null);

  // 1. birthOrder esplicito: posizione assoluta (1 = primo).
  const rest: { block: Id[]; index: number }[] = [];
  blocks.forEach((block, index) => {
    const pos = block
      .map((id) => ped.individuals[id].birthOrder)
      .find((v) => typeof v === "number");
    if (typeof pos === "number") {
      let slot = Math.min(Math.max(1, Math.round(pos)), n) - 1;
      while (result[slot] !== null && slot < n - 1) slot += 1;
      while (result[slot] !== null && slot > 0) slot -= 1;
      result[slot] = block;
    } else {
      rest.push({ block, index });
    }
  });

  // 2. Gli altri: con età nota ordinati tra loro, gli ignoti restano al loro posto.
  const keyed = rest.map((r) => ({ ...r, key: blockKey(ped, r.block) }));
  const known = keyed.filter((r) => r.key !== null).sort((a, b) => a.key! - b.key! || a.index - b.index);
  let k = 0;
  const sequence = keyed.map((r) => (r.key === null ? r : known[k++]));

  let s = 0;
  for (let i = 0; i < n; i++) {
    if (result[i] === null) result[i] = sequence[s++].block;
  }
  return result.flatMap((b) => b ?? []);
}

function explicitOrder(ped: Pedigree, id: Id): number {
  return ped.individuals[id].birthOrder ?? Number.MAX_SAFE_INTEGER;
}

function blockKey(ped: Pedigree, block: Id[]): number | null {
  let best: number | null = null;
  for (const id of block) {
    const iv = birthInterval(ped.individuals[id], ped.date);
    if (!iv) continue;
    const m = midpoint(iv);
    if (best === null || m < best) best = m;
  }
  return best;
}

/** In ordine manuale i gemelli restano comunque adiacenti. */
function groupTwins(ped: Pedigree, ids: Id[]): Id[] {
  const out: Id[] = [];
  const placed = new Set<Id>();
  for (const id of ids) {
    if (placed.has(id)) continue;
    const g = ped.individuals[id].twin?.groupId;
    const group = g ? ids.filter((x) => ped.individuals[x].twin?.groupId === g) : [id];
    for (const x of group) {
      out.push(x);
      placed.add(x);
    }
  }
  return out;
}

/** Gruppi di gemelli nella fratria (ID nell'ordine della fratria). */
export function twinGroups(ped: Pedigree, ordered: Id[]): Id[][] {
  const groups = new Map<Id, Id[]>();
  for (const id of ordered) {
    const g = ped.individuals[id]?.twin?.groupId;
    if (!g) continue;
    groups.set(g, [...(groups.get(g) ?? []), id]);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}
