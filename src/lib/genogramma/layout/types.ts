import type { SymbolShape, ArtRole } from "../model/notation";
import type { DisplaySettings, Id } from "../model/types";
import type { LabelLine } from "./labels";

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LayoutLabel {
  /** Punto di ancoraggio della prima riga (baseline). */
  x: number;
  y: number;
  anchor: "middle" | "start";
  lines: LabelLine[];
  lineHeight: number;
  box: Box;
}

export interface LayoutNode {
  id: Id;
  x: number;
  /** Centro del simbolo. */
  y: number;
  row: number;
  /** Numero di pedigree, es. "II-3". */
  number: string;
  shape: SymbolShape;
  /** Lato del simbolo (i triangoli sono più piccoli). */
  size: number;
  artRole?: ArtRole;
  /** Tra parentesi quadre (adottato). */
  adopted: boolean;
  /** Etichette in basso a destra (linea verticale dal simbolo). */
  labelsRight: boolean;
  symbolBox: Box;
  arrowBox?: Box;
  label: LayoutLabel;
  /** Ingombro totale (simbolo, decorazioni, etichette). */
  box: Box;
}

export type LineKind =
  | "relationship"
  | "descent"
  | "sibship"
  | "individual"
  | "twin-bar"
  | "no-children"
  | "donor"
  | "carrier"
  | "secondary";

export interface LayoutLine {
  kind: LineKind;
  points: [number, number][];
  dashed?: boolean;
  /** Linea doppia (consanguineità). */
  double?: boolean;
  /** Relazione terminata: due barre oblique al punto indicato. */
  breakAt?: [number, number];
  /** Barre orizzontali (nessun figlio: 1, infertilità: 2) all'estremo finale. */
  bars?: number;
  unionId?: Id;
  ids: Id[];
}

export type TextKind = "consanguinity" | "no-children" | "twin" | "generation";

export interface LayoutText {
  kind: TextKind;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  box: Box;
}

export interface LayoutRow {
  row: number;
  y: number;
  label: string;
}

export interface Layout {
  nodes: LayoutNode[];
  byId: Map<Id, LayoutNode>;
  lines: LayoutLine[];
  texts: LayoutText[];
  rows: LayoutRow[];
  bounds: Box;
  numbering: Record<Id, string>;
  warnings: string[];
  display: DisplaySettings;
}

export interface LayoutOptions {
  /** Esegue il verificatore delle sovrapposizioni e riporta gli avvisi. */
  check?: boolean;
}
