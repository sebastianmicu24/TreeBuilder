"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchConditions, type VocabEntry } from "@/lib/genogramma/vocab/conditions";
import { formatCode } from "@/lib/genogramma/render/legend";
import type { ConditionCode } from "@/lib/genogramma/model/types";
import { smallField } from "./fields";

/**
 * Aggiunta di una condizione: testo libero o voce del vocabolario locale
 * (ricerca nel bundle, nessuna richiesta di rete). I codici si possono
 * correggere poi nella legenda.
 */
export function ConditionPicker({ onAdd, placeholder = "Nuova condizione (es. fibrosi cistica)" }: { onAdd: (label: string, codes: ConditionCode[]) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const results = searchConditions(q);
  const pick = (e: VocabEntry) => {
    onAdd(e.label, e.codes);
    setQ("");
    setOpen(false);
  };
  const addFree = () => {
    const label = q.trim();
    if (!label) return;
    onAdd(label, []);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0] && results[0].label.toLowerCase() === q.trim().toLowerCase()) pick(results[0]);
              else addFree();
            }
          }}
          placeholder={placeholder}
          maxLength={200}
          className={smallField}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
        />
        <Button size="sm" variant="secondary" onClick={addFree} disabled={!q.trim()} aria-label="Aggiungi condizione">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {open && results.length > 0 ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 text-sm">
          {results.map((e) => (
            <li key={e.label} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pick(e)}
                className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50"
              >
                <span className="text-neutral-900">{e.label}</span>
                <span className="block text-xs text-neutral-500">{e.codes.map(formatCode).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-xs text-neutral-500">Ricerca nel vocabolario locale: nulla viene inviato in rete.</p>
    </div>
  );
}
