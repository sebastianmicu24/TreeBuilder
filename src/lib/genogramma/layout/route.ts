import type { DisplaySettings, Id, Pedigree } from "../model/types";
import { textWidth } from "./font-metrics";
import type { LGraph, LUnion } from "./graph";
import type { LayoutLine, LayoutNode, LayoutText } from "./types";

/**
 * Linee NSGC calcolate dalle posizioni finali: relazione (al centro dei
 * simboli; doppia se consanguinea; due barre se terminata; rialzata se i
 * partner non sono adiacenti), discendenza, fratria, linee individuali
 * (gemelli da un vertice comune, barra MZ tra le linee, "?"), nessun
 * figlio/infertilità, donatori (diagonale), gestanti (continua), legami
 * secondari (adozione da parente, anelli) instradati a parte.
 */
export interface RouteInput {
  ped: Pedigree;
  g: LGraph;
  nodes: Map<Id, LayoutNode>;
  points: Map<Id, number>;
  rowY: number[];
  sibY: (row: number) => number;
  display: DisplaySettings;
}

export function routeLines(input: RouteInput): { lines: LayoutLine[]; texts: LayoutText[] } {
  const { ped, g, nodes, points, sibY, display } = input;
  const s = display.symbolSize;
  const fs = display.fontSize;
  const font = display.fontFamily;
  const lines: LayoutLine[] = [];
  const texts: LayoutText[] = [];
  const top = (n: LayoutNode) => n.y - s / 2;
  /** Quota del bordo superiore del simbolo alla x indicata. */
  const edgeTop = (n: LayoutNode, x: number) => {
    const d = Math.abs(x - n.x);
    if (n.shape === "circle") return n.y - Math.sqrt(Math.max(0, (s / 2) ** 2 - d * d));
    if (n.shape === "diamond") return n.y - (s / 2 - d);
    return n.y - s / 2;
  };
  const symbolBottom = (n: LayoutNode) => (n.shape === "triangle" ? n.symbolBox.y2 : n.y + s / 2);

  // Ordine per riga (per sapere se due partner sono adiacenti).
  const rowOrder = new Map<number, LayoutNode[]>();
  for (const n of nodes.values()) {
    const list = rowOrder.get(n.row) ?? [];
    list.push(n);
    rowOrder.set(n.row, list);
  }
  for (const list of rowOrder.values()) list.sort((a, b) => a.x - b.x);
  const between = (a: LayoutNode, b: LayoutNode) =>
    (rowOrder.get(a.row) ?? []).filter((n) => n.x > Math.min(a.x, b.x) + 0.01 && n.x < Math.max(a.x, b.x) - 0.01).length;

  const raisedLevel = new Map<number, number>();
  const textBox = (text: string, x: number, y: number, anchor: LayoutText["anchor"], size = fs) => {
    const w = textWidth(text, size, font);
    const x1 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    return { x1, y1: y - size, x2: x1 + w, y2: y + size * 0.25 };
  };

  const secondaryOffset = new Map<number, number>();

  // Quote delle linee di fratria: due fratrie diverse non corrono mai una
  // sull'altra. Se gli intervalli si sovrappongono (linea lunga di un
  // connettore), la più lunga sale di un livello.
  const LEVEL_STEP = 5;
  const level = new Map<Id, number>();
  {
    const spans: { id: Id; row: number; lo: number; hi: number }[] = [];
    for (const u of g.unions) {
      const partners = u.partners.map((p) => nodes.get(p)).filter((n): n is LayoutNode => !!n);
      if (partners.length === 0) continue;
      const childRow = partners[0].row + 1;
      const xsJ: number[] = [];
      const seenTwin = new Set<Id>();
      for (const c of u.children) {
        const n = nodes.get(c.id);
        if (!n || g.home.get(c.id) !== u.id || n.row !== childRow) continue;
        const tw = ped.individuals[c.id].twin;
        if (tw) {
          if (seenTwin.has(tw.groupId)) continue;
          seenTwin.add(tw.groupId);
          const members = u.children
            .map((k) => nodes.get(k.id))
            .filter((m): m is LayoutNode => !!m && ped.individuals[m.id].twin?.groupId === tw.groupId);
          xsJ.push(members.reduce((acc, m) => acc + m.x, 0) / members.length);
        } else xsJ.push(n.x);
      }
      if (xsJ.length === 0) continue;
      const dx = points.get(`@d:${u.id}`) ?? partners[0].x;
      spans.push({ id: u.id, row: childRow, lo: Math.min(dx, ...xsJ), hi: Math.max(dx, ...xsJ) });
    }
    spans.sort((a, b) => a.hi - a.lo - (b.hi - b.lo));
    const taken: { row: number; lvl: number; lo: number; hi: number }[] = [];
    for (const sp of spans) {
      let lvl = 0;
      while (
        lvl < 4 &&
        taken.some((t) => t.row === sp.row && t.lvl === lvl && Math.min(t.hi, sp.hi) - Math.max(t.lo, sp.lo) > -1)
      ) {
        lvl += 1;
      }
      level.set(sp.id, lvl);
      taken.push({ row: sp.row, lvl, lo: sp.lo, hi: sp.hi });
    }
  }

  for (const u of g.unions) {
    const partners = u.partners.map((p) => nodes.get(p)).filter((n): n is LayoutNode => !!n);
    if (partners.length === 0) continue;
    const kids = u.children.map((c) => ({ c, n: nodes.get(c.id) })).filter((k): k is { c: LUnion["children"][number]; n: LayoutNode } => !!k.n);
    const dx = points.get(`@d:${u.id}`) ?? partners[0].x;
    let originY: number;

    if (partners.length === 2) {
      const [a, b] = [...partners].sort((p, q) => p.x - q.x);
      const y = a.y;
      const n = a.row === b.row ? between(a, b) : -1;
      if (n === 0) {
        const x1 = a.x + s / 2;
        const x2 = b.x - s / 2;
        lines.push({
          kind: "relationship",
          points: [
            [x1, y],
            [x2, y],
          ],
          double: !!u.consanguinity,
          breakAt: u.status === "ended" ? [kids.length || u.noChildren ? (x1 + dx) / 2 : (x1 + x2) / 2, y] : undefined,
          unionId: u.id,
          ids: [a.id, b.id],
        });
        originY = y;
      } else {
        // Partner non adiacenti o su righe diverse: linea rialzata sopra i simboli.
        const level = (raisedLevel.get(a.row) ?? 0) + 1;
        raisedLevel.set(a.row, level);
        const yr = Math.min(top(a), top(b)) - 6 * level - 4;
        // Le gambe verticali partono un po' spostate verso il partner: due
        // linee rialzate dalla stessa persona non si sovrappongono.
        const ax = a.x + s * 0.2;
        const bx = b.x - s * 0.2;
        lines.push({
          kind: "relationship",
          points: [
            [ax, edgeTop(a, ax)],
            [ax, yr],
            [bx, yr],
            [bx, edgeTop(b, bx)],
          ],
          double: !!u.consanguinity,
          breakAt: u.status === "ended" ? [(a.x + dx) / 2, yr] : undefined,
          unionId: u.id,
          ids: [a.id, b.id],
        });
        originY = yr;
      }
      if (u.consanguinity?.degree) {
        const tx = (a.x + b.x) / 2;
        const ty = originY - 5;
        texts.push({ kind: "consanguinity", text: u.consanguinity.degree, x: tx, y: ty, anchor: "middle", box: textBox(u.consanguinity.degree, tx, ty, "middle", fs * 0.9) });
      }
    } else {
      originY = symbolBottom(partners[0]);
    }

    const parentRow = partners[0].row;

    if (kids.length === 0) {
      if (u.noChildren && !u.carrierOf) {
        const p0 = partners[0];
        const yStart = partners.length === 2 ? originY : symbolBottom(p0);
        const labelBottom = Math.max(...partners.map((p) => p.label.box.y2), yStart);
        const yBar = labelBottom + 8;
        lines.push({
          kind: "no-children",
          points: [
            [dx, yStart],
            [dx, yBar],
          ],
          bars: u.noChildren.kind === "infertility" ? 2 : 1,
          unionId: u.id,
          ids: u.partners,
        });
        if (u.noChildren.reason) {
          const ty = yBar + 5 + fs;
          texts.push({ kind: "no-children", text: u.noChildren.reason, x: dx, y: ty, anchor: "middle", box: textBox(u.noChildren.reason, dx, ty, "middle") });
        }
      }
      continue;
    }

    // Figli sulla riga sotto i genitori (locali) e figli disegnati altrove (legami secondari).
    const childRow = parentRow + 1;
    const ys = sibY(childRow) - (level.get(u.id) ?? 0) * LEVEL_STEP;
    const local = kids.filter((k) => g.home.get(k.c.id) === u.id && k.n.row === childRow);
    const remote = kids.filter((k) => !local.includes(k));
    const allDashed = kids.every((k) => k.c.dashed);

    // Punti di attacco: gemelli da un vertice comune.
    const groups = new Map<Id, LayoutNode[]>();
    const junction = new Map<Id, number>();
    for (const k of local) {
      const tw = ped.individuals[k.c.id].twin;
      if (tw) groups.set(tw.groupId, [...(groups.get(tw.groupId) ?? []), k.n]);
    }
    for (const k of local) {
      const tw = ped.individuals[k.c.id].twin;
      const members = tw ? groups.get(tw.groupId)! : [k.n];
      junction.set(k.c.id, members.length >= 2 ? members.reduce((acc, n) => acc + n.x, 0) / members.length : k.n.x);
    }

    if (local.length > 0) {
      const xsJ = [...new Set(local.map((k) => junction.get(k.c.id)!))];
      const lo = Math.min(dx, ...xsJ);
      const hi = Math.max(dx, ...xsJ);
      lines.push({
        kind: u.carrierOf ? "carrier" : "descent",
        points: [
          [dx, originY],
          [dx, ys],
        ],
        dashed: allDashed,
        unionId: u.id,
        ids: u.partners,
      });
      if (hi - lo > 0.5) {
        lines.push({ kind: "sibship", points: [[lo, ys], [hi, ys]], dashed: allDashed, unionId: u.id, ids: local.map((k) => k.c.id) });
      }
      for (const k of local) {
        const jx = junction.get(k.c.id)!;
        lines.push({
          kind: "individual",
          points: [
            [jx, ys],
            [k.n.x, top(k.n)],
          ],
          dashed: k.c.dashed,
          unionId: u.id,
          ids: [k.c.id],
        });
      }
      for (const members of groups.values()) {
        if (members.length < 2) continue;
        const tw = ped.individuals[members[0].id].twin!;
        const jx = members.reduce((acc, n) => acc + n.x, 0) / members.length;
        const ty = top(members[0]);
        const yb = ys + (ty - ys) * 0.5;
        const xsAt = members.map((n) => jx + (n.x - jx) * 0.5);
        const x1 = Math.min(...xsAt);
        const x2 = Math.max(...xsAt);
        if (tw.zygosity === "MZ") {
          lines.push({ kind: "twin-bar", points: [[x1, yb], [x2, yb]], unionId: u.id, ids: members.map((n) => n.id) });
        } else if (tw.zygosity === "unknown") {
          // Tra le linee all'altezza del testo; con un numero dispari la linea
          // centrale è verticale e il "?" va nello spazio a destra di essa.
          const yTop = yb - fs * 0.6;
          const rightAtTop = jx + (Math.max(...members.map((n) => n.x)) - jx) * ((yTop - ys) / (ty - ys));
          const qx = members.length % 2 === 1 ? (jx + rightAtTop) / 2 : jx;
          texts.push({ kind: "twin", text: "?", x: qx, y: yb + fs * 0.4, anchor: "middle", box: textBox("?", qx, yb + fs * 0.4, "middle") });
        }
        if (tw.proven) {
          // Oltre la linea più a destra, misurata al fondo del testo.
          const yBottom = yb + fs * 0.65;
          const rightAtBottom = jx + (Math.max(...members.map((n) => n.x)) - jx) * ((yBottom - ys) / (ty - ys));
          const tx = rightAtBottom + 3;
          texts.push({ kind: "twin", text: "*", x: tx, y: yb + fs * 0.4, anchor: "start", box: textBox("*", tx, yb + fs * 0.4, "start") });
        }
      }
    } else if (remote.length > 0) {
      // Solo figli disegnati altrove: breve discendenza fino alla quota di fratria.
      lines.push({ kind: u.carrierOf ? "carrier" : "descent", points: [[dx, originY], [dx, ys]], dashed: allDashed, unionId: u.id, ids: u.partners });
    }

    // Gravidanze portate da una gestante: la linea dei genitori intenzionali raggiunge la sua fratria.
    const carried = remote.filter((k) => g.home.get(k.n.id)?.startsWith("@carrier:") && k.n.row === childRow);
    if (carried.length && !u.carrierOf) {
      const cl = Math.min(...carried.map((k) => k.n.x));
      const ch = Math.max(...carried.map((k) => k.n.x));
      const end = Math.min(Math.max(dx, cl), ch);
      if (Math.abs(end - dx) > 0.5) {
        lines.push({ kind: "sibship", points: [[Math.min(dx, end), ys], [Math.max(dx, end), ys]], unionId: u.id, ids: carried.map((k) => k.n.id) });
      }
    }
    for (const k of remote) {
      if (u.carrierOf || carried.includes(k)) continue;
      const off = (secondaryOffset.get(childRow) ?? 0) + 1;
      secondaryOffset.set(childRow, off);
      const yy = ys - Math.min(6 * off, 18);
      const n = k.n;
      const sideX = n.x + (dx < n.x ? -1 : 1) * (s * 0.72 + 6);
      const edgeX = n.x + (dx < n.x ? -1 : 1) * (n.adopted ? s * 0.72 : s / 2);
      lines.push({
        kind: "secondary",
        points: [
          [dx, ys],
          [dx, yy],
          [sideX, yy],
          [sideX, n.y],
          [edgeX, n.y],
        ],
        dashed: k.c.dashed,
        unionId: u.id,
        ids: [n.id],
      });
    }
  }

  // Donatori: linea diagonale verso la gravidanza (nessuna linea di relazione).
  for (const u of Object.values(ped.unions)) {
    for (const c of u.children) {
      const art = c.art;
      if (c.link !== "art" || !art) continue;
      const child = nodes.get(c.id);
      if (!child) continue;
      const donors = [art.eggFrom, art.spermFrom, art.mitoFrom].filter(
        (d): d is Id => !!d && !u.partners.includes(d) && d !== art.carriedBy
      );
      for (const d of [...new Set(donors)]) {
        const dn = nodes.get(d);
        if (!dn) continue;
        const ys = sibY(child.row);
        lines.push({
          kind: "donor",
          points: [
            [dn.x, symbolBottom(dn)],
            [child.x, ys + (top(child) - ys) * 0.5],
          ],
          ids: [d, c.id],
        });
      }
    }
  }

  // Nessun figlio / infertilità di un individuo senza partner.
  for (const n of nodes.values()) {
    const ind = ped.individuals[n.id];
    if (!ind.noChildren || (g.unionsOf.get(n.id) ?? []).length > 0) continue;
    const y0 = symbolBottom(n);
    const yBar = y0 + 12;
    lines.push({ kind: "no-children", points: [[n.x, y0], [n.x, yBar]], bars: ind.noChildren.kind === "infertility" ? 2 : 1, ids: [n.id] });
    if (ind.noChildren.reason) {
      const tx = n.x + 4;
      const ty = yBar + 5 + fs;
      texts.push({ kind: "no-children", text: ind.noChildren.reason, x: tx, y: ty, anchor: "end", box: textBox(ind.noChildren.reason, tx, ty, "end") });
    }
  }
  return { lines, texts };
}
