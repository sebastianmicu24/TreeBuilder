import { layout } from "../layout";
import { formatAge, isPartialDate } from "../model/age";
import { addLegendCondition, setIndividualCondition } from "../model/commands";
import { uuid } from "../model/create";
import { evaluationNotation } from "../model/notation";
import { homeEntry, unionsOf } from "../model/queries";
import type { Age, ChildLinkType, ConditionStatus, DateValue, Gender, Id, Pedigree, PregnancyOutcome, Sex, VitalStatus } from "../model/types";
import { assemble, type RawParentage, type RawPartnership, type RawPerson } from "./assemble";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * CSV tabellare (separatore `;` o `,`), una riga per individuo. Le
 * relazioni stanno nelle colonne `genitori` e `partner` (numeri di
 * pedigree). Le celle che iniziano con = + - @ (formule nei fogli di
 * calcolo) ricevono un apostrofo davanti; all'import viene tolto.
 *
 * Perdite: dettagli ART, valutazioni (esportate solo come testo), età di
 * esordio, codici e riempimenti della legenda, metadati, impostazioni.
 */
export const CSV_LOSSES =
  "Il CSV conserva individui, genitori, partner, gemelli, gravidanze e condizioni. Si perdono dettagli ART, valutazioni strutturate, età di esordio, codici e metadati.";

export const CSV_COLUMNS = [
  "id",
  "etichetta",
  "sesso",
  "genere",
  "nascita",
  "eta",
  "stato",
  "eta_decesso",
  "anno_decesso",
  "causa_decesso",
  "genitori",
  "legame",
  "adottato_fuori",
  "partner",
  "relazioni_terminate",
  "consanguinei",
  "gemello",
  "zigosita",
  "esito_gravidanza",
  "settimane",
  "condizioni",
  "valutazioni",
  "note",
  "probando",
] as const;

const SEX_OUT: Record<Sex, string> = { male: "M", female: "F", unassigned: "UAAB", unknown: "?" };
const GENDER_OUT: Record<Gender, string> = { man: "uomo", woman: "donna", "non-binary": "non binario", unknown: "?", "not-expressed": "" };
const VITAL_OUT: Record<VitalStatus, string> = { alive: "vivo", deceased: "deceduto", unknown: "?" };
const LINK_OUT: Record<ChildLinkType, string> = { biological: "biologico", adoptive: "adottivo", foster: "affido", art: "art" };
const STATUS_OUT: Record<ConditionStatus, string> = { affected: "affetto", carrier: "portatore", presymptomatic: "presintomatico" };

/** Protezione dalle formule (CSV injection) e quoting RFC 4180. */
export function csvCell(value: string, sep: string): string {
  let v = value.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (v.includes(sep) || v.includes('"') || v.includes("\n")) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

function dateText(v: DateValue | undefined): string {
  if (v === undefined) return "";
  if (v === "unknown") return "?";
  if (typeof v === "object") return `${v.decade}s`;
  return v;
}

function ageText(a: Age | undefined): string {
  if (a === undefined) return "";
  return formatAge(a);
}

export function exportCsv(ped: Pedigree, sep: ";" | "," = ";"): string {
  const lay = layout(ped);
  const num = (id: Id) => lay.numbering[id] ?? id;
  const ids = Object.keys(ped.individuals).sort((a, b) => num(a).localeCompare(num(b), "en", { numeric: true }));
  const twinLabel = new Map<string, string>();
  const rows = [CSV_COLUMNS.join(sep)];
  for (const id of ids) {
    const ind = ped.individuals[id];
    const home = homeEntry(ped, id);
    const unions = unionsOf(ped, id).filter((u) => u.partners.length === 2);
    const partnerOf = (u: (typeof unions)[number]) => u.partners.find((p) => p !== id)!;
    if (ind.twin && !twinLabel.has(ind.twin.groupId)) twinLabel.set(ind.twin.groupId, `G${twinLabel.size + 1}`);
    const cells = [
      num(id),
      ind.label ?? "",
      SEX_OUT[ind.sex],
      GENDER_OUT[ind.gender],
      dateText(ind.birth),
      ageText(ind.age),
      VITAL_OUT[ind.vital],
      ageText(ind.death?.age),
      dateText(ind.death?.date),
      ind.death?.cause ?? "",
      home ? home.union.partners.map(num).join("|") : "",
      home ? LINK_OUT[home.link.link] : "",
      home?.link.adoptedOut ? "si" : "",
      unions.map((u) => num(partnerOf(u))).join("|"),
      unions.filter((u) => u.status === "ended").map((u) => num(partnerOf(u))).join("|"),
      unions.filter((u) => u.consanguinity).map((u) => num(partnerOf(u))).join("|"),
      ind.twin ? twinLabel.get(ind.twin.groupId)! : "",
      ind.twin ? (ind.twin.zygosity === "unknown" ? "?" : ind.twin.zygosity) : "",
      ind.pregnancy?.outcome ?? "",
      ind.pregnancy?.gestationalWeeks !== undefined ? String(ind.pregnancy.gestationalWeeks) : "",
      ind.conditions
        .map((c) => `${ped.legend.conditions.find((l) => l.id === c.conditionId)?.label ?? "?"}=${STATUS_OUT[c.status]}`)
        .join("|"),
      ind.evaluations.map((e) => evaluationNotation(ped, e)).join("|"),
      ind.notes ?? "",
      ped.proband === id ? "si" : "",
    ];
    rows.push(cells.map((c) => csvCell(c, sep)).join(sep));
  }
  return "﻿" + rows.join("\r\n") + "\r\n";
}

/** Parser CSV RFC 4180 (virgolette, separatore nelle celle, a capo nelle virgolette). */
export function parseCsv(text: string, sep: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

function unprotect(v: string): string {
  return /^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v;
}

function parseAge(v: string): Age | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (t === "?") return "unknown";
  const dec = /^(\d{1,3})'s$/.exec(t);
  if (dec) return { decade: Number(dec[1]) };
  const m = /^(~)?(\d+(?:[.,]\d+)?)\s*(y|mo|wk|d)$/.exec(t);
  if (!m) return undefined;
  return { value: Number(m[2].replace(",", ".")), unit: m[3] as "y", ...(m[1] ? { approx: true } : {}) };
}

function parseDate(v: string): DateValue | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (t === "?") return "unknown";
  const dec = /^(\d{3}0)s$/.exec(t);
  if (dec) return { decade: Number(dec[1]) };
  return isPartialDate(t) ? t : undefined;
}

const SEX_IN: Record<string, Sex> = { m: "male", f: "female", uaab: "unassigned", "?": "unknown", "": "unknown", "1": "male", "2": "female" };
const GENDER_IN: Record<string, Gender> = { uomo: "man", donna: "woman", "non binario": "non-binary", "?": "unknown", "": "not-expressed" };
const VITAL_IN: Record<string, VitalStatus> = { vivo: "alive", deceduto: "deceased", "?": "unknown", "": "alive" };
const LINK_IN: Record<string, ChildLinkType> = { biologico: "biological", adottivo: "adoptive", affido: "foster", art: "art", "": "biological" };
const STATUS_IN: Record<string, ConditionStatus> = { affetto: "affected", portatore: "carrier", presintomatico: "presymptomatic" };

export function importCsv(text: string): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = parseCsv(clean, sep);
  if (rows.length < 2) return fail("Il CSV non contiene righe di dati.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("id") < 0) return fail("Manca la colonna 'id' nell'intestazione del CSV.");
  if (rows.length > 2001) return fail("Il file contiene troppi individui (massimo 2000).");
  const get = (r: string[], name: string) => unprotect((r[col(name)] ?? "").trim());

  const persons: RawPerson[] = [];
  const parentage: RawParentage[] = [];
  const partnerships: RawPartnership[] = [];
  const twins = new Map<string, { members: string[]; zygosity: "MZ" | "DZ" | "unknown" }>();
  const conds: { key: string; label: string; status: ConditionStatus }[] = [];
  let proband: string | undefined;
  const seenPairs = new Set<string>();
  for (const r of rows.slice(1)) {
    const key = get(r, "id");
    if (!key) continue;
    const vital = VITAL_IN[get(r, "stato").toLowerCase()] ?? "alive";
    const outcome = get(r, "esito_gravidanza") as PregnancyOutcome | "";
    const weeks = Number(get(r, "settimane"));
    const deathAge = parseAge(get(r, "eta_decesso"));
    const deathDate = parseDate(get(r, "anno_decesso"));
    const cause = get(r, "causa_decesso");
    persons.push({
      key,
      fields: {
        label: get(r, "etichetta") || undefined,
        sex: SEX_IN[get(r, "sesso").toLowerCase()] ?? "unknown",
        gender: GENDER_IN[get(r, "genere").toLowerCase()] ?? "not-expressed",
        birth: parseDate(get(r, "nascita")),
        age: parseAge(get(r, "eta")),
        vital,
        death: vital === "deceased" && (deathAge || deathDate || cause) ? { age: deathAge, date: deathDate, cause: cause || undefined } : undefined,
        pregnancy: ["ongoing", "SAB", "TOP", "ECT", "SB"].includes(outcome)
          ? { outcome: outcome as PregnancyOutcome, gestationalWeeks: Number.isFinite(weeks) && weeks > 0 ? weeks : undefined }
          : undefined,
        notes: get(r, "note") || undefined,
      },
    });
    const parents = get(r, "genitori").split("|").map((s) => s.trim()).filter(Boolean);
    if (parents.length) {
      parentage.push({ child: key, parents, link: LINK_IN[get(r, "legame").toLowerCase()] ?? "biological", adoptedOut: get(r, "adottato_fuori") === "si" });
    }
    const ended = new Set(get(r, "relazioni_terminate").split("|").filter(Boolean));
    const cons = new Set(get(r, "consanguinei").split("|").filter(Boolean));
    for (const p of get(r, "partner").split("|").map((s) => s.trim()).filter(Boolean)) {
      // Ogni coppia compare in due righe: la si registra una volta sola.
      const pair = [key, p].sort().join("\u0000");
      if (seenPairs.has(pair)) continue;
      seenPairs.add(pair);
      partnerships.push({ a: key, b: p, ended: ended.has(p), consanguineous: cons.has(p) });
    }
    const tw = get(r, "gemello");
    if (tw) {
      const z = get(r, "zigosita").toUpperCase();
      const g = twins.get(tw) ?? { members: [], zygosity: z === "MZ" ? "MZ" : z === "DZ" ? "DZ" : "unknown" };
      g.members.push(key);
      twins.set(tw, g);
    }
    for (const part of get(r, "condizioni").split("|").filter(Boolean)) {
      const i = part.lastIndexOf("=");
      const label = (i >= 0 ? part.slice(0, i) : part).trim();
      const status = STATUS_IN[(i >= 0 ? part.slice(i + 1) : "affetto").trim().toLowerCase()] ?? "affected";
      if (label) conds.push({ key, label: label.slice(0, 120), status });
    }
    if (get(r, "probando") === "si") proband = key;
  }
  const { pedigree, warnings, idOf } = assemble({ persons, parentage, partnerships, twins: [...twins.values()], proband });
  let ped = pedigree;
  const legend = new Map<string, Id>();
  for (const c of conds) {
    const id = idOf.get(c.key);
    if (!id) continue;
    let cid = legend.get(c.label.toLowerCase());
    if (!cid) {
      const res = addLegendCondition(ped, c.label, uuid);
      ped = res.pedigree;
      cid = res.id;
      legend.set(c.label.toLowerCase(), cid);
    }
    ped = setIndividualCondition(ped, id, cid, { status: c.status });
  }
  if (!ped.proband) ped.proband = Object.keys(ped.individuals)[0];
  return { ok: true, pedigree: ped, warnings: [...warnings, CSV_LOSSES], format: "CSV" };
}
