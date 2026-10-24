"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  addLegendCondition,
  addLegendEvaluation,
  removeLegendCondition,
  removeLegendEvaluation,
  updateLegendCondition,
} from "@/lib/genogramma/model/commands";
import { uuid } from "@/lib/genogramma/model/create";
import type { CodeSystem, LegendCondition, PatternId } from "@/lib/genogramma/model/types";
import { fillRegion } from "@/lib/genogramma/render/fills";
import { shapePolygon } from "@/lib/genogramma/render/geometry";
import { formatCode } from "@/lib/genogramma/render/legend";
import { el } from "@/lib/genogramma/render/svg-tree";
import { cn } from "@/lib/utils";
import { ConditionPicker } from "./condition-picker";
import { FieldRow, Select, TextInput } from "./fields";
import { PATTERN_OPTIONS } from "./options";
import { SvgTree } from "./svg-tree";
import type { GenogramStore } from "./use-genogram-store";

const SYSTEMS: { value: CodeSystem; label: string }[] = [
  { value: "HPO", label: "HPO" },
  { value: "ORPHA", label: "ORPHA" },
  { value: "OMIM", label: "OMIM" },
  { value: "ICD10", label: "ICD-10" },
  { value: "ICD11", label: "ICD-11" },
];

/** Campione del riempimento di una condizione (stesso codice del disegno). */
export function Swatch({ c, color, size = 24 }: { c: LegendCondition; color: boolean; size?: number }) {
  const defs = new Map();
  const fill = fillRegion(shapePolygon("square", 12, 12, 20), { pattern: c.pattern, color: color ? c.color : "#111111" }, { office: false, idPrefix: `sw-${c.id}-`, scale: 0.6, defs });
  const node = el("svg", { width: size, height: size, viewBox: "0 0 24 24" }, [
    defs.size ? el("defs", {}, [...defs.values()]) : null,
    el("rect", { x: 2, y: 2, width: 20, height: 20, fill: "#ffffff" }),
    ...fill,
    el("rect", { x: 2, y: 2, width: 20, height: 20, fill: "none", stroke: "#111111", "stroke-width": 1.5 }),
  ]);
  return <SvgTree node={node} className="shrink-0" />;
}

/**
 * Condizioni e tipi di valutazione: nome, codici, riempimento (e colore se
 * la modalità colori è attiva), eliminazione con conferma.
 */
export function LegendEditor({ store, simple = false }: { store: GenogramStore; simple?: boolean }) {
  const ped = store.pedigree!;
  const run = store.run;
  const [open, setOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LegendCondition | null>(null);
  const usage = (cid: string) => Object.values(ped.individuals).filter((i) => i.conditions.some((c) => c.conditionId === cid)).length;

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Condizioni</h3>
          <p className="text-xs text-neutral-500">Ogni condizione ha un riempimento proprio in legenda. Lo stato di ciascun familiare si imposta dalla sua scheda.</p>
        </div>
        <ConditionPicker onAdd={(label, codes) => run((p) => addLegendCondition(p, label, uuid, codes).pedigree)} />
        {ped.legend.conditions.length === 0 ? <p className="text-sm text-neutral-500">Ancora nessuna condizione.</p> : null}
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {ped.legend.conditions.map((c) => {
            const expanded = open === c.id;
            const n = usage(c.id);
            return (
              <li key={c.id}>
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <Swatch c={c} color={ped.display.color} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(expanded ? null : c.id)} aria-expanded={expanded}>
                    <span className="block truncate text-sm font-medium text-neutral-900">{c.label}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {n} {n === 1 ? "familiare" : "familiari"}
                      {c.codes.length ? ` · ${c.codes.map(formatCode).join(", ")}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : c.id)}
                    aria-label={expanded ? "Chiudi" : `Modifica ${c.label}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
                  </button>
                </div>
                {expanded ? (
                  <div className="space-y-3 border-t border-neutral-100 bg-neutral-50 px-2.5 py-3">
                    <FieldRow label="Nome" htmlFor={`lc-${c.id}`}>
                      <TextInput id={`lc-${c.id}`} value={c.label} onCommit={(v) => v && run((p) => updateLegendCondition(p, c.id, { label: v }))} maxLength={120} />
                    </FieldRow>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldRow label="Riempimento (bianco e nero)" htmlFor={`lp-${c.id}`}>
                        <Select id={`lp-${c.id}`} value={c.pattern} onChange={(v) => run((p) => updateLegendCondition(p, c.id, { pattern: v as PatternId }))} options={PATTERN_OPTIONS} />
                      </FieldRow>
                      <FieldRow label={ped.display.color ? "Colore" : "Colore (solo in modalità colori)"} htmlFor={`lk-${c.id}`}>
                        <input
                          id={`lk-${c.id}`}
                          type="color"
                          value={c.color}
                          onChange={(e) => run((p) => updateLegendCondition(p, c.id, { color: e.target.value }), { coalesce: `color-${c.id}` })}
                          className="h-9 w-full rounded-md border border-neutral-300 bg-white"
                        />
                      </FieldRow>
                    </div>
                    {!simple ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-neutral-700">Codici (HPO, ORPHA, OMIM, ICD)</p>
                        {c.codes.map((code, i) => (
                          <div key={i} className="grid grid-cols-[6rem_1fr_auto] gap-2">
                            <Select
                              id={`lcs-${c.id}-${i}`}
                              label="Sistema"
                              value={code.system}
                              onChange={(v) => run((p) => updateLegendCondition(p, c.id, { codes: c.codes.map((x, k) => (k === i ? { ...x, system: v as CodeSystem } : x)) }))}
                              options={SYSTEMS}
                            />
                            <TextInput
                              id={`lcc-${c.id}-${i}`}
                              value={code.code}
                              onCommit={(v) =>
                                run((p) => updateLegendCondition(p, c.id, { codes: v ? c.codes.map((x, k) => (k === i ? { ...x, code: v } : x)) : c.codes.filter((_, k) => k !== i) }))
                              }
                              maxLength={40}
                            />
                            <button
                              type="button"
                              aria-label="Rimuovi il codice"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200"
                              onClick={() => run((p) => updateLegendCondition(p, c.id, { codes: c.codes.filter((_, k) => k !== i) }))}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-xs text-brand-700 hover:underline"
                          onClick={() => run((p) => updateLegendCondition(p, c.id, { codes: [...c.codes, { system: "HPO", code: "HP:" }] }))}
                        >
                          + Aggiungi codice
                        </button>
                      </div>
                    ) : null}
                    <div className="flex justify-end border-t border-neutral-200 pt-2">
                      <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setDeleting(c)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Elimina condizione
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {!simple ? (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Tipi di test e valutazioni</h3>
            <p className="text-xs text-neutral-500">Con più tipi si numerano E1, E2… nell&apos;ordine della lista e compaiono in legenda.</p>
          </div>
          {ped.legend.evaluations.map((e, i) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="w-8 text-sm font-semibold text-neutral-700">E{i + 1}</span>
              <div className="flex-1">
                <TextInput
                  id={`le-${e.id}`}
                  value={e.label}
                  onCommit={(v) => run((p) => ({ ...p, legend: { ...p.legend, evaluations: p.legend.evaluations.map((x) => (x.id === e.id ? { ...x, label: v ?? "" } : x)) } }))}
                  placeholder="es. Ecocardiogramma, pannello NGS"
                  maxLength={80}
                />
              </div>
              <button
                type="button"
                aria-label={`Elimina il tipo E${i + 1}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700"
                onClick={() => run((p) => removeLegendEvaluation(p, e.id))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => run((p) => addLegendEvaluation(p, "", uuid).pedigree)}>
            Aggiungi un tipo di test
          </Button>
        </section>
      ) : null}

      {deleting ? (
        <Dialog
          open
          onClose={() => setDeleting(null)}
          title="Eliminare la condizione?"
          description={deleting.label}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Annulla
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  run((p) => removeLegendCondition(p, deleting.id));
                  setDeleting(null);
                  setOpen(null);
                }}
              >
                Elimina
              </Button>
            </>
          }
        >
          <p className="text-sm text-neutral-700">
            {usage(deleting.id)
              ? `La condizione verrà tolta dalla legenda e da ${usage(deleting.id)} ${usage(deleting.id) === 1 ? "familiare" : "familiari"}.`
              : "La condizione verrà tolta dalla legenda."}{" "}
            Si può annullare con Ctrl+Z.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
