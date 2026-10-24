"use client";

import { updateIndividual } from "@/lib/genogramma/model/commands";
import { getRelationToProband, unknownFields } from "@/lib/genogramma/model/queries";
import type { Gender, Id, Sex, VitalStatus } from "@/lib/genogramma/model/types";
import { DateInput, Select, TextInput } from "./fields";
import { GENDER_OPTIONS, SEX_OPTIONS, VITAL_OPTIONS } from "./options";
import type { GenogramStore } from "./use-genogram-store";

/**
 * Editor tabellare di tutti i familiari, sincronizzato col disegno: ogni
 * cella è un comando sullo stesso stato. Ordinato per numero di pedigree.
 */
export function TableEditor({ store, numbering, onSelect }: { store: GenogramStore; numbering: Record<Id, string>; onSelect: (id: Id) => void }) {
  const ped = store.pedigree!;
  const ids = Object.keys(ped.individuals).sort((a, b) =>
    (numbering[a] ?? "~").localeCompare(numbering[b] ?? "~", "it", { numeric: true })
  );
  const upd = (id: Id, patch: Parameters<typeof updateIndividual>[2]) => store.run((p) => updateIndividual(p, id, patch));
  const th = "border-b border-neutral-200 px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500";
  const td = "border-b border-neutral-100 px-2 py-1.5 align-top";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="sticky top-0 bg-white">
          <tr>
            <th className={th}>N.</th>
            <th className={th}>Relazione</th>
            <th className={th}>Etichetta</th>
            <th className={th}>Sesso</th>
            <th className={th}>Genere</th>
            <th className={th}>Nascita</th>
            <th className={th}>Stato</th>
            <th className={th}>Condizioni</th>
            <th className={th}>Note</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const ind = ped.individuals[id];
            const missing = unknownFields(ind);
            return (
              <tr key={id} className={missing.length ? "bg-amber-50/60" : undefined}>
                <td className={td}>
                  <button type="button" className="text-brand-700 underline-offset-4 hover:underline" onClick={() => onSelect(id)}>
                    {numbering[id] ?? "—"}
                  </button>
                </td>
                <td className={`${td} text-neutral-600`}>{getRelationToProband(ped, id)}</td>
                <td className={td}>
                  <TextInput id={`t-l-${id}`} value={ind.label} onCommit={(v) => upd(id, { label: v })} maxLength={40} />
                </td>
                <td className={td}>
                  <Select id={`t-s-${id}`} label="Sesso" value={ind.sex} onChange={(v) => upd(id, { sex: v as Sex })} options={SEX_OPTIONS} />
                </td>
                <td className={td}>
                  <Select id={`t-g-${id}`} label="Genere" value={ind.gender} onChange={(v) => upd(id, { gender: v as Gender })} options={GENDER_OPTIONS} />
                </td>
                <td className={td}>
                  <DateInput id={`t-b-${id}`} value={ind.birth} onCommit={(v) => upd(id, { birth: v })} />
                </td>
                <td className={td}>
                  <Select id={`t-v-${id}`} label="Stato in vita" value={ind.vital} onChange={(v) => upd(id, { vital: v as VitalStatus })} options={VITAL_OPTIONS} />
                </td>
                <td className={`${td} text-xs text-neutral-700`}>
                  {ind.conditions
                    .map((c) => {
                      const l = ped.legend.conditions.find((x) => x.id === c.conditionId)?.label ?? "?";
                      return c.status === "affected" ? l : `${l} (${c.status === "carrier" ? "portatore" : "presintomatico"})`;
                    })
                    .join(", ") || "—"}
                </td>
                <td className={td}>
                  <TextInput id={`t-n-${id}`} value={ind.notes} onCommit={(v) => upd(id, { notes: v })} maxLength={1000} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
