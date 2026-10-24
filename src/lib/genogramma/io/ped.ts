import { layout } from "../layout";
import { addLegendCondition } from "../model/commands";
import { biologicalParents, isFemaleLike, isMaleLike } from "../model/queries";
import { uuid } from "../model/create";
import type { Id, Pedigree } from "../model/types";
import { assemble, type RawParentage, type RawPerson } from "./assemble";
import { checkSize, fail, type ImportResult } from "./common";

/**
 * PED (PLINK/LINKAGE): 6 colonne `FID IID PID MID SEX PHENO`, senza
 * intestazione; 0 = genitore ignoto; sesso 1 maschio, 2 femmina, 0 ignoto;
 * fenotipo 0 ignoto, 1 non affetto, 2 affetto.
 *
 * Perdite documentate: una sola condizione (scelta dall'utente), nessuna
 * relazione non biologica, nessun esito di gravidanza (esclusi), nessuna
 * età, genere, nota o valutazione. Gli ID sono i numeri di pedigree.
 */
export const PED_LOSSES =
  "Il PED conserva solo genitori biologici, sesso e una condizione. Si perdono adozioni, ART, gravidanze, età, genere, note e valutazioni.";

export function exportPed(ped: Pedigree, conditionId?: Id, familyId = "FAM1"): string {
  const lay = layout(ped);
  const idOf = (id: Id) => (lay.numbering[id] ?? id).replace(/\s+/g, "_");
  const fid = familyId.replace(/\s+/g, "_") || "FAM1";
  const lines: string[] = [];
  const ids = Object.keys(ped.individuals)
    .filter((id) => !ped.individuals[id].pregnancy || ped.individuals[id].pregnancy?.outcome === "SB")
    .sort((a, b) => (lay.numbering[a] ?? "").localeCompare(lay.numbering[b] ?? "", "en", { numeric: true }));
  const included = new Set(ids);
  for (const id of ids) {
    const ind = ped.individuals[id];
    const parents = biologicalParents(ped, id).filter((p) => included.has(p));
    let pid = "0";
    let mid = "0";
    for (const p of parents) {
      const pi = ped.individuals[p];
      if (isMaleLike(pi) || pi.sex === "male") pid = idOf(p);
      else if (isFemaleLike(pi) || pi.sex === "female") mid = idOf(p);
    }
    // Un genitore di sesso ignoto occupa la colonna libera.
    for (const p of parents) {
      if (idOf(p) === pid || idOf(p) === mid) continue;
      if (pid === "0") pid = idOf(p);
      else if (mid === "0") mid = idOf(p);
    }
    const sex = ind.sex === "male" ? "1" : ind.sex === "female" ? "2" : "0";
    let pheno = "0";
    if (conditionId) {
      const c = ind.conditions.find((x) => x.conditionId === conditionId);
      if (c?.status === "affected") pheno = "2";
      else if (!ind.healthUnknown && !ind.placeholder) pheno = "1";
    }
    lines.push([fid, idOf(id), pid, mid, sex, pheno].join("\t"));
  }
  return lines.join("\n") + "\n";
}

export function importPed(text: string, conditionLabel = "Fenotipo (PED)"): ImportResult {
  const size = checkSize(text);
  if (size) return fail(size);
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/));
  if (rows.length === 0) return fail("Il file PED non contiene righe.");
  if (rows.some((r) => r.length < 6)) return fail("Ogni riga del PED deve avere 6 colonne: FID IID PID MID SEX PHENO.");
  if (rows.length > 2000) return fail("Il file contiene troppi individui (massimo 2000).");
  const key = (fid: string, iid: string) => `${fid}\u0000${iid}`;
  const persons: RawPerson[] = [];
  const parentage: RawParentage[] = [];
  const affected = new Set<string>();
  for (const [fid, iid, pid, mid, sex, pheno] of rows) {
    const k = key(fid, iid);
    persons.push({
      key: k,
      fields: {
        label: iid.slice(0, 40),
        sex: sex === "1" ? "male" : sex === "2" ? "female" : "unknown",
        gender: "not-expressed",
        healthUnknown: pheno === "0" || pheno === "-9" ? true : undefined,
      },
    });
    if (pheno === "2") affected.add(k);
    const parents = [pid, mid].filter((p) => p !== "0").map((p) => key(fid, p));
    if (parents.length) parentage.push({ child: k, parents, link: "biological" });
  }
  // Genitori citati ma senza riga: creati come segnaposto.
  const known = new Set(persons.map((p) => p.key));
  for (const pa of parentage) {
    for (const p of pa.parents) {
      if (!known.has(p)) {
        known.add(p);
        persons.push({ key: p, fields: { label: p.split("\u0000")[1], placeholder: true } });
      }
    }
  }
  const { pedigree, warnings, idOf } = assemble({ persons, parentage });
  let ped = pedigree;
  if (affected.size) {
    const res = addLegendCondition(ped, conditionLabel, uuid);
    ped = res.pedigree;
    for (const k of affected) {
      const id = idOf.get(k);
      if (id) ped.individuals[id] = { ...ped.individuals[id], conditions: [{ conditionId: res.id, status: "affected" }] };
    }
  }
  // Probando: il primo affetto senza figli, altrimenti il primo individuo.
  ped.proband = Object.keys(ped.individuals).find((id) => ped.individuals[id].conditions.length > 0) ?? Object.keys(ped.individuals)[0];
  return { ok: true, pedigree: ped, warnings: [...warnings, PED_LOSSES], format: "PED" };
}
