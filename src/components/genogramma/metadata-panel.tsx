"use client";

import type { ReactNode } from "react";
import { setPedigreeDate, setProband, updateMeta } from "@/lib/genogramma/model/commands";
import { isPartialDate } from "@/lib/genogramma/model/age";
import type { Id, PedigreeMeta } from "@/lib/genogramma/model/types";
import { FieldRow, Select, TextInput } from "./fields";
import { personName } from "./member-panel";
import type { GenogramStore } from "./use-genogram-store";

type Field = { key: keyof PedigreeMeta; label: string; placeholder?: string; multiline?: boolean };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Consulenza",
    fields: [
      { key: "reason", label: "Motivo della consulenza", placeholder: "es. ritardo dello sviluppo, tumori familiari", multiline: true },
      { key: "historian", label: "Informatore", placeholder: "es. madre del probando" },
    ],
  },
  {
    title: "Origini della famiglia",
    fields: [
      { key: "ancestryPaternal", label: "Ramo paterno", placeholder: "es. Sicilia" },
      { key: "ancestryMaternal", label: "Ramo materno", placeholder: "es. Romania" },
    ],
  },
  {
    title: "Compilazione",
    fields: [
      { key: "compiledBy", label: "Compilato da" },
      { key: "compilerRole", label: "Qualifica", placeholder: "es. genetista, pediatra" },
      { key: "updated", label: "Ultimo aggiornamento", placeholder: "AAAA-MM-GG" },
      { key: "title", label: "Titolo del disegno" },
    ],
  },
];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-neutral-200 pb-4">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  );
}

/** Dati del genogramma (metadati NSGC), raggruppati per uso. */
export function MetadataPanel({ store, numbering }: { store: GenogramStore; numbering: Record<Id, string> }) {
  const ped = store.pedigree!;
  const ids = Object.keys(ped.individuals).sort((a, b) => (numbering[a] ?? "").localeCompare(numbering[b] ?? "", "it", { numeric: true }));
  return (
    <div className="space-y-4 p-4">
      <Block title="Probando e data">
        <FieldRow label="Probando" htmlFor="meta-proband">
          <Select
            id="meta-proband"
            value={ped.proband ?? ""}
            onChange={(v) => store.run((p) => setProband(p, v || undefined))}
            options={[{ value: "", label: "Nessuno" }, ...ids.map((x) => ({ value: x, label: personName(ped, x, numbering) }))]}
          />
        </FieldRow>
        <FieldRow label="Data di raccolta" htmlFor="meta-date" hint="Le età si calcolano rispetto a questa data.">
          <TextInput id="meta-date" value={ped.date} onCommit={(v) => v && isPartialDate(v) && store.run((p) => setPedigreeDate(p, v))} placeholder="AAAA-MM-GG" maxLength={10} />
        </FieldRow>
      </Block>
      {GROUPS.map((g) => (
        <Block key={g.title} title={g.title}>
          {g.fields.map((f) => (
            <FieldRow key={f.key} label={f.label} htmlFor={`meta-${f.key}`}>
              <TextInput
                id={`meta-${f.key}`}
                value={ped.meta[f.key]}
                onCommit={(v) => store.run((p) => updateMeta(p, { [f.key]: v }))}
                placeholder={f.placeholder}
                multiline={f.multiline}
                maxLength={f.multiline ? 500 : 200}
              />
            </FieldRow>
          ))}
        </Block>
      ))}
    </div>
  );
}
