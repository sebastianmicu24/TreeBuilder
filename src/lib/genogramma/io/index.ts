import { renderPedigree } from "../render/render";
import { toSvgDocument } from "../render/serialize";
import type { Pedigree } from "../model/types";
import { fail, type ImportResult } from "./common";
import { importCsv } from "./csv";
import { importGa4gh } from "./ga4gh";
import { importGedcom } from "./gedcom";
import { importNativeJson } from "./json";
import { importPed } from "./ped";
import { importPhenopacket } from "./phenopackets";

export * from "./common";
export { exportCsv, importCsv, CSV_LOSSES } from "./csv";
export { exportFhir, FHIR_LOSSES, FHIR_IG_VERSION } from "./fhir";
export { exportGa4gh, importGa4gh, GA4GH_LOSSES } from "./ga4gh";
export { importGedcom, GEDCOM_LOSSES } from "./gedcom";
export { exportNativeJson, importNativeJson } from "./json";
export { exportPed, importPed, PED_LOSSES } from "./ped";
export { exportPhenopacket, importPhenopacket, PHENOPACKET_LOSSES } from "./phenopackets";

/** SVG dallo stesso renderer della vista (senza attributi interattivi). */
export function exportSvg(ped: Pedigree, office = false): string {
  return toSvgDocument(renderPedigree(ped, { office, idPrefix: "x-" }).svg);
}

/**
 * Riconosce il formato dal nome e dal contenuto e lo importa. Nessun
 * contenuto viene eseguito: si leggono solo testo e JSON.
 */
export function importAny(name: string, text: string): ImportResult {
  const lower = name.toLowerCase();
  const head = text.trimStart().slice(0, 400);
  if (lower.endsWith(".ped") || lower.endsWith(".fam")) return importPed(text);
  if (lower.endsWith(".ged")) return importGedcom(text);
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return importCsv(text);
  if (head.startsWith("{")) {
    if (head.includes('"GA4GH-Pedigree"')) return importGa4gh(text);
    if (/"pedigree"\s*:\s*\{/.test(text.slice(0, 200000)) && /"proband"\s*:\s*\{/.test(text.slice(0, 200000))) return importPhenopacket(text);
    if (head.includes('"resourceType"')) return fail("L'import FHIR non è supportato: usa il JSON nativo o GA4GH.");
    return importNativeJson(text);
  }
  if (/^0\s+HEAD/.test(head)) return importGedcom(text);
  return fail("Formato non riconosciuto. Usa JSON, CSV, PED, Phenopackets, GA4GH o GEDCOM.");
}
