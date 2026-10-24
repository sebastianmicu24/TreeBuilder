import { migrate } from "../model/migrate";
import type { Pedigree } from "../model/types";
import { hasErrors, validate } from "../model/validate";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * JSON nativo con `schemaVersion`: export e import senza perdita. È il
 * formato per passare il genogramma tra paziente e medico (solo file).
 */
export const NATIVE_FORMAT = "sebastianmicu.com/genogramma";

export function exportNativeJson(ped: Pedigree): string {
  return JSON.stringify({ format: NATIVE_FORMAT, ...ped }, null, 2);
}

export function importNativeJson(text: string): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("Il file non è un JSON valido.");
  }
  const res = migrate(raw);
  if (!res.ok) return fail(res.error);
  const issues = validate(res.pedigree);
  if (hasErrors(issues)) {
    const first = issues.find((i) => i.level === "error")!;
    return fail(`Il file contiene errori di struttura: ${first.message}`);
  }
  return {
    ok: true,
    pedigree: res.pedigree,
    warnings: [...res.warnings, ...issues.filter((i) => i.level === "warning").map((i) => i.message)],
    format: "JSON",
  };
}
