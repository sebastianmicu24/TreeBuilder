"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HealthAnswer, PersonAnswer, YesNoUnknown } from "@/lib/genogramma/wizard/patient";
import { AgeInput, DateInput, FieldRow, TextInput, Toggle } from "../fields";
import { ConditionPicker } from "../condition-picker";
import { cn } from "@/lib/utils";

export function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-neutral-800">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
              value === o.value ? "border-brand-600 bg-brand-50 text-neutral-900" : "border-neutral-300 bg-white hover:border-neutral-400"
            )}
          >
            <span className="block font-medium">{o.label}</span>
            {o.hint ? <span className="block text-xs text-neutral-500">{o.hint}</span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const YNU: { value: YesNoUnknown; label: string }[] = [
  { value: "yes", label: "Sì" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Non lo so" },
];

/** Elenco dei problemi di salute con età di esordio, più "Non lo so". */
export function HealthEditor({ value, unknown, onChange, onUnknown, idPrefix }: {
  value: HealthAnswer[];
  unknown?: boolean;
  onChange: (v: HealthAnswer[]) => void;
  onUnknown: (v: boolean) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      {value.map((h, i) => (
        <div key={`${h.label}-${i}`} className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 p-2.5">
          <p className="w-full text-sm font-medium text-neutral-900">{h.label}</p>
          <FieldRow label="A che età è comparso (se lo sai)" htmlFor={`${idPrefix}-on-${i}`}>
            <AgeInput id={`${idPrefix}-on-${i}`} value={h.onset} onCommit={(v) => onChange(value.map((x, k) => (k === i ? { ...x, onset: v } : x)))} />
          </FieldRow>
          <Button size="sm" variant="ghost" aria-label={`Rimuovi ${h.label}`} onClick={() => onChange(value.filter((_, k) => k !== i))}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      {!unknown ? (
        <ConditionPicker
          placeholder="Scrivi un problema di salute (es. diabete, epilessia)"
          onAdd={(label) => onChange([...value, { label }])}
        />
      ) : null}
      <Toggle id={`${idPrefix}-hu`} label="Non lo so" checked={!!unknown} onChange={onUnknown} />
    </div>
  );
}

/** Scheda di un familiare: iniziali facoltative, età o anno, in vita, salute. */
export function PersonCard({
  value,
  onChange,
  idPrefix,
  askSex = false,
}: {
  value: PersonAnswer;
  onChange: (v: PersonAnswer) => void;
  idPrefix: string;
  askSex?: boolean;
}) {
  const set = (patch: Partial<PersonAnswer>) => onChange({ ...value, ...patch, skipped: false });
  return (
    <div className="space-y-5">
      {askSex ? (
        <Choice
          label="È"
          value={value.sex}
          onChange={(v) => set({ sex: v })}
          options={[
            { value: "male", label: "Maschio" },
            { value: "female", label: "Femmina" },
            { value: "unknown", label: "Non lo so" },
          ]}
        />
      ) : null}
      <FieldRow label="Iniziali (facoltativo)" htmlFor={`${idPrefix}-ini`} hint="Non serve il nome: bastano le iniziali, o nulla.">
        <TextInput id={`${idPrefix}-ini`} value={value.initials} onCommit={(v) => set({ initials: v })} maxLength={8} />
      </FieldRow>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Anno di nascita" htmlFor={`${idPrefix}-by`}>
          <DateInput id={`${idPrefix}-by`} value={value.birthYear} onCommit={(v) => set({ birthYear: v })} />
        </FieldRow>
        {value.birthYear === undefined || value.birthYear === "unknown" ? (
          <FieldRow label="Oppure l'età" htmlFor={`${idPrefix}-age`}>
            <AgeInput id={`${idPrefix}-age`} value={value.age} onCommit={(v) => set({ age: v })} />
          </FieldRow>
        ) : null}
      </div>
      <Choice label="È in vita?" value={value.alive} onChange={(v) => set({ alive: v })} options={YNU} />
      {value.alive === "no" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="A che età è morto/a" htmlFor={`${idPrefix}-da`}>
            <AgeInput id={`${idPrefix}-da`} value={value.deathAge} onCommit={(v) => set({ deathAge: v })} />
          </FieldRow>
          <FieldRow label="Causa (se la conosci)" htmlFor={`${idPrefix}-dc`}>
            <TextInput id={`${idPrefix}-dc`} value={value.deathCause} onCommit={(v) => set({ deathCause: v })} maxLength={120} />
          </FieldRow>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-800">Problemi di salute importanti</p>
        <HealthEditor
          idPrefix={idPrefix}
          value={value.health}
          unknown={value.healthUnknown}
          onChange={(health) => set({ health })}
          onUnknown={(v) => set({ healthUnknown: v || undefined })}
        />
      </div>
    </div>
  );
}
