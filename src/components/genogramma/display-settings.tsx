"use client";

import type { ReactNode } from "react";
import { updateDisplay } from "@/lib/genogramma/model/commands";
import { DEFAULT_DISPLAY } from "@/lib/genogramma/model/create";
import type { DisplaySettings, FontFamily } from "@/lib/genogramma/model/types";
import { Button } from "@/components/ui/button";
import { FieldRow, Section, Segmented, Select, Toggle } from "./fields";
import type { GenogramStore } from "./use-genogram-store";

const SLIDERS: { key: keyof DisplaySettings; label: string; min: number; max: number; step?: number }[] = [
  { key: "symbolSize", label: "Simboli", min: 24, max: 80 },
  { key: "hSpacing", label: "Distanza orizzontale", min: 10, max: 120 },
  { key: "vSpacing", label: "Distanza tra generazioni", min: 40, max: 160 },
  { key: "fontSize", label: "Testo", min: 8, max: 18 },
  { key: "textGap", label: "Distanza testo-simbolo", min: 0, max: 24 },
  { key: "labelMaxWidth", label: "Larghezza delle etichette", min: 60, max: 300, step: 10 },
];

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-neutral-200 pb-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Aspetto del disegno, salvato con il genogramma. In alto le scelte
 * frequenti (colori, cosa mostrare, disposizione), in fondo dimensioni e
 * opzioni avanzate.
 */
export function DisplaySettingsPanel({ store }: { store: GenogramStore }) {
  const d = store.pedigree!.display;
  const set = (patch: Partial<DisplaySettings>, coalesce?: string) => store.run((p) => updateDisplay(p, patch), { coalesce });
  const toggle = (key: keyof DisplaySettings, label: string) => (
    <Toggle key={key} id={`dt-${key}`} label={label} checked={!!d[key]} onChange={(v) => set({ [key]: v })} />
  );
  return (
    <div className="space-y-4 p-4">
      <Block title="Colori" hint="Il bianco e nero è lo standard per stampa e cartella clinica: ogni condizione ha un tratteggio diverso.">
        <Segmented
          label="Colori"
          value={d.color ? "color" : "bw"}
          onChange={(v) => set({ color: v === "color" })}
          options={[
            { value: "bw", label: "Bianco e nero" },
            { value: "color", label: "Colori" },
          ]}
        />
      </Block>

      <Block title="Sotto i simboli">
        {toggle("showNumbers", "Numeri di pedigree (II-3) e generazioni")}
        {toggle("showConditions", "Condizioni ed età di esordio")}
        {toggle("showEvaluations", "Test e valutazioni (E+, E−, Eu)")}
        {toggle("showLabel", "Iniziali o etichette")}
        {toggle("showNotes", "Note")}
      </Block>

      <Block title="Nel disegno">
        {toggle("showLegend", "Legenda")}
        {toggle("showMetadata", "Dati del genogramma (data, informatore, motivo)")}
      </Block>

      <Block title="Disposizione" hint="Di default si seguono le linee guida NSGC 2022.">
        <Toggle
          id="dt-straight"
          label={
            <>
              Linee dritte <span className="text-neutral-500">— coppie un po&apos; più distanti invece di linee a gradino</span>
            </>
          }
          checked={d.straightLines}
          onChange={(v) => set({ straightLines: v })}
        />
        <Toggle
          id="dt-prior"
          label={
            <>
              Nascondi i partner precedenti senza figli <span className="text-neutral-500">— solo nel disegno, i dati restano</span>
            </>
          }
          checked={d.hidePriorPartners}
          onChange={(v) => set({ hidePriorPartners: v })}
        />
        <Toggle
          id="dt-male"
          label={
            <>
              Uomo sempre a sinistra nella coppia{" "}
              <span className="text-neutral-500">— convenzione del 2008, tolta dalla NSGC nel 2022</span>
            </>
          }
          checked={d.maleLeft}
          onChange={(v) => set({ maleLeft: v })}
        />
      </Block>

      <Block title="Lingua di legenda e testi" hint="Le sigle NSGC (SAB, TOP, ECT, SB, AMAB…) restano in inglese, standard internazionale.">
        <Segmented
          label="Lingua"
          value={d.language}
          onChange={(v) => set({ language: v as "it" })}
          options={[
            { value: "it", label: "Italiano" },
            { value: "en", label: "English" },
          ]}
        />
      </Block>

      <Section title="Dimensioni e spaziature" defaultOpen={false}>
        {SLIDERS.map((s) => (
          <FieldRow key={s.key} label={`${s.label}: ${d[s.key]}`} htmlFor={`ds-${s.key}`}>
            <input
              id={`ds-${s.key}`}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step ?? 1}
              value={d[s.key] as number}
              onChange={(e) => set({ [s.key]: Number(e.target.value) }, `display-${s.key}`)}
              className="w-full accent-brand-600"
            />
          </FieldRow>
        ))}
      </Section>

      <Section title="Avanzate" defaultOpen={false}>
        <FieldRow label="Font (solo font sicuri per l'export)" htmlFor="ds-font">
          <Select
            id="ds-font"
            value={d.fontFamily}
            onChange={(v) => set({ fontFamily: v as FontFamily })}
            options={[
              { value: "Arial", label: "Arial" },
              { value: "Helvetica", label: "Helvetica" },
              { value: "Times New Roman", label: "Times New Roman" },
              { value: "Courier New", label: "Courier New" },
            ]}
          />
        </FieldRow>
        {toggle("legacyCarrierDot", "Portatori con il punto centrale (stile 2008)")}
      </Section>

      <Button size="sm" variant="ghost" onClick={() => set({ ...DEFAULT_DISPLAY })}>
        Ripristina le impostazioni predefinite
      </Button>
    </div>
  );
}
