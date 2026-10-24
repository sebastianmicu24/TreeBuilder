import { artRoles, symbolShape, type ArtRole, type SymbolShape } from "../model/notation";
import type { DisplaySettings, Id, Pedigree } from "../model/types";
import { textWidth } from "./font-metrics";
import type { LGraph } from "./graph";
import { labelLines, measureLabel, roman, type LabelLine } from "./labels";
import type { Box } from "./types";

/**
 * Ingombro di ogni simbolo con decorazioni ed etichette, relativo al
 * centro del simbolo. È ciò che il layout usa per i contorni: il testo
 * reale (a capo compreso) entra nelle distanze, nessuna sovrapposizione.
 */
export interface Measured {
  shape: SymbolShape;
  size: number;
  artRole?: ArtRole;
  adopted: boolean;
  labelsRight: boolean;
  lines: LabelLine[];
  lineHeight: number;
  /** Relativi al centro (0,0). */
  symbolBox: Box;
  /** Freccia del probando/consultando (in basso a sinistra), separata dal simbolo. */
  arrowBox?: Box;
  labelBox: Box;
  labelAnchor: { x: number; y: number; anchor: "middle" | "start" };
  /** Estensione orizzontale a sinistra e a destra del centro. */
  extL: number;
  extR: number;
  /** Estensione sotto il centro (simbolo + etichette). */
  bottom: number;
}

/** Geometria delle decorazioni, condivisa con il renderer. */
export const GEOM = {
  deathReach: 0.65,
  bracketX: 0.72,
  bracketY: 0.62,
  triangle: 0.62,
  arrowTail: [-1.0, 0.85] as const,
  arrowTip: [-0.5, 0.42] as const,
};

function union(a: Box, b: Box): Box {
  return { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) };
}

export function measureAll(
  ped: Pedigree,
  graph: LGraph,
  rows: Map<Id, number>,
  display: DisplaySettings
): Map<Id, Measured> {
  const s = display.symbolSize;
  const fs = display.fontSize;
  const font = display.fontFamily;
  const roles = artRoles(ped);

  // Larghezza del numero di pedigree stimata dal massimo per riga (prima del posizionamento).
  const perRow = new Map<number, number>();
  for (const id of graph.visible) perRow.set(rows.get(id)!, (perRow.get(rows.get(id)!) ?? 0) + 1);

  const adoptedIds = new Set<Id>();
  for (const u of Object.values(ped.unions)) {
    for (const c of u.children) {
      if (c.link === "adoptive" || c.adoptedOut) adoptedIds.add(c.id);
    }
  }

  const out = new Map<Id, Measured>();
  for (const id of graph.visible) {
    const ind = ped.individuals[id];
    const row = rows.get(id)!;
    const shape = symbolShape(ind);
    const role = roles.get(id);
    const adopted = adoptedIds.has(id);
    const deceased = ind.vital === "deceased";
    const index = id === ped.proband || ped.consultands.includes(id);

    const sole = (graph.unionsOf.get(id) ?? []).some(
      (u) => u.partners.length === 1 && (u.children.length > 0 || !!u.noChildren)
    );
    const alone = (graph.unionsOf.get(id) ?? []).length === 0 && !!ind.noChildren;
    const labelsRight = sole || alone || role === "donor";

    const half = shape === "triangle" ? (s * GEOM.triangle) / 2 : s / 2;
    let sym: Box =
      shape === "triangle"
        ? { x1: -half, y1: -s / 2, x2: half, y2: -s / 2 + s * GEOM.triangle * 0.9 }
        : { x1: -s / 2, y1: -s / 2, x2: s / 2, y2: s / 2 };
    if (deceased || ind.pregnancy?.outcome === "ECT" || ind.pregnancy?.outcome === "TOP") {
      const r = shape === "triangle" ? half * 1.25 : s * GEOM.deathReach;
      const cy = (sym.y1 + sym.y2) / 2;
      sym = union(sym, { x1: -r, y1: cy - r, x2: r, y2: cy + r });
    }
    if (adopted) sym = union(sym, { x1: -s * GEOM.bracketX, y1: -s * GEOM.bracketY, x2: s * GEOM.bracketX, y2: s * GEOM.bracketY });
    let arrow: Box | null = null;
    if (index) {
      const pw = id === ped.proband ? textWidth("P", fs, font, true) + 2 : 0;
      arrow = { x1: s * GEOM.arrowTail[0] - pw - 2, y1: s * 0.3, x2: -s * 0.45, y2: s * GEOM.arrowTail[1] + fs * 0.4 };
    }
    if (ind.familyHistoryUnknown) {
      sym = union(sym, { x1: 0, y1: -s / 2 - fs * 1.1, x2: s * 0.3 + textWidth("?", fs * 1.1, font, true) + 2, y2: 0 });
    }
    if (alone && ind.noChildren) {
      const w = ind.noChildren.reason ? textWidth(ind.noChildren.reason, fs, font) : 0;
      sym = union(sym, { x1: -w, y1: 0, x2: 6, y2: s / 2 + 17 + fs * 1.25 });
    }
    let starW = 0;
    if (ind.documentedEvaluation) {
      starW = textWidth("*", fs * 1.3, font) + 3;
      sym = union(sym, { x1: 0, y1: 0, x2: s / 2 + starW, y2: s / 2 });
    }

    const romanW = `${roman(row + 1)}-${perRow.get(row) ?? 1}`;
    const lines = labelLines(ped, ind, display.showNumbers ? romanW : undefined, display);
    const measured = measureLabel(lines, display);
    // Il numero reale si inserisce dopo: si misura con la larghezza massima.
    let labelBox: Box;
    let anchor: Measured["labelAnchor"];
    if (labelsRight) {
      const x0 = s / 2 + Math.max(starW, 3) + 2;
      const y0 = s * 0.12;
      labelBox = { x1: x0, y1: y0, x2: x0 + measured.width, y2: y0 + measured.height };
      anchor = { x: x0, y: y0 + fs, anchor: "start" };
    } else {
      let y0 = sym.y2 + display.textGap;
      // La freccia del probando sposta in basso le etichette solo se le toccherebbe.
      if (arrow && -measured.width / 2 < arrow.x2 + 2 && y0 < arrow.y2) y0 = arrow.y2 + 2;
      labelBox = { x1: -measured.width / 2, y1: y0, x2: measured.width / 2, y2: y0 + measured.height };
      anchor = { x: 0, y: y0 + fs, anchor: "middle" };
    }

    if (measured.lines.length === 0) labelBox = { x1: 0, y1: sym.y2, x2: 0, y2: sym.y2 };
    const all = union(arrow ? union(sym, arrow) : sym, labelBox);
    out.set(id, {
      shape,
      size: s,
      artRole: role,
      adopted,
      labelsRight,
      lines: measured.lines,
      lineHeight: measured.lineHeight,
      symbolBox: sym,
      arrowBox: arrow ?? undefined,
      labelBox,
      labelAnchor: anchor,
      extL: -all.x1,
      extR: all.x2,
      bottom: all.y2,
    });
  }
  return out;
}
