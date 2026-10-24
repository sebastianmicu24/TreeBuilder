import { t } from "../i18n";
import { computeAge, formatAge, formatDateValue } from "../model/age";
import { evaluationNotation, sexAnnotation } from "../model/notation";
import type { DisplaySettings, Individual, Pedigree } from "../model/types";
import { textWidth, wrapText } from "./font-metrics";

/**
 * Righe di etichetta sotto il simbolo, nell'ordine NSGC:
 * AMAB/AFAB/UAAB, età o b./d. (e causa di morte), cariotipo, numero di
 * pedigree; poi, se attivi, etichetta, condizioni, valutazioni, note.
 * L'asterisco della valutazione documentata va accanto al simbolo.
 */
export type LabelKind =
  | "sex"
  | "age"
  | "cause"
  | "karyotype"
  | "pregnancy"
  | "number"
  | "name"
  | "condition"
  | "evaluation"
  | "note";

export interface LabelLine {
  text: string;
  kind: LabelKind;
}

export interface MeasuredLabel {
  lines: LabelLine[];
  width: number;
  height: number;
  lineHeight: number;
}

export function labelLines(
  ped: Pedigree,
  ind: Individual,
  number: string | undefined,
  display: DisplaySettings
): LabelLine[] {
  const lang = display.language;
  const out: LabelLine[] = [];
  const push = (text: string | undefined | null, kind: LabelKind) => {
    const v = text?.trim();
    if (v) out.push({ text: v, kind });
  };

  if (!ind.placeholder) {
    push(sexAnnotation(ind), "sex");
    const preg = ind.pregnancy;
    if (preg) {
      const weeks = preg.gestationalWeeks !== undefined ? `${preg.gestationalWeeks} wk` : "";
      const head = preg.outcome === "ongoing" ? weeks : [preg.outcome, weeks].filter(Boolean).join(" ");
      push(head, "pregnancy");
      push([preg.result ?? ind.karyotype, preg.method].filter(Boolean).join(" / "), "pregnancy");
    } else {
      if (ind.vital === "deceased") {
        const birthYear = formatDateValue(ind.birth);
        const deathAge = ind.death?.age !== undefined && ind.death.age !== "unknown" ? formatAge(ind.death.age) : "";
        const deathDate = formatDateValue(ind.death?.date);
        if (deathAge) {
          push(`${t(lang, "death")} ${deathAge}`, "age");
        } else {
          if (birthYear && birthYear !== "?") push(`${t(lang, "birth")} ${birthYear}`, "age");
          if (deathDate && deathDate !== "?") push(`${t(lang, "death")} ${deathDate}`, "age");
        }
        push(ind.death?.cause, "cause");
      } else {
        const age = computeAge(ind, ped.date);
        // Solo l'anno di nascita: si scrive "b. 1978" (raccomandazione NSGC), non un'età stimata.
        const yearOnly = ind.age === undefined && typeof ind.birth === "string" && /^\d{4}$/.test(ind.birth);
        if (age && age !== "unknown" && !yearOnly) push(formatAge(age), "age");
        else {
          const year = formatDateValue(ind.birth);
          if (year && year !== "?") push(`${t(lang, "birth")} ${year}`, "age");
        }
      }
      push(ind.karyotype, "karyotype");
    }
  }

  if (display.showNumbers && number) push(number, "number");
  if (display.showLabel) push(ind.label ?? ind.name, "name");

  if (display.showConditions && !ind.placeholder) {
    for (const c of ind.conditions) {
      const legend = ped.legend.conditions.find((l) => l.id === c.conditionId);
      if (!legend) continue;
      const status =
        c.status === "carrier"
          ? lang === "it"
            ? " (portatore)"
            : " (carrier)"
          : c.status === "presymptomatic"
            ? lang === "it"
              ? " (presintomatico)"
              : " (presymptomatic)"
            : "";
      const onset =
        c.onset !== undefined && c.onset !== "unknown"
          ? `, ${t(lang, "onset")} ${formatAge(c.onset)}`
          : c.diagnosis !== undefined && c.diagnosis !== "unknown"
            ? `, ${t(lang, "diagnosis")} ${formatAge(c.diagnosis)}`
            : "";
      push(`${legend.label}${status}${onset}`, "condition");
    }
  }
  if (display.showEvaluations && !ind.placeholder) {
    for (const ev of ind.evaluations) push(evaluationNotation(ped, ev), "evaluation");
  }
  if (display.showNotes && !ind.placeholder) push(ind.notes, "note");
  return out;
}

/** Righe a capo alla larghezza massima, con ingombro reale. */
export function measureLabel(lines: LabelLine[], display: DisplaySettings): MeasuredLabel {
  const { fontSize, fontFamily, labelMaxWidth } = display;
  const wrapped: LabelLine[] = [];
  for (const line of lines) {
    for (const part of wrapText(line.text, labelMaxWidth, fontSize, fontFamily)) {
      wrapped.push({ text: part, kind: line.kind });
    }
  }
  const lineHeight = Math.round(fontSize * 1.25 * 100) / 100;
  let width = 0;
  for (const l of wrapped) width = Math.max(width, textWidth(l.text, fontSize, fontFamily));
  return { lines: wrapped, width, height: wrapped.length * lineHeight, lineHeight };
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  let out = "";
  let rest = n;
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}
