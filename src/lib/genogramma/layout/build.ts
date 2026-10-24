import { isMaleLike } from "../model/queries";
import type { DisplaySettings, Id, Pedigree } from "../model/types";
import { textWidth } from "./font-metrics";
import type { LGraph, LUnion } from "./graph";
import type { Measured } from "./measure";
import { clearRight, nearestFree, Shape } from "./shape";

/**
 * Costruzione ricorsiva dei blocchi familiari (fase "ordine + x").
 *
 * - `familyBlock(H)`: unione H con la sua fratria, i partner sopra e,
 *   ricorsivamente, le famiglie d'origine dei partner (antenati). Se H è la
 *   famiglia d'origine di un "connettore" X (già disegnato più in basso come
 *   partner), X sta all'estremità interna della fratria e i fratelli si
 *   impacchettano verso l'esterno contro tutto ciò che è già disegnato:
 *   ramo paterno a sinistra, materno a destra.
 * - `personUnit(C)`: C con i propri partner (gruppo di riga), le fratrie
 *   dei figli (ricorsivamente) e le famiglie d'origine dei partner entrati.
 *
 * Ogni individuo è posizionato una sola volta (`claimed`): un secondo
 * legame (anello di consanguineità, adozione da parente) diventa una
 * linea verso la posizione esistente.
 */

export interface BuildCtx {
  ped: Pedigree;
  g: LGraph;
  row: Map<Id, number>;
  m: Map<Id, Measured>;
  display: DisplaySettings;
  claimed: Set<Id>;
  built: Set<Id>;
  warnings: string[];
}

type Side = "left" | "right";

interface Group {
  order: Id[];
  unions: LUnion[];
  /** Unione → segnaposto del partner già disegnato altrove. */
  slots: Map<Id, Id>;
  /** Lato di inserimento di ciascun membro rispetto al seme. */
  side: Map<Id, Side | "center">;
}

const isPseudo = (id: Id) => id.startsWith("@");
export const descentKey = (unionId: Id) => `@d:${unionId}`;

function gaps(d: DisplaySettings) {
  return {
    partner: Math.max(12, d.hSpacing * 0.6),
    sibling: d.hSpacing,
    block: d.hSpacing * 1.2,
  };
}

function ext(ctx: BuildCtx, id: Id): { l: number; r: number } {
  if (isPseudo(id)) return { l: 0, r: 0 };
  const m = ctx.m.get(id)!;
  return { l: m.extL, r: m.extR };
}

/** Ordine sinistra→destra dei due partner: manuale, poi uomo a sinistra (convenzione), poi inserimento. */
function pairOrder(ctx: BuildCtx, u: LUnion): Id[] {
  const [a, b] = u.partners;
  if (u.partners.length < 2) return [...u.partners];
  if (u.partnerOrder && u.partnerOrder.includes(a) && u.partnerOrder.includes(b)) {
    return u.partnerOrder.indexOf(a) < u.partnerOrder.indexOf(b) ? [a, b] : [b, a];
  }
  if (ctx.display.maleLeft) {
    const ma = isMaleLike(ctx.ped.individuals[a]);
    const mb = isMaleLike(ctx.ped.individuals[b]);
    if (mb && !ma) return [b, a];
    if (ma && !mb) return [a, b];
  }
  return [a, b];
}

function pairSide(ctx: BuildCtx, p: Id, u: LUnion): Side {
  const order = pairOrder(ctx, u);
  return order[0] === p ? "right" : "left";
}

/**
 * Gruppo di riga: il seme, i suoi partner (uno per lato, poi all'esterno
 * in ordine cronologico), i partner dei partner verso l'esterno, i
 * donatori e le gestanti delle loro unioni.
 */
function buildGroup(
  ctx: BuildCtx,
  seed: Id[],
  seedUnion: LUnion | null,
  outward: Side | null,
  root: Id | null
): Group {
  const order = [...seed];
  const side = new Map<Id, Side | "center">();
  if (seed.length === 1) side.set(seed[0], "center");
  else seed.forEach((id, i) => side.set(id, i === 0 ? "left" : "right"));
  const unions: LUnion[] = [];
  const slots = new Map<Id, Id>();
  const inGroup = new Set(seed);
  const queue = [...seed];

  const insertOuter = (id: Id, s: Side) => {
    if (s === "left") order.unshift(id);
    else order.push(id);
    side.set(id, s);
  };
  const insertAdjacent = (id: Id, anchor: Id, s: Side) => {
    const i = order.indexOf(anchor);
    order.splice(s === "left" ? i : i + 1, 0, id);
    side.set(id, s);
  };
  const addExtras = (u: LUnion) => {
    for (const x of u.extras) {
      if (inGroup.has(x) || ctx.claimed.has(x)) continue;
      inGroup.add(x);
      insertOuter(x, outward ?? "right");
      queue.push(x);
    }
  };
  if (seedUnion) {
    unions.push(seedUnion);
    addExtras(seedUnion);
  }

  while (queue.length > 0) {
    const p = queue.shift()!;
    // Donatore o gestante raggiunti per primi: si aggiungono i genitori intenzionali.
    for (const uid of ctx.g.extraOf.get(p) ?? []) {
      const u = ctx.g.unionById.get(uid);
      if (!u || unions.includes(u)) continue;
      unions.push(u);
      const s: Side = outward ?? "left";
      for (const q of pairOrder(ctx, u)) {
        if (inGroup.has(q) || ctx.claimed.has(q)) continue;
        inGroup.add(q);
        insertOuter(q, s);
        queue.push(q);
      }
      addExtras(u);
    }
    const own = (ctx.g.unionsOf.get(p) ?? []).filter((u) => !unions.includes(u));
    const couples = own.filter((u) => u.partners.length === 2);
    let k = 0;
    for (const u of own) {
      if (u.partners.length < 2) {
        unions.push(u);
        addExtras(u);
        continue;
      }
      const q = u.partners.find((x) => x !== p)!;
      let s: Side;
      const ps = side.get(p);
      if (p === root || (ps === "center" && !outward)) {
        s = couples.length === 1 ? pairSide(ctx, p, u) : k % 2 === 0 ? "left" : "right";
      } else if (outward) {
        s = outward;
      } else {
        s = ps === "left" ? "left" : ps === "right" ? "right" : pairSide(ctx, p, u);
      }
      k += 1;
      unions.push(u);
      if (inGroup.has(q)) continue;
      if (ctx.claimed.has(q)) {
        const slot = `@slot:${u.id}`;
        slots.set(u.id, slot);
        insertAdjacent(slot, p, s);
        continue;
      }
      inGroup.add(q);
      insertOuter(q, s);
      queue.push(q);
      addExtras(u);
    }
  }
  if (unions.filter((u) => u.partners.includes(root ?? "")).length > 4) {
    ctx.warnings.push("Più di quattro unioni per una persona: disposizione semplificata.");
  }
  return { order, unions, slots, side };
}

/** Separazioni minime tra membri consecutivi del gruppo. */
function separations(ctx: BuildCtx, grp: Group): number[] {
  const gp = gaps(ctx.display);
  const seps: number[] = [];
  for (let i = 0; i + 1 < grp.order.length; i++) {
    const a = grp.order[i];
    const b = grp.order[i + 1];
    const couple = grp.unions.some(
      (u) =>
        (u.partners.includes(a) || grp.slots.get(u.id) === a) &&
        (u.partners.includes(b) || grp.slots.get(u.id) === b)
    );
    let sep = ext(ctx, a).r + ext(ctx, b).l + (couple ? gp.partner : gp.sibling);
    // La discendenza scende a metà tra i partner: non deve attraversare
    // etichette o frecce dell'uno o dell'altro.
    if (couple) sep = Math.max(sep, 2 * Math.max(ext(ctx, a).r, ext(ctx, b).l) + 8);
    // Genitore solo e donatore: i figli stanno a metà, oltre le etichette del genitore.
    if (grp.unions.some((u) => u.partners.length === 1 && u.partners[0] === a && u.extras.includes(b))) {
      sep = Math.max(sep, 2 * ext(ctx, a).r + ctx.display.symbolSize);
    }
    // Il grado di consanguineità scritto sopra la linea deve stare tra i due simboli.
    const degree = grp.unions.find(
      (u) => u.partners.includes(a) && u.partners.includes(b) && u.consanguinity?.degree
    )?.consanguinity?.degree;
    if (degree) {
      const w = textWidth(degree, ctx.display.fontSize * 0.9, ctx.display.fontFamily);
      sep = Math.max(sep, w + ctx.display.symbolSize + 10);
    }
    seps.push(sep);
  }
  return seps;
}

/** x della linea di discendenza di un'unione, dalle posizioni del gruppo. */
function descentX(grp: Group, u: LUnion, xs: number[], root: Id | null): number {
  const idx = (id: Id) => grp.order.indexOf(id);
  if (u.partners.length === 1) return xs[idx(u.partners[0])];
  const slot = grp.slots.get(u.id);
  const present = u.partners.filter((p) => idx(p) >= 0);
  if (slot && present.length === 1) return (xs[idx(present[0])] + xs[idx(slot)]) / 2;
  const a = idx(u.partners[0]);
  const b = idx(u.partners[1]);
  if (a < 0 || b < 0) return xs[Math.max(a, b)] ?? 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo === 1) return (xs[lo] + xs[hi]) / 2;
  // Partner non adiacenti (unioni 3–4): la discendenza scende nello spazio
  // accanto al partner più esterno, mai sopra il partner intermedio.
  const r = root !== null && idx(root) >= 0 ? idx(root) : (lo + hi) / 2;
  if (Math.abs(lo - r) >= Math.abs(hi - r)) return (xs[lo] + xs[lo + 1]) / 2;
  return (xs[hi - 1] + xs[hi]) / 2;
}

/**
 * Punto sotto cui centrare la fratria. Di solito coincide con la linea di
 * discendenza; per un genitore solo con un donatore accanto, i figli stanno
 * tra i due: la diagonale del donatore resta fuori dalle etichette.
 */
function anchorX(grp: Group, u: LUnion, xs: number[], root: Id | null): number {
  if (u.partners.length === 1 && u.extras.length > 0) {
    const i = grp.order.indexOf(u.partners[0]);
    const next = grp.order[i + 1];
    if (i >= 0 && next && u.extras.includes(next)) return (xs[i] + xs[i + 1]) / 2;
  }
  return descentX(grp, u, xs, root);
}

/** Indice da cui spostare per allontanare la discendenza dell'unione verso destra (o sinistra). */
function splitIndex(grp: Group, u: LUnion, xs: number[], dx: number, toRight: boolean): number {
  // Il primo membro a destra (o l'ultimo a sinistra) della linea di discendenza.
  if (toRight) {
    for (let i = 0; i < xs.length; i++) if (xs[i] > dx + 0.01) return i;
    return xs.length;
  }
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] < dx - 0.01) return i;
  return -1;
}

interface Sib {
  shape: Shape;
  center: number;
  count: number;
}

function isLocalChild(ctx: BuildCtx, u: LUnion, cid: Id): boolean {
  return ctx.g.home.get(cid) === u.id && !ctx.claimed.has(cid);
}

/** Un fratello la cui famiglia (partner o figli) è già disegnata verrà raggiunto da lì. */
function hasClaimedFamily(ctx: BuildCtx, id: Id): boolean {
  for (const u of ctx.g.unionsOf.get(id) ?? []) {
    if (u.partners.some((p) => p !== id && ctx.claimed.has(p))) return true;
    // Solo i figli che hanno qui la loro "casa" riportano il disegno a questa unione.
    if (u.children.some((c) => ctx.claimed.has(c.id) && ctx.g.home.get(c.id) === u.id)) return true;
  }
  for (const uid of ctx.g.extraOf.get(id) ?? []) {
    const u = ctx.g.unionById.get(uid);
    if (u && u.partners.some((p) => ctx.claimed.has(p))) return true;
  }
  return false;
}

function sibshipDown(ctx: BuildCtx, u: LUnion): Sib {
  const gp = gaps(ctx.display);
  const shape = new Shape();
  const xs: number[] = [];
  for (const c of u.children) {
    if (!isLocalChild(ctx, u, c.id)) continue;
    const unit = personUnit(ctx, c.id);
    if (!shape.isEmpty()) {
      const dx = clearRight(shape, unit, gp.sibling);
      unit.translate(dx ?? 0);
    }
    shape.merge(unit);
    xs.push(shape.x(c.id));
  }
  return { shape, center: xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : 0, count: xs.length };
}

function claimGroup(ctx: BuildCtx, grp: Group) {
  for (const id of grp.order) if (!isPseudo(id)) ctx.claimed.add(id);
}

function tight(seps: number[]): number[] {
  const xs = [0];
  for (const s of seps) xs.push(xs[xs.length - 1] + s);
  return xs;
}

/** Aggiunge al blocco i membri del gruppo, i punti di discendenza e gli ingombri dei "nessun figlio". */
function emitGroup(ctx: BuildCtx, shape: Shape, grp: Group, xs: number[], row: number, root: Id | null) {
  grp.order.forEach((id, i) => {
    if (isPseudo(id)) shape.setPoint(id, xs[i]);
    else {
      const e = ext(ctx, id);
      shape.addNode(id, xs[i], row, e.l, e.r);
    }
  });
  for (const u of grp.unions) {
    const dx = descentX(grp, u, xs, root);
    shape.setPoint(descentKey(u.id), dx);
    if (u.noChildren && u.children.length === 0 && u.noChildren.reason) {
      const w = textWidth(u.noChildren.reason, ctx.display.fontSize, ctx.display.fontFamily);
      shape.addSpan(row, dx - w / 2 - 2, dx + w / 2 + 2);
    }
  }
}

/** Individuo con partner e discendenti; x(C) = 0 nel blocco restituito. */
export function personUnit(ctx: BuildCtx, c: Id): Shape {
  const gp = gaps(ctx.display);
  ctx.claimed.add(c);
  const grp = buildGroup(ctx, [c], null, null, c);
  claimGroup(ctx, grp);
  const row = ctx.row.get(c)!;

  const sibs = new Map<Id, Sib>();
  for (const u of grp.unions) {
    const s = sibshipDown(ctx, u);
    if (s.count > 0) sibs.set(u.id, s);
  }

  const seps = separations(ctx, grp);
  const xs = tight(seps);
  const placed = new Map<Id, number>(); // offset di ciascuna fratria
  const withSib = grp.unions.filter((u) => sibs.has(u.id));
  const primary = withSib.reduce<LUnion | null>(
    (best, u) => (!best || sibs.get(u.id)!.count > sibs.get(best.id)!.count ? u : best),
    null
  );

  const placeSibships = () => {
    placed.clear();
    if (!primary) return;
    const ordered = [...withSib].sort((a, b) => anchorX(grp, a, xs, c) - anchorX(grp, b, xs, c));
    const pi = ordered.indexOf(primary);
    const groupSpans: [number, number][] = grp.order
      .filter((id) => !isPseudo(id))
      .map((id) => [xs[grp.order.indexOf(id)] - ext(ctx, id).l, xs[grp.order.indexOf(id)] + ext(ctx, id).r]);
    const merged = new Shape();
    const put = (u: LUnion, dir: 0 | 1 | -1) => {
      const s = sibs.get(u.id)!;
      let off = anchorX(grp, u, xs, c) - s.center;
      const probe = cloneShifted(s.shape, off);
      if (!merged.isEmpty() && dir !== 0) {
        const need = dir > 0 ? clearRight(merged, probe, gp.block) : clearRight(probe, merged, gp.block);
        if (need !== null && need > 0) off += dir > 0 ? need : -need;
      }
      // Antenati di un genero/nuora sulla riga del gruppo: non devono toccarlo.
      const upper = s.shape.spans.get(row);
      if (upper) {
        let span: [number, number] = [Infinity, -Infinity];
        for (const [l, r] of upper) span = [Math.min(span[0], l + off), Math.max(span[1], r + off)];
        const shift = nearestFree(span, groupSpans, gp.sibling, dir < 0 ? "left" : "right");
        off += shift;
      }
      placed.set(u.id, off);
      merged.merge(cloneShifted(s.shape, off));
    };
    put(primary, 0);
    for (let i = pi + 1; i < ordered.length; i++) put(ordered[i], 1);
    for (let i = pi - 1; i >= 0; i--) put(ordered[i], -1);
  };

  for (let iter = 0; iter < 3; iter++) {
    placeSibships();
    if (!primary) break;
    let moved = false;
    const pdx = anchorX(grp, primary, xs, c);
    for (const u of withSib) {
      if (u === primary) continue;
      const target = placed.get(u.id)! + sibs.get(u.id)!.center;
      const dx = anchorX(grp, u, xs, c);
      const delta = target - dx;
      if (dx > pdx && delta > 0.5) {
        const from = splitIndex(grp, u, xs, dx, true);
        const k = u.partners.length === 2 && !grp.slots.has(u.id) ? 2 : 1;
        for (let i = from; i < xs.length; i++) xs[i] += delta * k;
        moved = true;
      } else if (dx < pdx && delta < -0.5) {
        const to = splitIndex(grp, u, xs, dx, false);
        const k = u.partners.length === 2 && !grp.slots.has(u.id) ? 2 : 1;
        for (let i = 0; i <= to; i++) xs[i] += delta * k;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const shape = new Shape();
  emitGroup(ctx, shape, grp, xs, row, c);
  for (const [uid, off] of placed) shape.merge(cloneShifted(sibs.get(uid)!.shape, off));

  // Famiglie d'origine di chi entra in famiglia (e di donatori/gestanti con storia familiare).
  for (const id of grp.order) {
    if (id === c || isPseudo(id)) continue;
    const h = ctx.g.home.get(id);
    if (!h || ctx.built.has(h)) continue;
    const inner: Side = shape.x(id) < shape.x(c) ? "right" : "left";
    familyBlock(ctx, h, { x: id, inner }, shape);
  }
  shape.translate(-shape.x(c));
  return shape;
}

function cloneShifted(s: Shape, dx: number): Shape {
  const out = new Shape();
  out.merge(s);
  out.translate(dx);
  return out;
}

/**
 * Unione con la sua fratria e gli antenati. Con `pin` il connettore è già
 * nel blocco `shape` (sistema di riferimento comune) e la fratria cresce
 * verso l'esterno; senza `pin` è la famiglia radice.
 */
export function familyBlock(
  ctx: BuildCtx,
  unionId: Id,
  pin: { x: Id; inner: Side } | null,
  shape: Shape
): Shape {
  const gp = gaps(ctx.display);
  const h = ctx.g.unionById.get(unionId)!;
  ctx.built.add(h.id);
  if (pin && !strictPin(ctx, pin.x)) {
    // Il partner è entrato in famiglia senza la propria famiglia d'origine:
    // il connettore resta al suo posto nell'ordine di nascita.
    familyBlockInner(ctx, h, { ...pin, inOrder: true }, shape);
    return shape;
  }
  if (pin) {
    // Il blocco degli antenati si costruisce a parte, con il solo connettore,
    // poi scorre verso l'esterno come un corpo rigido finché non tocca più
    // ciò che è già disegnato (contorni su tutte le righe). Il connettore
    // resta fermo: la linea di fratria si allunga.
    const keep = new Set([pin.x]);
    const local = new Shape();
    const e = ext(ctx, pin.x);
    local.addNode(pin.x, shape.x(pin.x), ctx.row.get(pin.x)!, e.l, e.r);
    familyBlockInner(ctx, h, pin, local);
    const rest = local.without(keep);
    const base = shape.without(keep);
    if (!rest.isEmpty() && !base.isEmpty()) {
      const need =
        pin.inner === "right" ? clearRight(rest, base, gp.block) : clearRight(base, rest, gp.block);
      if (need !== null && need > 0) local.translateExcept(pin.inner === "right" ? -need : need, keep);
    }
    shape.merge(local, keep);
    return shape;
  }
  familyBlockInner(ctx, h, null, shape);
  return shape;
}

/**
 * Il connettore va all'estremità interna della fratria (deroga all'ordine
 * di nascita) solo se un suo partner ha a sua volta la famiglia d'origine
 * nel disegno: altrimenti nessuna linea si incrocerebbe.
 */
function strictPin(ctx: BuildCtx, x: Id): boolean {
  for (const u of ctx.g.unionsOf.get(x) ?? []) {
    for (const p of u.partners) if (p !== x && ctx.g.home.has(p)) return true;
  }
  return false;
}

function familyBlockInner(
  ctx: BuildCtx,
  h: LUnion,
  pinArg: { x: Id; inner: Side; inOrder?: boolean } | null,
  shape: Shape
): void {
  const gp = gaps(ctx.display);
  const row = ctx.row.get(h.partners[0])!;
  const inOrder = !!pinArg?.inOrder;
  const pin = inOrder ? null : pinArg;

  // 1. Fratria.
  const anchorId = pinArg?.x;
  const local = h.children
    .map((c) => c.id)
    .filter((id) => id !== anchorId && isLocalChild(ctx, h, id) && (!pinArg || !hasClaimedFamily(ctx, id)));
  const sibXs: number[] = [];
  if (anchorId) sibXs.push(shape.x(anchorId));
  const towardLeft = pin?.inner === "right";
  // Con il connettore in ordine di nascita: i più grandi a sinistra, i più piccoli a destra.
  let leftward: Id[] = [];
  let rightward: Id[] = [];
  if (inOrder && anchorId) {
    const all = h.children.map((c) => c.id).filter((id) => id === anchorId || local.includes(id));
    const at = all.indexOf(anchorId);
    leftward = all.slice(0, at).reverse();
    rightward = all.slice(at + 1);
  } else if (towardLeft) {
    leftward = [...local].reverse();
  } else {
    rightward = local;
  }
  const pack = (id: Id, left: boolean) => {
    if (!isLocalChild(ctx, h, id)) return;
    const unit = personUnit(ctx, id);
    if (shape.isEmpty()) {
      shape.merge(unit);
    } else if (left) {
      const need = clearRight(unit, shape, gp.sibling);
      unit.translate(-(need ?? 0));
      shape.merge(unit);
    } else {
      const need = clearRight(shape, unit, gp.sibling);
      unit.translate(need ?? 0);
      shape.merge(unit);
    }
    sibXs.push(shape.x(id));
  };
  for (const id of rightward) pack(id, false);
  for (const id of leftward) pack(id, true);
  for (const c of h.children) {
    if (shape.xs.has(c.id) && !sibXs.includes(shape.x(c.id)) && ctx.g.home.get(c.id) === h.id) {
      sibXs.push(shape.x(c.id));
    }
  }

  // 2. Gruppo di riga dei genitori.
  const seed = pairOrder(ctx, h).filter((p) => !ctx.claimed.has(p));
  if (seed.length === 0) return;
  const outward: Side | null = pin ? (pin.inner === "right" ? "left" : "right") : null;
  const grp = buildGroup(ctx, seed, h, outward, seed.length === 1 ? seed[0] : null);
  claimGroup(ctx, grp);

  // 3. Fratrie delle altre unioni del gruppo (mezzi fratelli), verso l'esterno.
  const seps = separations(ctx, grp);
  const xs = tight(seps);
  const root = seed.length === 1 ? seed[0] : null;
  const hx = anchorX(grp, h, xs, root);
  const targets = new Map<Id, number>();
  const others = grp.unions
    .filter((u) => u !== h)
    .sort((a, b) => Math.abs(anchorX(grp, a, xs, root) - hx) - Math.abs(anchorX(grp, b, xs, root) - hx));
  for (const u of others) {
    const s = sibshipDown(ctx, u);
    if (s.count === 0) continue;
    const left = anchorX(grp, u, xs, root) < hx;
    const sh = s.shape;
    if (shape.isEmpty()) shape.merge(sh);
    else if (left) {
      sh.translate(-(clearRight(sh, shape, gp.block) ?? 0));
      shape.merge(sh);
    } else {
      sh.translate(clearRight(shape, sh, gp.block) ?? 0);
      shape.merge(sh);
    }
    const ids = u.children.filter((c) => sh.xs.has(c.id)).map((c) => sh.x(c.id));
    if (ids.length) targets.set(u.id, (Math.min(...ids) + Math.max(...ids)) / 2);
  }

  // 4. Posizioni: H centrata sulla fratria (o spostata verso l'esterno se c'è un connettore).
  let target = sibXs.length ? (Math.min(...sibXs) + Math.max(...sibXs)) / 2 : 0;
  const base = anchorX(grp, h, xs, root);
  for (let i = 0; i < xs.length; i++) xs[i] += target - base;
  if (pin) {
    const inner = towardLeft
      ? Math.max(...h.partners.map((p) => grp.order.indexOf(p)))
      : Math.min(...h.partners.map((p) => grp.order.indexOf(p)));
    const px = pin.x;
    const limit = shape.x(px);
    if (inner >= 0) {
      const over = towardLeft ? xs[inner] - limit : limit - xs[inner];
      if (over > 0) {
        for (let i = 0; i < xs.length; i++) xs[i] += towardLeft ? -over : over;
        target += towardLeft ? -over : over;
      }
    }
  }
  const hdx = anchorX(grp, h, xs, root);
  for (const [uid, t] of targets) {
    const u = grp.unions.find((x) => x.id === uid)!;
    const dx = anchorX(grp, u, xs, root);
    const delta = t - dx;
    if (dx > hdx && delta > 0.5) {
      const from = splitIndex(grp, u, xs, dx, true);
      for (let i = from; i < xs.length; i++) xs[i] += delta * 2;
    } else if (dx < hdx && delta < -0.5) {
      const to = splitIndex(grp, u, xs, dx, false);
      for (let i = 0; i <= to; i++) xs[i] += delta * 2;
    }
  }
  // Famiglia radice: nessuna collisione con gli antenati dei generi/nuore sulla stessa riga.
  const obstacles = shape.spans.get(row) ?? [];
  const members = grp.order.filter((id) => !isPseudo(id));
  if (!pin && members.length && obstacles.length) {
    const span: [number, number] = [
      Math.min(...members.map((id) => xs[grp.order.indexOf(id)] - ext(ctx, id).l)),
      Math.max(...members.map((id) => xs[grp.order.indexOf(id)] + ext(ctx, id).r)),
    ];
    // Spostamento minimo: verso l'esterno il blocco finirebbe nell'altro ramo.
    const shift = nearestFree(span, obstacles, gp.block, "none");
    for (let i = 0; i < xs.length; i++) xs[i] += shift;
  }
  emitGroup(ctx, shape, grp, xs, row, root);

  // 5. Antenati dei membri del gruppo.
  const hFinal = shape.x(descentKey(h.id));
  for (const id of members) {
    const home = ctx.g.home.get(id);
    if (!home || ctx.built.has(home)) continue;
    familyBlock(ctx, home, { x: id, inner: shape.x(id) <= hFinal ? "right" : "left" }, shape);
  }
}
