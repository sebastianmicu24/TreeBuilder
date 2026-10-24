"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { uuid } from "@/lib/genogramma/model/create";
import type { Gender, Pedigree, PregnancyOutcome, Sex } from "@/lib/genogramma/model/types";
import {
  buildFromPatient,
  buildSteps,
  cardSexes,
  emptyAnswers,
  skippedSteps,
  syncCards,
  type CountAnswer,
  type PatientAnswers,
  type PersonAnswer,
  type Step,
} from "@/lib/genogramma/wizard/patient";
import { Stepper } from "../doctor-wizard";
import { AgeInput, DateInput, FieldRow, Select, TextInput } from "../fields";
import { GENDER_OPTIONS, SEX_OPTIONS } from "../options";
import { Choice, HealthEditor, PersonCard, YNU } from "./person-card";
import { PatientSummary } from "./summary";

/**
 * Questionario a passi per pazienti e familiari: poche domande per
 * schermata, "Non lo so" sempre disponibile, indietro senza perdere dati,
 * una scheda per ogni familiare con "Salta per ora" e ripresa dal
 * riepilogo. Alla fine si genera il genogramma (solo nel browser).
 */
export function PatientFlow({
  initial,
  onDone,
  onChange,
}: {
  initial?: PatientAnswers;
  onDone: (pedigree: Pedigree, answers: PatientAnswers) => void;
  onChange?: (answers: PatientAnswers) => void;
}) {
  const [a, setA] = useState<PatientAnswers>(initial ?? emptyAnswers());
  const [i, setI] = useState(0);
  const steps = buildSteps(a);
  const index = Math.min(i, steps.length - 1);
  const step = steps[index];

  const touched = useRef(false);
  const update = (fn: (prev: PatientAnswers) => PatientAnswers) => {
    touched.current = true;
    setA(fn);
  };
  // Il genitore (bozza locale) riceve le risposte dopo il render, mai durante;
  // finché non si risponde a nulla non si crea alcuna bozza.
  useEffect(() => {
    if (touched.current) onChange?.(a);
  }, [a, onChange]);
  const go = (n: number) => {
    setI(Math.max(0, Math.min(steps.length - 1, n)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const skip = () => {
    update((p) => markSkipped(p, step));
    go(index + 1);
  };
  const repeatable = ["sibling", "child", "uncle", "grandparent", "mother", "father"].includes(step.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand-700">
          Passo {index + 1} di {steps.length}
        </p>
        <p className="text-xs text-neutral-500">I dati restano su questo dispositivo.</p>
      </div>
      <div className="mt-2 h-1 w-full rounded bg-neutral-200" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label="Avanzamento">
        <div className="h-1 rounded bg-brand-600 transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <section className="mt-6 space-y-5" aria-labelledby="pf-title">
        <h1 id="pf-title" className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">
          {step.title}
        </h1>
        <StepBody step={step} a={a} update={update} onDone={onDone} goTo={(s) => go(steps.findIndex((x) => x.id === s.id && x.index === s.index && x.gp === s.gp))} steps={steps} />
      </section>

      {step.id !== "summary" ? (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
          <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
            Indietro
          </Button>
          <div className="flex gap-2">
            {repeatable ? (
              <Button variant="secondary" onClick={skip}>
                Salta per ora
              </Button>
            ) : null}
            <Button onClick={() => go(index + 1)}>Avanti</Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 border-t border-neutral-200 pt-4">
          <Button variant="ghost" onClick={() => go(index - 1)}>
            Indietro
          </Button>
        </div>
      )}
    </div>
  );
}

function markSkipped(p: PatientAnswers, s: Step): PatientAnswers {
  const mark = (x: PersonAnswer): PersonAnswer => ({ ...x, skipped: true });
  if (s.id === "sibling") return { ...p, siblingCards: p.siblingCards.map((c, k) => (k === s.index ? mark(c) : c)) };
  if (s.id === "child") return { ...p, childCards: p.childCards.map((c, k) => (k === s.index ? mark(c) : c)) };
  if (s.id === "uncle") return { ...p, uncleCards: p.uncleCards.map((c, k) => (k === s.index ? mark(c) : c)) };
  if (s.id === "grandparent") return { ...p, grandparents: { ...p.grandparents, [s.gp!]: mark(p.grandparents[s.gp!]) } };
  if (s.id === "mother") return { ...p, mother: mark(p.mother) };
  if (s.id === "father") return { ...p, father: mark(p.father) };
  return p;
}

function Counts({ title, value, onChange, labels }: { title: string; value: CountAnswer; onChange: (v: CountAnswer) => void; labels: [string, string, string] }) {
  return (
    <Panel className="space-y-2 p-4">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <Stepper label={labels[0]} value={value.male} onChange={(n) => onChange({ ...value, male: n })} />
      <Stepper label={labels[1]} value={value.female} onChange={(n) => onChange({ ...value, female: n })} />
      <Stepper label={labels[2]} value={value.unknown} onChange={(n) => onChange({ ...value, unknown: n })} />
    </Panel>
  );
}

const LOSS_OPTIONS: { value: Exclude<PregnancyOutcome, "ongoing">; label: string }[] = [
  { value: "SAB", label: "Aborto spontaneo" },
  { value: "TOP", label: "Interruzione volontaria o terapeutica" },
  { value: "ECT", label: "Gravidanza extrauterina" },
  { value: "SB", label: "Nato morto" },
];

function StepBody({
  step,
  a,
  update,
  onDone,
  goTo,
  steps,
}: {
  step: Step;
  a: PatientAnswers;
  update: (fn: (p: PatientAnswers) => PatientAnswers) => void;
  onDone: (pedigree: Pedigree, answers: PatientAnswers) => void;
  goTo: (s: Step) => void;
  steps: Step[];
}) {
  const pid = `pf-${step.id}-${step.index ?? step.gp ?? ""}`;
  switch (step.id) {
    case "respondent":
      return (
        <div className="space-y-5">
          <Choice
            label="Per chi stai compilando?"
            value={a.respondent}
            onChange={(v) => update((p) => ({ ...p, respondent: v }))}
            options={[
              { value: "self", label: "Per me", hint: "Sono io la persona che va alla visita" },
              { value: "parent", label: "Per mio figlio o mia figlia", hint: "Sono un genitore" },
              { value: "other", label: "Per un'altra persona", hint: "Es. un familiare che assisto" },
            ]}
          />
          {a.respondent === "parent" ? (
            <Choice
              label="Tu sei"
              value={a.respondentRole}
              onChange={(v) => update((p) => ({ ...p, respondentRole: v }))}
              options={[
                { value: "mother", label: "La madre" },
                { value: "father", label: "Il padre" },
                { value: "other", label: "Altro" },
              ]}
            />
          ) : null}
          <Alert>Non serve scrivere nomi: le domande riguardano età, salute e legami di parentela. Puoi rispondere &quot;Non lo so&quot; a tutto.</Alert>
        </div>
      );
    case "proband":
      return (
        <div className="space-y-5">
          <Choice
            label="Sesso"
            value={a.proband.sex === "unassigned" ? undefined : a.proband.sex}
            onChange={(v) => update((p) => ({ ...p, proband: { ...p.proband, sex: v as Sex } }))}
            options={[
              { value: "male", label: "Maschio" },
              { value: "female", label: "Femmina" },
              { value: "unknown", label: "Preferisco non dirlo" },
            ]}
          />
          <details className="rounded-md border border-neutral-200 bg-white p-3">
            <summary className="cursor-pointer text-sm text-neutral-600">Altre opzioni (identità di genere)</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <FieldRow label="Identità di genere" htmlFor={`${pid}-gen`} hint="Di solito è come il sesso alla nascita: cambiala solo se è diversa.">
                <Select
                  id={`${pid}-gen`}
                  value={a.proband.gender ?? "not-expressed"}
                  onChange={(v) => update((p) => ({ ...p, proband: { ...p.proband, gender: v as Gender } }))}
                  options={GENDER_OPTIONS}
                />
              </FieldRow>
              <FieldRow label="Sesso assegnato alla nascita" htmlFor={`${pid}-sex`}>
                <Select id={`${pid}-sex`} value={a.proband.sex ?? "unknown"} onChange={(v) => update((p) => ({ ...p, proband: { ...p.proband, sex: v as Sex } }))} options={SEX_OPTIONS} />
              </FieldRow>
            </div>
          </details>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Anno di nascita" htmlFor={`${pid}-by`}>
              <DateInput id={`${pid}-by`} value={a.proband.birthYear} onCommit={(v) => update((p) => ({ ...p, proband: { ...p.proband, birthYear: v } }))} />
            </FieldRow>
            <FieldRow label="Oppure l'età" htmlFor={`${pid}-age`}>
              <AgeInput id={`${pid}-age`} value={a.proband.age} onCommit={(v) => update((p) => ({ ...p, proband: { ...p.proband, age: v } }))} />
            </FieldRow>
          </div>
        </div>
      );
    case "probandHealth":
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">Quali problemi di salute sono importanti per la visita? Indica anche l&apos;età in cui sono comparsi, se la ricordi.</p>
          <HealthEditor
            idPrefix={pid}
            value={a.proband.health}
            unknown={a.proband.healthUnknown}
            onChange={(health) => update((p) => ({ ...p, proband: { ...p.proband, health } }))}
            onUnknown={(v) => update((p) => ({ ...p, proband: { ...p.proband, healthUnknown: v || undefined } }))}
          />
        </div>
      );
    case "mother":
    case "father": {
      const key = step.id;
      const person = a[key];
      return (
        <div className="space-y-5">
          <Choice
            label={key === "mother" ? "Conosci la madre biologica?" : "Conosci il padre biologico?"}
            value={person.known}
            onChange={(v) => update((p) => ({ ...p, [key]: { ...p[key], known: v, skipped: false } }))}
            options={[
              { value: "yes", label: "Sì" },
              { value: "no", label: "No" },
              { value: "unknown", label: "Solo in parte" },
            ]}
          />
          {person.known !== "no" ? <PersonCard idPrefix={pid} value={person} onChange={(v) => update((p) => ({ ...p, [key]: v }))} /> : null}
        </div>
      );
    }
    case "parentsRelated":
      return (
        <div className="space-y-5">
          <Choice label="I genitori sono parenti tra loro (per esempio cugini)?" value={a.parentsRelated} onChange={(v) => update((p) => ({ ...p, parentsRelated: v }))} options={YNU} />
          {a.parentsRelated === "yes" ? (
            <FieldRow label="Che parentela?" htmlFor={`${pid}-how`}>
              <TextInput id={`${pid}-how`} value={a.parentsRelatedHow} onCommit={(v) => update((p) => ({ ...p, parentsRelatedHow: v }))} placeholder="es. cugini di primo grado" maxLength={60} />
            </FieldRow>
          ) : null}
        </div>
      );
    case "siblingsCount": {
      const set = (k: "siblings" | "halfPaternal" | "halfMaternal", v: CountAnswer) =>
        update((p) => {
          const next = { ...p, [k]: v };
          return { ...next, siblingCards: syncCards(p.siblingCards, cardSexes(next.siblings, next.halfPaternal, next.halfMaternal)) };
        });
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">Non contare la persona per cui compili. Dopo ti chiederemo qualche dato per ciascuno.</p>
          <Counts title="Con entrambi i genitori in comune" value={a.siblings} onChange={(v) => set("siblings", v)} labels={["Fratelli", "Sorelle", "Non so / non specificato"]} />
          <Counts title="Solo con lo stesso padre" value={a.halfPaternal} onChange={(v) => set("halfPaternal", v)} labels={["Fratelli", "Sorelle", "Non so / non specificato"]} />
          <Counts title="Solo con la stessa madre" value={a.halfMaternal} onChange={(v) => set("halfMaternal", v)} labels={["Fratelli", "Sorelle", "Non so / non specificato"]} />
        </div>
      );
    }
    case "sibling":
    case "child":
    case "uncle": {
      const key = step.id === "sibling" ? "siblingCards" : step.id === "child" ? "childCards" : "uncleCards";
      const card = a[key][step.index!];
      if (!card) return null;
      return (
        <PersonCard
          idPrefix={pid}
          value={card}
          askSex={card.sex === "unknown"}
          onChange={(v) => update((p) => ({ ...p, [key]: p[key].map((c, k) => (k === step.index ? v : c)) }))}
        />
      );
    }
    case "childrenCount":
      return (
        <Counts
          title="Figli della persona per cui compili"
          value={a.children}
          onChange={(v) => update((p) => ({ ...p, children: v, childCards: syncCards(p.childCards, cardSexes(v)) }))}
          labels={["Figli", "Figlie", "Non so / non specificato"]}
        />
      );
    case "grandparent": {
      const gp = step.gp!;
      const person = a.grandparents[gp];
      const setGp = (v: PersonAnswer) => update((p) => ({ ...p, grandparents: { ...p.grandparents, [gp]: v } }));
      return (
        <div className="space-y-5">
          <Choice label="Hai informazioni su questa persona?" value={person.known} onChange={(v) => setGp({ ...person, known: v, skipped: false })} options={[{ value: "yes", label: "Sì" }, { value: "no", label: "No" }, { value: "unknown", label: "Poche" }]} />
          {person.known !== "no" ? <PersonCard idPrefix={pid} value={person} onChange={setGp} /> : null}
        </div>
      );
    }
    case "unclesCount": {
      const set = (k: "unclesPaternal" | "unclesMaternal", v: CountAnswer) =>
        update((p) => {
          const next = { ...p, [k]: v };
          return { ...next, uncleCards: syncCards(p.uncleCards, cardSexes(next.unclesPaternal, next.unclesMaternal)) };
        });
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">Fratelli e sorelle dei genitori.</p>
          {a.father.known !== "no" ? <Counts title="Dalla parte del padre" value={a.unclesPaternal} onChange={(v) => set("unclesPaternal", v)} labels={["Zii", "Zie", "Non so / non specificato"]} /> : null}
          {a.mother.known !== "no" ? <Counts title="Dalla parte della madre" value={a.unclesMaternal} onChange={(v) => set("unclesMaternal", v)} labels={["Zii", "Zie", "Non so / non specificato"]} /> : null}
        </div>
      );
    }
    case "losses":
      return (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">La madre ha avuto gravidanze che non sono arrivate al termine? Se non lo sai, vai avanti.</p>
          {a.losses.map((l, k) => (
            <div key={k} className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 p-2.5">
              <FieldRow label="Che cosa è successo" htmlFor={`${pid}-t-${k}`}>
                <Select id={`${pid}-t-${k}`} value={l.outcome} onChange={(v) => update((p) => ({ ...p, losses: p.losses.map((x, j) => (j === k ? { ...x, outcome: v as "SAB" } : x)) }))} options={LOSS_OPTIONS} />
              </FieldRow>
              <FieldRow label="Settimana (se la sai)" htmlFor={`${pid}-w-${k}`}>
                <TextInput
                  id={`${pid}-w-${k}`}
                  value={l.weeks !== undefined ? String(l.weeks) : undefined}
                  onCommit={(v) => {
                    const n = v ? Number(v) : undefined;
                    if (n !== undefined && (!Number.isFinite(n) || n < 1 || n > 45)) return;
                    update((p) => ({ ...p, losses: p.losses.map((x, j) => (j === k ? { ...x, weeks: n } : x)) }));
                  }}
                  maxLength={2}
                />
              </FieldRow>
              <Button size="sm" variant="ghost" aria-label="Rimuovi" onClick={() => update((p) => ({ ...p, losses: p.losses.filter((_, j) => j !== k) }))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => update((p) => ({ ...p, losses: [...p.losses, { outcome: "SAB" }] }))}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Aggiungi
          </Button>
        </div>
      );
    case "origins":
      return (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">Da dove vengono le famiglie? Alcune condizioni sono più frequenti in certe popolazioni.</p>
          {a.father.known !== "no" ? (
            <FieldRow label="Famiglia del padre" htmlFor={`${pid}-p`}>
              <TextInput id={`${pid}-p`} value={a.ancestryPaternal} onCommit={(v) => update((p) => ({ ...p, ancestryPaternal: v }))} placeholder="es. Sicilia, Marocco" maxLength={120} />
            </FieldRow>
          ) : null}
          {a.mother.known !== "no" ? (
            <FieldRow label="Famiglia della madre" htmlFor={`${pid}-m`}>
              <TextInput id={`${pid}-m`} value={a.ancestryMaternal} onCommit={(v) => update((p) => ({ ...p, ancestryMaternal: v }))} placeholder="es. Veneto, Romania" maxLength={120} />
            </FieldRow>
          ) : null}
        </div>
      );
    case "reason":
      return (
        <FieldRow label="Perché è stata richiesta la visita?" htmlFor={`${pid}-r`} hint="Facoltativo. Es. ritardo dello sviluppo, tumori in famiglia, ecografia in gravidanza.">
          <TextInput id={`${pid}-r`} value={a.reason} onCommit={(v) => update((p) => ({ ...p, reason: v }))} multiline maxLength={400} />
        </FieldRow>
      );
    case "summary": {
      const skipped = skippedSteps(a, steps);
      return (
        <div className="space-y-5">
          {skipped.length ? (
            <Alert>
              Hai saltato: {" "}
              {skipped.map((s, k) => (
                <span key={`${s.id}-${s.index ?? s.gp}`}>
                  {k ? ", " : ""}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => goTo(s)}>
                    {s.title}
                  </button>
                </span>
              ))}
              . Puoi riprenderli ora o lasciarli vuoti.
            </Alert>
          ) : null}
          <PatientSummary answers={a} />
          <Button size="lg" onClick={() => onDone(buildFromPatient(a, uuid), a)}>
            Crea il genogramma
          </Button>
        </div>
      );
    }
  }
}
