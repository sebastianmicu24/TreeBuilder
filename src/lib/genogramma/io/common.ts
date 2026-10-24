import { isFullDate, parsePartialDate } from "../model/age";
import type { Pedigree } from "../model/types";

/**
 * Elementi comuni di import/export: limiti, risultati, minimizzazione.
 * Nessuna funzione di questa cartella fa rete: si lavora su stringhe e Blob.
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportResult =
  | { ok: true; pedigree: Pedigree; warnings: string[]; format: string }
  | { ok: false; error: string };

export function fail(error: string): ImportResult {
  return { ok: false, error };
}

/** Dati che identificano direttamente: nomi e date complete. */
export function identifyingData(ped: Pedigree): { names: number; fullDates: number } {
  let names = 0;
  let fullDates = 0;
  for (const ind of Object.values(ped.individuals)) {
    if (ind.name?.trim()) names += 1;
    if (isFullDate(ind.birth)) fullDates += 1;
    if (isFullDate(ind.death?.date)) fullDates += 1;
  }
  return { names, fullDates };
}

function yearOnly(v: unknown): unknown {
  if (typeof v !== "string" || v === "unknown") return v;
  const p = parsePartialDate(v);
  return p ? String(p.y) : v;
}

/**
 * Copia senza nomi e con le date ridotte all'anno (raccomandazione NSGC per
 * la privacy). Le età già calcolate restano: si perde solo la precisione.
 */
export function stripIdentifying(ped: Pedigree): Pedigree {
  const individuals: Pedigree["individuals"] = {};
  for (const [id, ind] of Object.entries(ped.individuals)) {
    const copy = { ...ind };
    delete copy.name;
    if (copy.birth !== undefined) copy.birth = yearOnly(copy.birth) as typeof copy.birth;
    if (copy.death?.date !== undefined) copy.death = { ...copy.death, date: yearOnly(copy.death.date) as string };
    individuals[id] = copy;
  }
  return { ...ped, individuals };
}

/** Nome di file senza dati personali. */
export function exportFileName(ped: Pedigree, ext: string): string {
  const date = /^\d{4}(-\d{2}(-\d{2})?)?$/.test(ped.date) ? ped.date : "data";
  return `genogramma-${date}.${ext}`;
}

/** Testo di un file con controllo della dimensione. */
export function checkSize(text: string): string | null {
  if (text.length > MAX_IMPORT_BYTES) return "Il file è troppo grande (massimo 5 MB).";
  if (!text.trim()) return "Il file è vuoto.";
  return null;
}
