"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uuid } from "@/lib/genogramma/model/create";
import type { Gender, Pedigree, Sex } from "@/lib/genogramma/model/types";
import {
  buildFromDoctorWizard,
  EMPTY_COUNTS,
  type Counts,
  type DetailLevel,
} from "@/lib/genogramma/wizard/doctor";
import { cn } from "@/lib/utils";
import { FieldRow, NumberStepper, Segmented, Select } from "./fields";
import { GENDER_OPTIONS } from "./options";

const LEVELS: { id: DetailLevel; label: string; hint: string }[] = [
  { id: "parents", label: "Genitori", hint: "Probando, genitori, fratelli e figli" },
  { id: "grandparents", label: "Nonni", hint: "I quattro nonni" },
  { id: "great-grandparents", label: "Bisnonni", hint: "Anche gli otto bisnonni" },
];

type GroupKey = "siblings" | "paternal" | "maternal" | "children";

const GROUPS: { key: GroupKey; title: string; labels: [string, string, string] }[] = [
  { key: "siblings", title: "Fratelli e sorelle", labels: ["Maschi", "Femmine", "Non specificato"] },
  { key: "children", title: "Figli del probando", labels: ["Maschi", "Femmine", "Non specificato"] },
  { key: "paternal", title: "Zii paterni", labels: ["Zii", "Zie", "Non specificato"] },
  { key: "maternal", title: "Zii materni", labels: ["Zii", "Zie", "Non specificato"] },
];

/** Contatore riutilizzato dal questionario del paziente. */
export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700">{label}</span>
      <NumberStepper label={label} value={value} onChange={onChange} />
    </div>
  );
}

/**
 * Wizard medico su una sola schermata: dettaglio, sesso del probando (le
 * opzioni rare come l'identità di genere stanno in "Altre opzioni" e sono
 * uguali al sesso assegnato) e composizione della famiglia, con numeri
 * digitabili. Ogni gruppo si può lasciare a zero e completare dopo.
 */
export function DoctorWizard({ onCreate, onCancel }: { onCreate: (p: Pedigree) => void; onCancel?: () => void }) {
  const [level, setLevel] = useState<DetailLevel>("grandparents");
  const [sex, setSex] = useState<Sex>("male");
  const [gender, setGender] = useState<Gender>("not-expressed");
  const [more, setMore] = useState(false);
  const [counts, setCounts] = useState<Record<GroupKey, Counts>>({
    siblings: { ...EMPTY_COUNTS },
    paternal: { ...EMPTY_COUNTS },
    maternal: { ...EMPTY_COUNTS },
    children: { ...EMPTY_COUNTS },
  });
  const setCount = (g: GroupKey, k: keyof Counts, v: number) => setCounts((c) => ({ ...c, [g]: { ...c[g], [k]: v } }));
  const total = Object.values(counts).reduce((a, c) => a + c.male + c.female + c.unknown, 0);

  const create = () =>
    onCreate(
      buildFromDoctorWizard(
        { level, proband: { sex, gender }, siblings: counts.siblings, paternal: counts.paternal, maternal: counts.maternal, children: counts.children },
        uuid
      )
    );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">Nuovo genogramma</h1>
      <p className="mt-1 text-sm text-neutral-600">Imposta lo scheletro della famiglia: dati, condizioni ed esiti si aggiungono poi dal disegno.</p>

      <div className="mt-6 space-y-6 rounded-lg border border-neutral-200 bg-white p-5">
        <section className="grid gap-5 sm:grid-cols-2" aria-label="Probando">
          <FieldRow label="Fin dove risalire" htmlFor="wiz-level">
            <div id="wiz-level">
              <Segmented label="Fin dove risalire" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.label, title: l.hint }))} />
            </div>
          </FieldRow>
          <FieldRow label="Sesso del probando" htmlFor="wiz-sex">
            <div id="wiz-sex">
              <Segmented
                label="Sesso del probando"
                value={sex === "unassigned" ? "unknown" : sex}
                onChange={(v) => setSex(v as Sex)}
                options={[
                  { value: "male", label: "Maschio" },
                  { value: "female", label: "Femmina" },
                  { value: "unknown", label: "Non noto" },
                ]}
              />
            </div>
          </FieldRow>
        </section>

        <div>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} aria-hidden="true" />
            Altre opzioni del probando
          </button>
          {more ? (
            <div className="mt-3 grid gap-4 rounded-md bg-neutral-50 p-3 sm:grid-cols-2">
              <FieldRow label="Identità di genere" htmlFor="wiz-gender" hint="Predefinita: come il sesso assegnato alla nascita.">
                <Select id="wiz-gender" value={gender} onChange={(v) => setGender(v as Gender)} options={GENDER_OPTIONS} />
              </FieldRow>
              <FieldRow label="Sesso assegnato alla nascita" htmlFor="wiz-sex-full">
                <Select
                  id="wiz-sex-full"
                  value={sex}
                  onChange={(v) => setSex(v as Sex)}
                  options={[
                    { value: "male", label: "Maschile" },
                    { value: "female", label: "Femminile" },
                    { value: "unassigned", label: "Non assegnato (UAAB)" },
                    { value: "unknown", label: "Non noto" },
                  ]}
                />
              </FieldRow>
            </div>
          ) : null}
        </div>

        <section aria-label="Composizione della famiglia" className="border-t border-neutral-200 pt-5">
          <h2 className="text-sm font-semibold text-neutral-900">Composizione della famiglia</h2>
          <p className="mt-0.5 text-xs text-neutral-500">Scrivi il numero o usa − e +. Lascia a zero ciò che non sai ancora.</p>
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <fieldset key={g.key} className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-neutral-800">{g.title}</legend>
                <Stepper label={g.labels[0]} value={counts[g.key].male} onChange={(v) => setCount(g.key, "male", v)} />
                <Stepper label={g.labels[1]} value={counts[g.key].female} onChange={(v) => setCount(g.key, "female", v)} />
                <Stepper label={g.labels[2]} value={counts[g.key].unknown} onChange={(v) => setCount(g.key, "unknown", v)} />
              </fieldset>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Annulla
          </Button>
        ) : (
          <span className="text-xs text-neutral-500">{total ? `${total} familiari oltre a genitori e nonni` : ""}</span>
        )}
        <Button size="lg" onClick={create}>
          Crea il genogramma
        </Button>
      </div>
    </div>
  );
}
