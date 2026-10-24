import { PedigreeBuilder } from "./__fixtures__/builder";
import {
  adoption,
  artScenarios,
  chainUnions,
  conditionsAndEvaluations,
  firstCousins,
  mixedAgesAndMultiples,
  pregnancies,
  sibshipOfSix,
  singleParent,
  threeGenerations,
  twins,
  twoPartners,
} from "./__fixtures__";
import type { DisplaySettings, Individual, Pedigree } from "./model/types";

/**
 * Pagina-catalogo: ogni voce della nomenclatura NSGC (2008, rivista nel
 * 2022 e corretta nel 2025) disegnata dal renderer reale. È il test visivo
 * di conformità. Nessun dato reale: solo esempi sintetici.
 */
export interface CatalogEntry {
  key: string;
  title: string;
  note?: string;
  pedigree: Pedigree;
}

export interface CatalogSection {
  key: string;
  title: string;
  intro?: string;
  entries: CatalogEntry[];
}

const COMPACT: Partial<DisplaySettings> = {
  showNumbers: false,
  showLegend: false,
  showMetadata: false,
  showLabel: false,
  labelMaxWidth: 110,
};

type Fields = Partial<Omit<Individual, "id">>;

let counter = 0;

function single(title: string, fields: Fields, note?: string, extra?: (b: PedigreeBuilder, id: string) => void): CatalogEntry {
  const b = new PedigreeBuilder(`c${++counter}`);
  const id = b.person(fields);
  extra?.(b, id);
  const ped = b.build();
  return { key: `c${counter}`, title, note, pedigree: { ...ped, display: { ...ped.display, ...COMPACT } } };
}

function family(title: string, ped: Pedigree, note?: string, display: Partial<DisplaySettings> = {}): CatalogEntry {
  counter += 1;
  return {
    key: `f${counter}`,
    title,
    note,
    pedigree: { ...ped, display: { ...ped.display, showMetadata: false, ...display } },
  };
}

function compact(title: string, build: (b: PedigreeBuilder) => string | void, note?: string): CatalogEntry {
  const b = new PedigreeBuilder(`k${++counter}`);
  const proband = build(b) || undefined;
  const ped = b.build(proband);
  return { key: `k${counter}`, title, note, pedigree: { ...ped, display: { ...ped.display, ...COMPACT } } };
}

export function buildCatalog(): CatalogSection[] {
  counter = 0;
  const man = { sex: "male", gender: "man" } as const;
  const woman = { sex: "female", gender: "woman" } as const;

  const sexGender: CatalogEntry[] = [
    single("Uomo / ragazzo", { ...man, age: { value: 34, unit: "y" } }),
    single("Donna / ragazza", { ...woman, age: { value: 30, unit: "y" } }),
    single("Non binario / gender diverse", { sex: "unknown", gender: "non-binary", age: { value: 25, unit: "y" } }),
    single("Sesso e genere non noti o non rilevanti", { sex: "unknown", gender: "unknown" }, "Rombo senza annotazione."),
    single("Uomo trans (AFAB)", { sex: "female", gender: "man", age: { value: 28, unit: "y" } }, "La forma segue il genere; il sesso assegnato si scrive solo se non coincide."),
    single("Donna trans (AMAB)", { sex: "male", gender: "woman", age: { value: 31, unit: "y" } }),
    single("Non binario, AMAB", { sex: "male", gender: "non-binary" }),
    single("Non binario, AFAB", { sex: "female", gender: "non-binary" }),
    single("Nessun sesso assegnato alla nascita", { sex: "unassigned", gender: "not-expressed" }, "Rombo con UAAB, salvo identità espressa."),
    single("Uomo con sesso non assegnato alla nascita", { sex: "unassigned", gender: "man" }),
    single("Cariotipo noto", { ...woman, karyotype: "46,XY", age: { value: 17, unit: "y" } }, "Il cariotipo si scrive sotto il simbolo solo se noto."),
  ];

  const withConditions = (labels: string[], statuses: Individual["conditions"][number]["status"][], fields: Fields = woman) =>
    compact("", (b) => {
      const ids = labels.map((l) => b.condition(l));
      b.person({ ...fields, conditions: ids.map((conditionId, i) => ({ conditionId, status: statuses[i] })) });
    }).pedigree;

  const individuals: CatalogEntry[] = [
    { key: "aff1", title: "Affetto (una condizione)", note: "Riempimento solo se clinicamente sintomatico, definito in legenda.", pedigree: withLegend(withConditions(["Condizione A"], ["affected"], man)) },
    { key: "aff2", title: "Due condizioni (metà)", pedigree: withLegend(withConditions(["A", "B"], ["affected", "affected"])) },
    { key: "aff4", title: "Quattro condizioni (quadranti)", pedigree: withLegend(withConditions(["A", "B", "C", "D"], ["affected", "affected", "affected", "affected"], man)) },
    { key: "aff6", title: "Più di quattro condizioni (settori)", pedigree: withLegend(withConditions(["A", "B", "C", "D", "E"], ["affected", "affected", "affected", "affected", "affected"])) },
    { key: "car", title: "Portatore non affetto (recessiva)", note: "Riempimento parziale nel settore della condizione; il punto centrale del 2008 è un'opzione legacy.", pedigree: withLegend(withConditions(["Fibrosi cistica"], ["carrier"])) },
    { key: "car2", title: "Affetto da A, portatore di B", pedigree: withLegend(withConditions(["A", "B"], ["affected", "carrier"], man)) },
    { key: "pre", title: "Portatore presintomatico", note: "Linea verticale al centro del simbolo.", pedigree: withLegend(withConditions(["Malattia di Huntington"], ["presymptomatic"], man)) },
    { key: "pre2", title: "Presintomatico per due condizioni", pedigree: withLegend(withConditions(["A", "B"], ["presymptomatic", "presymptomatic"])) },
    { key: "legacy", title: "Portatore, punto centrale (legacy, opzione)", pedigree: withDisplay(withConditions(["Fibrosi cistica"], ["carrier"]), { legacyCarrierDot: true, showLegend: true }) },
    single("Più individui, numero noto", { ...man, multiple: 5 }),
    single("Più individui, numero ignoto", { ...woman, multiple: "n" }),
    single("Più individui di sesso misto o non noto", { sex: "unknown", gender: "unknown", multiple: 3 }),
    single("Deceduto: anno", { ...man, vital: "deceased", death: { date: "1981" } }, "Diagonale che sporge oltre il simbolo; mai una croce."),
    single("Deceduto: età e causa", { ...woman, vital: "deceased", death: { age: { value: 35, unit: "y" }, cause: "infarto" } }),
    single("Deceduto: decennio di età", { ...man, vital: "deceased", death: { age: { decade: 60 } } }),
    single("Deceduto: neonato", { sex: "female", gender: "not-expressed", vital: "deceased", death: { age: { value: 4, unit: "mo" } } }),
    single("Nato morto", { sex: "male", gender: "not-expressed", vital: "deceased", pregnancy: { outcome: "SB", gestationalWeeks: 34 } }),
    compact("Probando (P)", (b) => b.person({ ...woman, age: { value: 8, unit: "y" } }), "Freccia in basso a sinistra con la lettera P."),
    { key: "cons", title: "Consultando (affetto e non affetto)", pedigree: consultands() },
    single("Valutazione documentata (*)", { ...man, documentedEvaluation: true, age: { value: 40, unit: "y" } }, "Solo se fatta o verificata dal proprio team."),
    single("Storia familiare non nota (?)", { ...woman, familyHistoryUnknown: true, age: { value: 52, unit: "y" } }),
  ];

  const labels: CatalogEntry[] = [
    compact(
      "Ordine delle etichette",
      (b) => {
        const c = b.condition("Cardiomiopatia");
        const e = b.evaluation("Ecocardiogramma");
        return b.person({
          sex: "male",
          gender: "woman",
          birth: "1990",
          documentedEvaluation: true,
          label: "M.R.",
          conditions: [{ conditionId: c, status: "affected", diagnosis: { value: 30, unit: "y" } }],
          evaluations: [{ evaluationId: e, result: "+", detail: "echo" }],
        });
      },
      "* accanto al simbolo, AMAB/AFAB/UAAB, età o b./d., numero di pedigree; poi etichetta, condizioni, valutazioni."
    ),
  ];
  labels[0].pedigree.display = { ...labels[0].pedigree.display, showNumbers: true, showLabel: true };

  const evaluations: CatalogEntry[] = [
    evalEntry("E+, E-, Eu", [
      { result: "+" },
      { result: "-" },
      { result: "u" },
    ]),
    evalEntry("E1+ (5385insC BRCA1), E2- (echo)", [
      { result: "+", variant: "5385insC", gene: "BRCA1", type: 0 },
      { result: "-", detail: "echo", type: 1 },
    ], ["Test BRCA1", "Ecocardiogramma"]),
    evalEntry("E+ (F508/u), E+ (CVS)", [{ result: "+", detail: "F508/u" }, { result: "+", detail: "CVS" }]),
    evalEntry("Espansione di ripetute: allele affetto per primo", [{ result: "u", repeats: ["36n", "18n"] }]),
  ];

  const lines: CatalogEntry[] = [
    compact("Linea di relazione", (b) => {
      const k = b.boy({ age: { value: 3, unit: "y" } });
      b.union([b.man(), b.woman()], [k]);
    }),
    compact("Relazione terminata", (b) => {
      b.union([b.man(), b.woman()], [b.girl()], { status: "ended" });
    }),
    compact("Consanguineità con grado", (b) => {
      b.union([b.man(), b.woman()], [b.boy()], { consanguinity: { degree: "cugini di terzo grado" } });
    }),
    family("Consanguineità evidente dal disegno", firstCousins(), undefined, { showLegend: false, showNumbers: false }),
    family("Fratria in ordine di nascita (età miste)", sibshipOfSix(), "Dal più grande al più piccolo; chi non ha età resta al proprio posto; mai per sesso.", { showLegend: false }),
    family("Gemelli: MZ (barra tra le linee), DZ, zigosità ignota (?), trigemini", twins(), "* accanto alla barra: zigosità provata.", { showLegend: true }),
    compact("Nessun figlio per scelta", (b) => {
      b.union([b.man(), b.woman()], [], { noChildren: { kind: "by-choice", reason: "vasectomia" } });
    }),
    compact("Infertilità", (b) => {
      b.union([b.man(), b.woman()], [], { noChildren: { kind: "infertility", reason: "endometriosi" } });
    }),
    compact("Nessun figlio, individuo senza partner", (b) => {
      b.man({ noChildren: { kind: "infertility", reason: "azoospermia" } });
    }),
    family("Adozione: dentro, fuori, da parente", adoption(), "Parentesi quadre sempre; tratteggio verso i genitori adottivi, linea continua verso quelli biologici.", { showLegend: true }),
    family("Unioni multiple e mezzi fratelli", twoPartners(), "Eccezione alla convenzione: la persona con più partner al centro.", { showLegend: false }),
    family("Unioni a catena", chainUnions(), undefined, { showLegend: false }),
    family("Genitore senza partner noto", singleParent(), "Linea dal singolo (Fig. 5c), nessun individuo fantasma.", { showLegend: false }),
  ];

  const pregnancySection: CatalogEntry[] = [family("Gravidanze ed esiti", pregnancies(), "Solo SAB, TOP, ECT, SB, P. Le linee individuali hanno lunghezza normale.", { showLegend: true })];

  const art: CatalogEntry[] = artScenarios().map((s) =>
    family(s.title, s.pedigree, undefined, { showLegend: true, showNumbers: false })
  );

  const full: CatalogEntry[] = [
    family("Legenda e metadati", withMeta(conditionsAndEvaluations()), undefined, { showMetadata: true, showLegend: true, showNotes: true }),
    family("Tre generazioni di antenati", threeGenerations(), "Ramo paterno a sinistra, materno a destra; generazioni in numeri romani.", { showLegend: false }),
    family("Età miste, approssimative e individui multipli", mixedAgesAndMultiples(), undefined, { showLegend: true }),
  ];

  return [
    { key: "sesso", title: "Sesso e genere", intro: "La forma segue l'identità di genere (2022).", entries: sexGender },
    { key: "simboli", title: "Simboli individuali", entries: individuals },
    { key: "etichette", title: "Etichette", entries: labels },
    { key: "valutazioni", title: "Valutazioni e test", entries: evaluations },
    { key: "linee", title: "Linee", entries: lines },
    { key: "gravidanze", title: "Gravidanze ed esiti", entries: pregnancySection },
    { key: "art", title: "Procreazione assistita (Fig. 5)", intro: "D donatore, G gestante per altri; la surrogata è marcata D e la gravidanza sta sotto di lei.", entries: art },
    { key: "esempi", title: "Legenda, metadati ed esempi completi", entries: full },
  ];
}

function withDisplay(ped: Pedigree, patch: Partial<DisplaySettings>): Pedigree {
  return { ...ped, display: { ...ped.display, ...patch } };
}

function withLegend(ped: Pedigree): Pedigree {
  return withDisplay(ped, { showLegend: true });
}

function withMeta(ped: Pedigree): Pedigree {
  return {
    ...ped,
    meta: {
      title: "Esempio",
      compiledBy: "Dott.ssa A.B.",
      compilerRole: "genetista",
      historian: "madre del probando",
      reason: "tumori familiari",
      ancestryPaternal: "Italia meridionale",
      ancestryMaternal: "Romania",
      updated: "2026-01-15",
    },
  };
}

function consultands(): Pedigree {
  const b = new PedigreeBuilder("cs");
  const c = b.condition("Condizione A");
  const a = b.woman({ age: { value: 30, unit: "y" } });
  const m = b.man({ age: { value: 32, unit: "y" }, conditions: [{ conditionId: c, status: "affected" }] });
  b.union([m, a], []);
  const ped = b.build(undefined, [a, m]);
  return { ...ped, display: { ...ped.display, ...COMPACT, showLegend: true } };
}

function evalEntry(
  title: string,
  evals: { result: "+" | "-" | "u"; detail?: string; gene?: string; variant?: string; repeats?: [string, string]; type?: number }[],
  types: string[] = []
): CatalogEntry {
  const b = new PedigreeBuilder(`e${++counter}`);
  const typeIds = types.map((t) => b.evaluation(t));
  const ids = evals.map((e) =>
    b.person({
      sex: "female",
      gender: "woman",
      evaluations: [
        {
          evaluationId: e.type !== undefined ? typeIds[e.type] : undefined,
          result: e.result,
          detail: e.detail,
          gene: e.gene,
          variant: e.variant,
          repeats: e.repeats,
        },
      ],
    })
  );
  if (ids.length > 1) {
    const parents = [b.man(), b.woman()];
    b.union(parents, ids);
  }
  const ped = b.build();
  return { key: `e${counter}`, title, pedigree: { ...ped, display: { ...ped.display, ...COMPACT, showLegend: types.length > 0 } } };
}
