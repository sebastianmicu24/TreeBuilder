import { describe, expect, it } from "vitest";
import { threeGenerations } from "../__fixtures__";
import { MemoryStorage } from "../storage/adapter";
import { draftTitle } from "../storage/title";

describe("archivio locale", () => {
  it("revisioni e conflitto tra schede: nessuna sovrascrittura silenziosa", async () => {
    const s = new MemoryStorage();
    const ped = threeGenerations();
    const base = { id: "d1", kind: "pedigree" as const, title: draftTitle(ped), updatedAt: "2026-01-01", pedigree: ped };
    const a = await s.put(base, null);
    expect(a).toEqual({ ok: true, revision: 1 });
    // Scheda A salva (revisione 1 → 2).
    expect(await s.put({ ...base, updatedAt: "2026-01-02" }, 1)).toEqual({ ok: true, revision: 2 });
    // Scheda B, ferma alla revisione 1, non deve sovrascrivere.
    const b = await s.put({ ...base, title: "B" }, 1);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.conflict.revision).toBe(2);
    // Sovrascrittura esplicita.
    expect((await s.put({ ...base, title: "B" }, null)).ok).toBe(true);
    expect((await s.get("d1"))!.title).toBe("B");
    expect(await s.list()).toHaveLength(1);
    await s.clear();
    expect(await s.list()).toEqual([]);
  });

  it("il titolo della bozza non contiene nomi", () => {
    const ped = threeGenerations();
    ped.individuals[ped.proband!].name = "Nome Cognome";
    expect(draftTitle(ped)).not.toContain("Nome");
    expect(draftTitle(ped)).toMatch(/15 familiari/);
  });
});
