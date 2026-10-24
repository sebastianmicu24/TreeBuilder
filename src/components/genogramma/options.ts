import type { SelectOption } from "@/components/ui/select";

/** Opzioni condivise dei moduli (testi in italiano semplice). */
export const SEX_OPTIONS: SelectOption[] = [
  { value: "male", label: "Maschile" },
  { value: "female", label: "Femminile" },
  { value: "unassigned", label: "Non assegnato alla nascita" },
  { value: "unknown", label: "Non lo so / non noto" },
];

/** Il primo valore è il predefinito: identità uguale al sesso assegnato (NSGC 2022). */
export const GENDER_OPTIONS: SelectOption[] = [
  { value: "not-expressed", label: "Come il sesso assegnato" },
  { value: "man", label: "Uomo / ragazzo" },
  { value: "woman", label: "Donna / ragazza" },
  { value: "non-binary", label: "Non binario" },
  { value: "unknown", label: "Non nota" },
];

export const VITAL_OPTIONS: SelectOption[] = [
  { value: "alive", label: "In vita" },
  { value: "deceased", label: "Deceduto" },
  { value: "unknown", label: "Non lo so" },
];

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "Non presente" },
  { value: "affected", label: "Affetto (sintomatico)" },
  { value: "carrier", label: "Portatore non affetto" },
  { value: "presymptomatic", label: "Portatore presintomatico" },
];

export const AGE_UNIT_OPTIONS: SelectOption[] = [
  { value: "y", label: "anni" },
  { value: "mo", label: "mesi" },
  { value: "wk", label: "settimane" },
  { value: "d", label: "giorni" },
];

export const PREGNANCY_OPTIONS: SelectOption[] = [
  { value: "", label: "No (persona nata)" },
  { value: "ongoing", label: "Gravidanza in corso (P)" },
  { value: "SAB", label: "Aborto spontaneo (SAB)" },
  { value: "TOP", label: "Interruzione di gravidanza (TOP)" },
  { value: "ECT", label: "Gravidanza ectopica (ECT)" },
  { value: "SB", label: "Nato morto (SB)" },
];

export const PATTERN_OPTIONS: SelectOption[] = [
  { value: "solid", label: "Pieno" },
  { value: "hatch", label: "Tratteggio /" },
  { value: "hatch-reverse", label: "Tratteggio \\" },
  { value: "crosshatch", label: "Incrociato" },
  { value: "dots", label: "Puntini" },
  { value: "vertical", label: "Righe verticali" },
  { value: "horizontal", label: "Righe orizzontali" },
  { value: "grid", label: "Griglia" },
];
