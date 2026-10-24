import { assemble, type RawParentage, type RawPartnership, type RawPerson } from "./assemble";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * Import GEDCOM (5.5/7, sottoinsieme): INDI con SEX, BIRT/DEAT e DATE
 * (solo l'anno), FAM con HUSB, WIFE, CHIL e DIV. Per minimizzazione i nomi
 * diventano iniziali. Solo import: il GEDCOM non ha la semantica clinica.
 */
export const GEDCOM_LOSSES =
  "Dal GEDCOM si importano individui, sesso, anni di nascita e morte, coppie e figli. I nomi diventano iniziali; non ci sono condizioni.";

function initials(name: string): string {
  return name
    .replace(/\//g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join("")
    .slice(0, 12);
}

function year(s: string): string | undefined {
  const m = /(\d{4})/.exec(s);
  return m ? m[1] : undefined;
}

export function importGedcom(text: string): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (!/^0\s+HEAD/.test(lines[0]?.trim() ?? "")) return fail("Il file non sembra un GEDCOM (manca l'intestazione 0 HEAD).");
  type Rec = { type: string; id: string; rows: { level: number; tag: string; value: string }[] };
  const recs: Rec[] = [];
  let cur: Rec | null = null;
  for (const raw of lines) {
    const m = /^\s*(\d+)\s+(@[^@]+@\s+)?(\S+)\s?(.*)$/.exec(raw);
    if (!m) continue;
    const level = Number(m[1]);
    const xref = m[2]?.trim();
    const tag = m[3].toUpperCase();
    const value = m[4] ?? "";
    if (level === 0) {
      cur = xref ? { type: tag, id: xref, rows: [] } : null;
      if (cur) recs.push(cur);
    } else if (cur) cur.rows.push({ level, tag, value: value.trim() });
  }
  const indis = recs.filter((r) => r.type === "INDI");
  if (indis.length === 0) return fail("Il GEDCOM non contiene individui.");
  if (indis.length > 2000) return fail("Il file contiene troppi individui (massimo 2000).");
  const persons: RawPerson[] = indis.map((r) => {
    let sex: "male" | "female" | "unknown" = "unknown";
    let birth: string | undefined;
    let death: string | undefined;
    let dead = false;
    let name = "";
    let ctx = "";
    for (const row of r.rows) {
      if (row.level === 1) ctx = row.tag;
      if (row.level === 1 && row.tag === "NAME") name = row.value;
      if (row.level === 1 && row.tag === "SEX") sex = row.value === "M" ? "male" : row.value === "F" ? "female" : "unknown";
      if (row.level === 1 && row.tag === "DEAT") dead = true;
      if (row.level === 2 && row.tag === "DATE" && ctx === "BIRT") birth = year(row.value);
      if (row.level === 2 && row.tag === "DATE" && ctx === "DEAT") death = year(row.value);
    }
    return {
      key: r.id,
      fields: {
        label: name ? initials(name) : undefined,
        sex,
        gender: "not-expressed",
        birth,
        vital: dead ? "deceased" : "alive",
        death: dead && death ? { date: death } : undefined,
      },
    };
  });
  const parentage: RawParentage[] = [];
  const partnerships: RawPartnership[] = [];
  for (const fam of recs.filter((r) => r.type === "FAM")) {
    const husb = fam.rows.find((x) => x.level === 1 && x.tag === "HUSB")?.value;
    const wife = fam.rows.find((x) => x.level === 1 && x.tag === "WIFE")?.value;
    const kids = fam.rows.filter((x) => x.level === 1 && x.tag === "CHIL").map((x) => x.value);
    const parents = [husb, wife].filter((x): x is string => !!x);
    if (parents.length === 2) partnerships.push({ a: parents[0], b: parents[1], ended: fam.rows.some((x) => x.tag === "DIV") });
    for (const k of kids) if (parents.length) parentage.push({ child: k, parents, link: "biological" });
  }
  const { pedigree, warnings } = assemble({ persons, parentage, partnerships });
  pedigree.proband = Object.keys(pedigree.individuals)[0];
  return { ok: true, pedigree, warnings: [...warnings, GEDCOM_LOSSES], format: "GEDCOM" };
}
