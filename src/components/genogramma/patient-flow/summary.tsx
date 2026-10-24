import { formatAge, formatDateValue } from "@/lib/genogramma/model/age";
import { cardSexes, siblingTitle, type PatientAnswers, type PersonAnswer } from "@/lib/genogramma/wizard/patient";

function describe(p: PersonAnswer): string {
  if (p.known === "no") return "non noto";
  if (p.skipped) return "saltato";
  const parts: string[] = [];
  if (p.initials) parts.push(p.initials);
  const by = formatDateValue(p.birthYear);
  if (by && by !== "?") parts.push(`nato/a nel ${by}`);
  else if (p.age && p.age !== "unknown") parts.push(`${formatAge(p.age)}`);
  if (p.alive === "no") parts.push(`deceduto/a${p.deathAge && p.deathAge !== "unknown" ? ` a ${formatAge(p.deathAge)}` : ""}${p.deathCause ? ` (${p.deathCause})` : ""}`);
  if (p.alive === "unknown") parts.push("non so se è in vita");
  if (p.health.length) parts.push(p.health.map((h) => h.label + (h.onset && h.onset !== "unknown" ? `, da ${formatAge(h.onset)}` : "")).join("; "));
  if (p.healthUnknown) parts.push("salute: non lo so");
  return parts.join(" · ") || "nessun dato";
}

/** Riepilogo leggibile delle risposte, prima di creare il disegno. */
export function PatientSummary({ answers: a }: { answers: PatientAnswers }) {
  const rows: [string, string][] = [];
  rows.push(["Persona per cui si compila", describe(a.proband)]);
  rows.push(["Madre", describe(a.mother)]);
  rows.push(["Padre", describe(a.father)]);
  if (a.parentsRelated === "yes") rows.push(["Genitori parenti tra loro", a.parentsRelatedHow || "sì"]);
  a.siblingCards.forEach((c, i) => rows.push([siblingTitle(a, i), describe(c)]));
  a.childCards.forEach((c, i) => rows.push([`${c.sex === "male" ? "Figlio" : c.sex === "female" ? "Figlia" : "Figlio/a"} ${i + 1}`, describe(c)]));
  const gpLabel = { pf: "Nonno paterno", pm: "Nonna paterna", mf: "Nonno materno", mm: "Nonna materna" } as const;
  for (const k of ["pf", "pm", "mf", "mm"] as const) {
    const p = a.grandparents[k];
    if (p.known !== undefined || p.health.length || p.birthYear !== undefined) rows.push([gpLabel[k], describe(p)]);
  }
  const paternal = cardSexes(a.unclesPaternal).length;
  a.uncleCards.forEach((c, i) => rows.push([`${c.sex === "female" ? "Zia" : "Zio"} ${i < paternal ? "da parte di padre" : "da parte di madre"}`, describe(c)]));
  if (a.losses.length) rows.push(["Gravidanze non a termine", a.losses.map((l) => `${l.outcome}${l.weeks ? ` (${l.weeks} sett.)` : ""}`).join(", ")]);
  if (a.ancestryPaternal) rows.push(["Origine famiglia del padre", a.ancestryPaternal]);
  if (a.ancestryMaternal) rows.push(["Origine famiglia della madre", a.ancestryMaternal]);
  if (a.reason) rows.push(["Motivo della visita", a.reason]);
  return (
    <dl className="divide-y divide-neutral-200 border-y border-neutral-200 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr]">
          <dt className="font-medium text-neutral-800">{k}</dt>
          <dd className="text-neutral-600">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
