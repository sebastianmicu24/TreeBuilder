import { isMaleLike } from "./queries";
import type { Id, Individual, IndividualEvaluation, Pedigree } from "./types";

/**
 * Regole di notazione NSGC che dipendono solo dal modello: forma del
 * simbolo, annotazione del sesso assegnato alla nascita, lettere dentro il
 * simbolo, notazione delle valutazioni. Usate da layout e renderer.
 */

export type SymbolShape = "square" | "circle" | "diamond" | "triangle";

/**
 * La forma segue l'identità di genere (2022). Con genere non espresso o
 * ignoto si assumono sesso e genere allineati. Triangolo per SAB, TOP ed ECT.
 */
export function symbolShape(ind: Individual): SymbolShape {
  const outcome = ind.pregnancy?.outcome;
  if (outcome === "SAB" || outcome === "TOP" || outcome === "ECT") return "triangle";
  switch (ind.gender) {
    case "man":
      return "square";
    case "woman":
      return "circle";
    case "non-binary":
      return "diamond";
    default:
      if (ind.sex === "male") return "square";
      if (ind.sex === "female") return "circle";
      return "diamond";
  }
}

/** AMAB, AFAB o UAAB: solo se il sesso assegnato non coincide con il genere. */
export function sexAnnotation(ind: Individual): "AMAB" | "AFAB" | "UAAB" | null {
  if (ind.pregnancy && ind.pregnancy.outcome !== "SB" && ind.pregnancy.outcome !== "ongoing") return null;
  const { sex, gender } = ind;
  if (sex === "unknown") return null;
  if (gender === "unknown" || gender === "not-expressed") return sex === "unassigned" ? "UAAB" : null;
  if (sex === "unassigned") return "UAAB";
  if (gender === "man") return sex === "female" ? "AFAB" : null;
  if (gender === "woman") return sex === "male" ? "AMAB" : null;
  return sex === "male" ? "AMAB" : "AFAB";
}

export type ArtRole = "donor" | "gestationalCarrier" | "surrogate";

/** Ruoli ART ricavati dai dettagli dei figli (non salvati due volte). */
export function artRoles(ped: Pedigree): Map<Id, ArtRole> {
  const roles = new Map<Id, ArtRole>();
  for (const u of Object.values(ped.unions)) {
    for (const c of u.children) {
      const art = c.art;
      if (c.link !== "art" || !art) continue;
      const partner = (x?: Id) => !!x && u.partners.includes(x);
      if (art.carriedBy && !partner(art.carriedBy)) {
        roles.set(art.carriedBy, art.carriedBy === art.eggFrom ? "surrogate" : "gestationalCarrier");
      }
      for (const d of [art.eggFrom, art.spermFrom, art.mitoFrom]) {
        if (d && !partner(d) && !roles.has(d)) roles.set(d, "donor");
      }
    }
  }
  return roles;
}

/** Lettera dentro il simbolo: P (gravidanza), D (donatore o surrogata), G (gestante per altri). */
export function innerLetter(ind: Individual, role: ArtRole | undefined): string | null {
  if (ind.pregnancy?.outcome === "ongoing") return "P";
  if (role === "donor" || role === "surrogate") return "D";
  if (role === "gestationalCarrier") return "G";
  return null;
}

/** Numero (o "n") dentro il simbolo per gli individui multipli. */
export function multipleLabel(ind: Individual): string | null {
  if (ind.multiple === undefined) return null;
  return String(ind.multiple);
}

/**
 * Notazione NSGC di una valutazione: `E`, oppure `E1…En` quando la legenda
 * ha più tipi; esito `+`, `-`, `u`; dettaglio tra parentesi.
 */
export function evaluationNotation(ped: Pedigree, ev: IndividualEvaluation): string {
  const types = ped.legend.evaluations;
  let prefix = "E";
  if (types.length > 1 && ev.evaluationId) {
    const index = types.findIndex((t) => t.id === ev.evaluationId);
    if (index >= 0) prefix = `E${index + 1}`;
  }
  const detail =
    ev.detail?.trim() ||
    (ev.repeats ? `${ev.repeats[0]}/${ev.repeats[1]}` : "") ||
    [ev.variant, ev.gene].filter(Boolean).join(" ");
  return `${prefix}${ev.result}${detail ? ` (${detail})` : ""}`;
}

/** Lato della coppia secondo la convenzione di progetto "uomo a sinistra". */
export function prefersLeft(ind: Individual | undefined): boolean {
  return isMaleLike(ind);
}
