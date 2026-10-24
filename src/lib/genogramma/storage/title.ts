import type { Pedigree } from "../model/types";

/** Titolo di una bozza senza dati identificanti (niente nomi). */
export function draftTitle(ped: Pedigree): string {
  const n = Object.keys(ped.individuals).length;
  return `${ped.meta.title?.trim() || `Genogramma del ${ped.date}`} · ${n} ${n === 1 ? "familiare" : "familiari"}`;
}
