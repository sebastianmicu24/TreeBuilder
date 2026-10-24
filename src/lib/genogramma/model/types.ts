/**
 * Modello dati del genogramma (schemaVersion 1).
 *
 * Allineato al modello concettuale GA4GH Pedigree (Pedigree, Individual,
 * Relationship): gli individui sono nodi con ID stabili, le relazioni sono
 * esplicite nelle unioni (`Union`), i ruoli rispetto al probando si
 * calcolano (`queries.ts`). Documentazione completa in `../SCHEMA.md`.
 *
 * Convenzione per "Non lo so": il valore letterale "unknown" è un dato
 * (l'informatore non lo sa), un campo assente è un dato non ancora chiesto.
 */

export type Id = string;

/** "Non lo so" esplicito. */
export type Unknown = "unknown";

/** Data parziale: "YYYY", "YYYY-MM" o "YYYY-MM-DD". */
export type PartialDate = string;

/** Data, decennio approssimato ("anni '60" → { decade: 1960 }) o sconosciuta. */
export type DateValue = PartialDate | { decade: number } | Unknown;

/** y anni, mo mesi, wk settimane, d giorni, gw settimane gestazionali. */
export type AgeUnit = "y" | "mo" | "wk" | "d" | "gw";

/** Età con unità, decennio di età ("60's" → { decade: 60 }) o sconosciuta. */
export type Age =
  | { value: number; unit: AgeUnit; approx?: boolean }
  | { decade: number }
  | Unknown;

/** Sesso assegnato alla nascita. */
export type Sex = "male" | "female" | "unassigned" | "unknown";

/** Identità di genere. "not-expressed": bambini, gravidanze, parenti senza informazioni. */
export type Gender = "man" | "woman" | "non-binary" | "unknown" | "not-expressed";

export type VitalStatus = "alive" | "deceased" | "unknown";

/** Esiti di gravidanza (NSGC 2022/2025): solo queste sigle. */
export type PregnancyOutcome = "ongoing" | "SAB" | "TOP" | "ECT" | "SB";

export type ConditionStatus = "affected" | "carrier" | "presymptomatic";

export type PatternId =
  | "solid"
  | "hatch"
  | "hatch-reverse"
  | "crosshatch"
  | "dots"
  | "vertical"
  | "horizontal"
  | "grid";

export type CodeSystem = "HPO" | "ORPHA" | "OMIM" | "ICD10" | "ICD11";

export interface ConditionCode {
  system: CodeSystem;
  code: string;
}

export interface LegendCondition {
  id: Id;
  label: string;
  codes: ConditionCode[];
  /** Riempimento in bianco e nero (sempre presente: il colore non è mai l'unico portatore di significato). */
  pattern: PatternId;
  /** Colore usato solo in modalità colori. */
  color: string;
}

/** Tipo di valutazione o test: E1, E2… quando ce n'è più di uno. */
export interface LegendEvaluation {
  id: Id;
  label: string;
}

export interface IndividualCondition {
  conditionId: Id;
  status: ConditionStatus;
  onset?: Age;
  diagnosis?: Age;
}

export type EvaluationResult = "+" | "-" | "u";

/**
 * Valutazione o test come dato strutturato. Il renderer ne ricava la
 * notazione NSGC: `E1+ (5385insC BRCA1)`, `E-`, `Eu (36n/18n)`.
 */
export interface IndividualEvaluation {
  /** Tipo in legenda; assente se la legenda ha un solo tipo ("E"). */
  evaluationId?: Id;
  result: EvaluationResult;
  /** Dettaglio libero tra parentesi (es. "echo", "CVS"). Ha la precedenza su gene/variante. */
  detail?: string;
  gene?: string;
  variant?: string;
  classification?: string;
  date?: PartialDate;
  /** Espansione di ripetute: allele affetto per primo ("36n", "18n"). */
  repeats?: [string, string];
}

export interface Pregnancy {
  outcome: PregnancyOutcome;
  /** Età gestazionale in settimane. */
  gestationalWeeks?: number;
  /** Risultato (es. "46,XY", "trisomia 21"). */
  result?: string;
  /** Metodo (es. "Amnio", "CVS", "cfDNA", "US"). */
  method?: string;
}

export interface Twin {
  groupId: Id;
  zygosity: "MZ" | "DZ" | "unknown";
  /** Zigosità provata da test: `*` accanto alla barra o al `?`. */
  proven?: boolean;
}

export interface NoChildren {
  kind: "by-choice" | "infertility";
  reason?: string;
}

export interface Individual {
  id: Id;
  /** Etichetta libera (iniziali di default: minimizzazione). */
  label?: string;
  /** Nome completo, solo se l'utente lo inserisce esplicitamente. */
  name?: string;
  sex: Sex;
  gender: Gender;
  karyotype?: string;
  birth?: DateValue;
  /** Età alla data del genogramma (se non calcolabile dalla nascita). */
  age?: Age;
  vital: VitalStatus;
  death?: { age?: Age; date?: DateValue; cause?: string };
  /** Presente solo per gravidanze ed esiti (P, SAB, TOP, ECT, SB). */
  pregnancy?: Pregnancy;
  populationDescriptors?: string;
  conditions: IndividualCondition[];
  /** "Non lo so" sui problemi di salute. */
  healthUnknown?: boolean;
  evaluations: IndividualEvaluation[];
  /** `*`: valutazione fatta o verificata dal proprio team. */
  documentedEvaluation?: boolean;
  /** `?` sopra il simbolo. */
  familyHistoryUnknown?: boolean;
  /** Più individui in un simbolo: numero noto o "n". */
  multiple?: number | "n";
  twin?: Twin;
  /** Nessun figlio o infertilità di un individuo senza partner. */
  noChildren?: NoChildren;
  /** Posizione manuale nella fratria (1 = primo a sinistra). */
  birthOrder?: number;
  notes?: string;
  /** Segnaposto "ignoto" (es. genitore sostituito dopo un'eliminazione). */
  placeholder?: boolean;
}

/** Dettagli della procreazione assistita per un figlio (Fig. 5). */
export interface ArtDetails {
  /** Chi ha fornito l'ovocita: un partner o un donatore. */
  eggFrom?: Id;
  /** Chi ha fornito il seme: un partner o un donatore. */
  spermFrom?: Id;
  /** Chi ha portato la gravidanza: un partner, una gestante per altri o una surrogata. */
  carriedBy?: Id;
  /** Donatore mitocondriale. */
  mitoFrom?: Id;
}

export type ChildLinkType = "biological" | "adoptive" | "foster" | "art";

export interface ChildLink {
  id: Id;
  link: ChildLinkType;
  /** Solo per link "biological": dato in adozione (disegnato sotto i genitori biologici, tra parentesi). */
  adoptedOut?: boolean;
  art?: ArtDetails;
}

export interface Union {
  id: Id;
  /** 1 partner = genitore senza partner noto (linea dal singolo, Fig. 5c); 2 = coppia. */
  partners: Id[];
  status: "current" | "ended";
  /** Ordine cronologico rispetto alle altre unioni (più piccolo = precedente). */
  sequence: number;
  /** Presente = consanguineità dichiarata (linea doppia); `degree` scritto sopra la linea. */
  consanguinity?: { degree?: string };
  noChildren?: NoChildren;
  /** Figli nell'ordine della fratria (l'ordine conta quando childOrder è "manual"). */
  children: ChildLink[];
  childOrder: "auto" | "manual";
  /** Ordine sinistra→destra dei partner deciso dall'utente. */
  partnerOrder?: Id[];
}

export interface PedigreeMeta {
  title?: string;
  compiledBy?: string;
  compilerRole?: string;
  historian?: string;
  reason?: string;
  ancestryPaternal?: string;
  ancestryMaternal?: string;
  /** Data dell'ultimo aggiornamento clinico (diversa da `date`, data di raccolta). */
  updated?: PartialDate;
}

export type FontFamily = "Arial" | "Helvetica" | "Times New Roman" | "Courier New";

export interface DisplaySettings {
  symbolSize: number;
  hSpacing: number;
  vSpacing: number;
  fontSize: number;
  textGap: number;
  fontFamily: FontFamily;
  /** Larghezza massima delle etichette, oltre si va a capo. */
  labelMaxWidth: number;
  showLabel: boolean;
  showConditions: boolean;
  showEvaluations: boolean;
  showNotes: boolean;
  showNumbers: boolean;
  showLegend: boolean;
  showMetadata: boolean;
  color: boolean;
  /** Lingua di legenda e testi generati; le sigle NSGC restano in inglese. */
  language: "en" | "it";
  /**
   * Convenzione facoltativa (non NSGC): nella coppia uomo a sinistra.
   * Disattivata di default: la NSGC 2022 non prescrive il lato dei partner.
   */
  maleLeft: boolean;
  /** Coppie un po' più distanti pur di avere linee di discendenza dritte. */
  straightLines: boolean;
  /** Nasconde i partner di relazioni terminate senza figli (solo disegno). */
  hidePriorPartners: boolean;
  /** Punto centrale del 2008 per i portatori (legacy). */
  legacyCarrierDot: boolean;
}

export interface Pedigree {
  id: Id;
  schemaVersion: 1;
  /** Data di raccolta: riferimento per il calcolo delle età. */
  date: PartialDate;
  createdAt: string;
  updatedAt: string;
  proband?: Id;
  consultands: Id[];
  meta: PedigreeMeta;
  legend: { conditions: LegendCondition[]; evaluations: LegendEvaluation[] };
  individuals: Record<Id, Individual>;
  unions: Record<Id, Union>;
  display: DisplaySettings;
}

export const SCHEMA_VERSION = 1 as const;
