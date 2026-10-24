"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Age, AgeUnit, DateValue } from "@/lib/genogramma/model/types";
import { isPartialDate } from "@/lib/genogramma/model/age";
import { AGE_UNIT_OPTIONS } from "./options";

/**
 * Campi compatti dell'editor. I testi si applicano all'uscita dal campo
 * (un passo di undo per modifica, non per carattere). I campi non
 * controllati si rimontano (`key`) quando il valore cambia da fuori.
 */
export function FieldRow({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export const smallField = cn(fieldClass, "h-9 border-neutral-200");
/** Come smallField ma senza larghezza piena (campi affiancati). */
const inlineField = cn(fieldClass.replace("w-full", ""), "h-9 border-neutral-200");

export function TextInput({
  id,
  value,
  onCommit,
  placeholder,
  maxLength = 200,
  multiline = false,
}: {
  id: string;
  value: string | undefined;
  onCommit: (v: string | undefined) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const commit = (raw: string) => {
    const v = raw.trim();
    if (v !== (value ?? "")) onCommit(v || undefined);
  };
  if (multiline) {
    return (
      <textarea
        key={value ?? ""}
        id={id}
        defaultValue={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        onBlur={(e) => commit(e.target.value)}
        rows={3}
        className={cn(fieldClass, "h-auto border-neutral-200 py-2")}
      />
    );
  }
  return (
    <input
      key={value ?? ""}
      id={id}
      defaultValue={value ?? ""}
      maxLength={maxLength}
      placeholder={placeholder}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={smallField}
    />
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
  label?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(smallField, "pr-7")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Interruttore on/off (checkbox con ruolo switch), etichetta a sinistra. */
export function Toggle({ id, label, checked, onChange }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 text-sm text-neutral-700">
      <span className="min-w-0">{label}</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="relative mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-neutral-200 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:bg-neutral-900 checked:before:translate-x-4"
      />
    </label>
  );
}

function ageParts(value: Age | undefined): { num: string; unit: AgeUnit | "decade" } {
  if (!value || value === "unknown") return { num: "", unit: "y" };
  if ("decade" in value) return { num: String(value.decade), unit: "decade" };
  return { num: String(value.value), unit: value.unit };
}

/** Età: valore + unità (o decennio), oppure "Non lo so". */
export function AgeInput({
  id,
  value,
  onCommit,
  allowUnknown = true,
}: {
  id: string;
  value: Age | undefined;
  onCommit: (v: Age | undefined) => void;
  allowUnknown?: boolean;
}) {
  const parts = ageParts(value);
  const numRef = useRef<HTMLInputElement | null>(null);
  const unitRef = useRef<HTMLSelectElement | null>(null);
  const commit = () => {
    const n = numRef.current?.value ?? "";
    const u = (unitRef.current?.value ?? "y") as AgeUnit | "decade";
    if (n.trim() === "") return onCommit(undefined);
    const v = Number(n.replace(",", "."));
    if (!Number.isFinite(v) || v < 0 || v > 150) return;
    onCommit(u === "decade" ? { decade: Math.floor(v / 10) * 10 } : { value: v, unit: u });
  };
  const key = JSON.stringify(value ?? null);
  const unknown = value === "unknown";
  return (
    <div className="flex flex-wrap gap-2">
      <input
        key={`n${key}`}
        ref={numRef}
        id={id}
        inputMode="decimal"
        defaultValue={parts.num}
        disabled={unknown}
        placeholder={unknown ? "Non lo so" : "—"}
        onBlur={commit}
        className={cn(inlineField, "w-20")}
      />
      <select
        key={`u${key}`}
        ref={unitRef}
        defaultValue={parts.unit}
        disabled={unknown}
        onChange={commit}
        className={cn(inlineField, "w-32 pr-7")}
        aria-label="Unità dell'età"
      >
        {AGE_UNIT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="decade">decennio (es. 60)</option>
      </select>
      {allowUnknown ? (
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600">
          <input type="checkbox" checked={unknown} onChange={(e) => onCommit(e.target.checked ? "unknown" : undefined)} className="h-4 w-4 accent-neutral-900" />
          Non lo so
        </label>
      ) : null}
    </div>
  );
}

/** Data: anno (preferito), anno-mese, data completa, decennio ("1960s"), "Non lo so". */
export function DateInput({ id, value, onCommit }: { id: string; value: DateValue | undefined; onCommit: (v: DateValue | undefined) => void }) {
  const text = value === undefined || value === "unknown" ? "" : typeof value === "object" ? `${value.decade}s` : value;
  const [error, setError] = useState<string | null>(null);
  const commit = (raw: string) => {
    const t = raw.trim();
    if (t === text) return;
    if (t === "") {
      setError(null);
      return onCommit(undefined);
    }
    const dec = /^(\d{3})0s$/i.exec(t);
    if (dec) {
      setError(null);
      return onCommit({ decade: Number(`${dec[1]}0`) });
    }
    if (!isPartialDate(t)) return setError("Usa AAAA, AAAA-MM, AAAA-MM-GG o un decennio come 1960s.");
    setError(null);
    onCommit(t);
  };
  const unknown = value === "unknown";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <input
          key={text}
          id={id}
          defaultValue={text}
          disabled={unknown}
          placeholder={unknown ? "Non lo so" : "es. 1978"}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(inlineField, "w-28")}
          aria-invalid={error ? true : undefined}
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600">
          <input type="checkbox" checked={unknown} onChange={(e) => onCommit(e.target.checked ? "unknown" : undefined)} className="h-4 w-4 accent-neutral-900" />
          Non lo so
        </label>
      </div>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-neutral-100 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-800 hover:text-neutral-950">
        {title}
        <ChevronDown className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/**
 * Scelta a segmenti (radiogroup): per le opzioni brevi e frequenti, più
 * veloce di un menu a tendina. Frecce sinistra/destra per cambiare.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-full rounded-lg bg-neutral-100 p-0.5", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = (Math.max(0, index) + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value);
      }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (index < 0 && i === 0) ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-md px-2 font-medium transition-colors",
              size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
              active ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-950/5" : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Numero intero digitabile da tastiera, con − e + ai lati. */
export function NumberStepper({
  value,
  onChange,
  label,
  min = 0,
  max = 20,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max?: number;
  id?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  // Testo in corso di digitazione (es. campo vuotato prima di scrivere "12").
  const [draft, setDraft] = useState<string | null>(null);
  const btn =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-lg leading-none text-neutral-700 shadow-xs hover:bg-neutral-50 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`${label}: uno in meno`}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.currentTarget.value;
          setDraft(raw);
          const n = Number(raw);
          if (raw !== "" && Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={() => {
          if (draft === "") onChange(min);
          setDraft(null);
        }}
        className={cn(inlineField, "w-14 px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`${label}: uno in più`}>
        +
      </button>
    </div>
  );
}
