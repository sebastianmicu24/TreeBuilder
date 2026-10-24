import { createIndividual, createPedigree, createUnion, nextConditionStyle } from "../model/create";
import type { ChildLink, ConditionCode, Id, Individual, Pedigree, Union } from "../model/types";

/**
 * Costruttore compatto per le fixture (nessun dato reale: etichette
 * generiche, date inventate). ID leggibili e deterministici.
 */
export class PedigreeBuilder {
  private ped: Pedigree;
  private n = 0;
  private u = 0;
  private seq = 0;

  constructor(
    private prefix = "",
    date = "2026-01-15"
  ) {
    this.ped = createPedigree({ id: `fx${prefix}`, date, now: new Date("2026-01-15T00:00:00Z") });
  }

  person(fields: Partial<Omit<Individual, "id">> = {}): Id {
    const id = `${this.prefix}I${++this.n}`;
    this.ped.individuals[id] = createIndividual(id, { label: `${this.prefix}${this.n}`, ...fields });
    return id;
  }

  man(fields: Partial<Omit<Individual, "id">> = {}): Id {
    return this.person({ sex: "male", gender: "man", ...fields });
  }

  woman(fields: Partial<Omit<Individual, "id">> = {}): Id {
    return this.person({ sex: "female", gender: "woman", ...fields });
  }

  /** Bambino o parente: sesso noto, genere non espresso (si assumono allineati). */
  boy(fields: Partial<Omit<Individual, "id">> = {}): Id {
    return this.person({ sex: "male", gender: "not-expressed", ...fields });
  }

  girl(fields: Partial<Omit<Individual, "id">> = {}): Id {
    return this.person({ sex: "female", gender: "not-expressed", ...fields });
  }

  pregnancy(
    outcome: NonNullable<Individual["pregnancy"]>["outcome"],
    fields: Partial<Omit<Individual, "id">> = {}
  ): Id {
    return this.person({
      vital: outcome === "ongoing" ? "alive" : "deceased",
      ...fields,
      pregnancy: { outcome, ...fields.pregnancy },
    });
  }

  union(
    partners: Id[],
    children: (Id | ChildLink)[] = [],
    fields: Partial<Omit<Union, "id" | "partners" | "children">> = {}
  ): Id {
    const id = `${this.prefix}U${++this.u}`;
    this.ped.unions[id] = createUnion(id, partners, {
      sequence: ++this.seq,
      ...fields,
      children: children.map((c) => (typeof c === "string" ? { id: c, link: "biological" } : c)),
    });
    return id;
  }

  condition(label: string, codes: ConditionCode[] = []): Id {
    const id = `${this.prefix}C${this.ped.legend.conditions.length + 1}`;
    this.ped.legend.conditions.push({ id, label, codes, ...nextConditionStyle(this.ped.legend.conditions) });
    return id;
  }

  evaluation(label: string): Id {
    const id = `${this.prefix}E${this.ped.legend.evaluations.length + 1}`;
    this.ped.legend.evaluations.push({ id, label });
    return id;
  }

  get(id: Id): Individual {
    return this.ped.individuals[id];
  }

  update(id: Id, fields: Partial<Omit<Individual, "id">>): void {
    this.ped.individuals[id] = { ...this.ped.individuals[id], ...fields };
  }

  build(proband?: Id, consultands: Id[] = []): Pedigree {
    return structuredClone({ ...this.ped, proband, consultands });
  }
}
