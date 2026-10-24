import type { ConditionCode } from "../model/types";

/**
 * Vocabolario locale di condizioni frequenti in pediatria e genetica,
 * incluso nel bundle: la ricerca non esce mai dal dispositivo (anche la
 * sola stringa digitata può rivelare una diagnosi). I codici sono quelli
 * pubblici di HPO, Orphanet, OMIM e ICD-10; dove un codice non era certo
 * è stato omesso. L'utente può sempre inserire un codice a mano.
 */
export interface VocabEntry {
  label: string;
  /** Sinonimi e sigle per la ricerca. */
  aka?: string[];
  codes: ConditionCode[];
}

const c = (system: ConditionCode["system"], code: string): ConditionCode => ({ system, code });

export const CONDITION_VOCAB: VocabEntry[] = [
  { label: "Fibrosi cistica", aka: ["FC", "mucoviscidosi", "CFTR"], codes: [c("ORPHA", "586"), c("OMIM", "219700"), c("ICD10", "E84")] },
  { label: "Sindrome di Down (trisomia 21)", aka: ["trisomia 21", "T21"], codes: [c("ORPHA", "870"), c("OMIM", "190685"), c("ICD10", "Q90")] },
  { label: "Trisomia 18 (sindrome di Edwards)", aka: ["Edwards", "T18"], codes: [c("ORPHA", "3380"), c("ICD10", "Q91.3")] },
  { label: "Trisomia 13 (sindrome di Patau)", aka: ["Patau", "T13"], codes: [c("ORPHA", "3378"), c("ICD10", "Q91.7")] },
  { label: "Sindrome di Turner", aka: ["45,X", "monosomia X"], codes: [c("ORPHA", "881"), c("ICD10", "Q96")] },
  { label: "Sindrome di Klinefelter", aka: ["47,XXY"], codes: [c("ORPHA", "484"), c("ICD10", "Q98.0")] },
  { label: "Sindrome dell'X fragile", aka: ["X fragile", "FMR1"], codes: [c("ORPHA", "908"), c("OMIM", "300624"), c("ICD10", "Q99.2")] },
  { label: "Delezione 22q11.2 (DiGeorge)", aka: ["DiGeorge", "velocardiofacciale", "22q11"], codes: [c("ORPHA", "567"), c("ICD10", "D82.1")] },
  { label: "Sindrome di Prader-Willi", aka: ["PWS"], codes: [c("ORPHA", "739"), c("OMIM", "176270")] },
  { label: "Sindrome di Angelman", codes: [c("ORPHA", "72"), c("OMIM", "105830"), c("ICD10", "Q93.5")] },
  { label: "Sindrome di Williams", aka: ["Williams-Beuren"], codes: [c("ORPHA", "904"), c("OMIM", "194050")] },
  { label: "Sindrome di Noonan", codes: [c("ORPHA", "648"), c("OMIM", "163950")] },
  { label: "Sindrome di Rett", aka: ["MECP2"], codes: [c("ORPHA", "778"), c("OMIM", "312750"), c("ICD10", "F84.2")] },
  { label: "Sindrome di Marfan", aka: ["FBN1"], codes: [c("ORPHA", "558"), c("OMIM", "154700"), c("ICD10", "Q87.4")] },
  { label: "Sindrome di Ehlers-Danlos", aka: ["EDS"], codes: [c("ORPHA", "98249"), c("ICD10", "Q79.6")] },
  { label: "Neurofibromatosi tipo 1", aka: ["NF1", "von Recklinghausen"], codes: [c("ORPHA", "636"), c("OMIM", "162200"), c("ICD10", "Q85.0")] },
  { label: "Sclerosi tuberosa", aka: ["TSC"], codes: [c("ORPHA", "805"), c("ICD10", "Q85.1")] },
  { label: "Acondroplasia", aka: ["FGFR3"], codes: [c("ORPHA", "15"), c("OMIM", "100800"), c("ICD10", "Q77.4")] },
  { label: "Osteogenesi imperfetta", aka: ["OI", "ossa di vetro"], codes: [c("ORPHA", "666"), c("ICD10", "Q78.0")] },
  { label: "Distrofia muscolare di Duchenne", aka: ["DMD", "Duchenne"], codes: [c("OMIM", "310200"), c("ICD10", "G71.0")] },
  { label: "Atrofia muscolare spinale", aka: ["SMA", "SMN1"], codes: [c("ORPHA", "70")] },
  { label: "Distrofia miotonica tipo 1", aka: ["Steinert", "DM1"], codes: [c("ORPHA", "273"), c("OMIM", "160900"), c("ICD10", "G71.1")] },
  { label: "Atassia di Friedreich", codes: [c("ORPHA", "95"), c("OMIM", "229300"), c("ICD10", "G11.1")] },
  { label: "Malattia di Huntington", aka: ["corea di Huntington", "HTT"], codes: [c("ORPHA", "399"), c("OMIM", "143100"), c("ICD10", "G10")] },
  { label: "Emofilia A", aka: ["F8"], codes: [c("ORPHA", "98878"), c("OMIM", "306700"), c("ICD10", "D66")] },
  { label: "Emofilia B", aka: ["F9"], codes: [c("ORPHA", "98879"), c("OMIM", "306900"), c("ICD10", "D67")] },
  { label: "Anemia falciforme", aka: ["drepanocitosi", "HbS"], codes: [c("ORPHA", "232"), c("OMIM", "603903"), c("ICD10", "D57")] },
  { label: "Beta-talassemia", aka: ["talassemia", "anemia mediterranea"], codes: [c("ORPHA", "848"), c("ICD10", "D56.1")] },
  { label: "Deficit di G6PD", aka: ["favismo"], codes: [c("ORPHA", "362"), c("OMIM", "300908"), c("ICD10", "D55.0")] },
  { label: "Fenilchetonuria", aka: ["PKU"], codes: [c("ORPHA", "716"), c("OMIM", "261600"), c("ICD10", "E70.0")] },
  { label: "Malattia di Wilson", aka: ["ATP7B"], codes: [c("ORPHA", "905"), c("OMIM", "277900"), c("ICD10", "E83.0")] },
  { label: "Malattia di Gaucher", codes: [c("ORPHA", "355"), c("ICD10", "E75.2")] },
  { label: "Malattia di Tay-Sachs", codes: [c("ORPHA", "845"), c("OMIM", "272800"), c("ICD10", "E75.0")] },
  { label: "Emocromatosi ereditaria", aka: ["HFE"], codes: [c("OMIM", "235200"), c("ICD10", "E83.1")] },
  { label: "Ipercolesterolemia familiare", aka: ["FH", "LDLR"], codes: [c("ORPHA", "406"), c("OMIM", "143890"), c("ICD10", "E78.0")] },
  { label: "Rene policistico autosomico dominante", aka: ["ADPKD", "policistosi renale"], codes: [c("ORPHA", "730"), c("ICD10", "Q61.2")] },
  { label: "Malattia di Hirschsprung", aka: ["megacolon congenito"], codes: [c("ORPHA", "388"), c("HPO", "HP:0002251"), c("ICD10", "Q43.1")] },
  { label: "Retinoblastoma", aka: ["RB1"], codes: [c("ORPHA", "790"), c("OMIM", "180200"), c("ICD10", "C69.2")] },
  { label: "Sindrome di Lynch", aka: ["HNPCC"], codes: [c("ORPHA", "144"), c("OMIM", "120435")] },
  { label: "Carcinoma mammario e ovarico ereditario", aka: ["BRCA1", "BRCA2", "HBOC"], codes: [c("ORPHA", "145")] },
  { label: "Celiachia", aka: ["malattia celiaca"], codes: [c("ORPHA", "555"), c("ICD10", "K90.0")] },
  { label: "Tumore della mammella", aka: ["carcinoma mammario"], codes: [c("HPO", "HP:0003002"), c("ICD10", "C50")] },
  { label: "Tumore dell'ovaio", codes: [c("HPO", "HP:0100615"), c("ICD10", "C56")] },
  { label: "Tumore del colon", aka: ["carcinoma colorettale"], codes: [c("HPO", "HP:0003003"), c("ICD10", "C18")] },
  { label: "Tumore della prostata", codes: [c("HPO", "HP:0012125"), c("ICD10", "C61")] },
  { label: "Melanoma", codes: [c("HPO", "HP:0002861"), c("ICD10", "C43")] },
  { label: "Leucemia", codes: [c("HPO", "HP:0001909"), c("ICD10", "C95")] },
  { label: "Cardiopatia congenita", aka: ["malformazione cardiaca"], codes: [c("HPO", "HP:0001627"), c("ICD10", "Q24.9")] },
  { label: "Cardiomiopatia ipertrofica", aka: ["CMI", "HCM"], codes: [c("HPO", "HP:0001639")] },
  { label: "Cardiomiopatia dilatativa", aka: ["DCM"], codes: [c("HPO", "HP:0001644"), c("ICD10", "I42.0")] },
  { label: "Morte improvvisa", aka: ["morte cardiaca improvvisa"], codes: [c("HPO", "HP:0001699")] },
  { label: "Infarto miocardico", aka: ["infarto"], codes: [c("HPO", "HP:0001658"), c("ICD10", "I21")] },
  { label: "Ictus", codes: [c("HPO", "HP:0001297"), c("ICD10", "I64")] },
  { label: "Ipertensione arteriosa", codes: [c("HPO", "HP:0000822"), c("ICD10", "I10")] },
  { label: "Diabete mellito tipo 1", codes: [c("ICD10", "E10")] },
  { label: "Diabete mellito tipo 2", codes: [c("ICD10", "E11")] },
  { label: "Obesità", codes: [c("HPO", "HP:0001513"), c("ICD10", "E66")] },
  { label: "Asma", codes: [c("HPO", "HP:0002099"), c("ICD10", "J45")] },
  { label: "Epilessia", aka: ["convulsioni", "crisi epilettiche"], codes: [c("HPO", "HP:0001250"), c("ICD10", "G40")] },
  { label: "Disturbo dello spettro autistico", aka: ["autismo", "ASD"], codes: [c("HPO", "HP:0000729"), c("ICD10", "F84.0")] },
  { label: "Disabilità intellettiva", aka: ["ritardo mentale"], codes: [c("HPO", "HP:0001249"), c("ICD10", "F79")] },
  { label: "Ritardo globale dello sviluppo", aka: ["ritardo psicomotorio"], codes: [c("HPO", "HP:0001263")] },
  { label: "ADHD", aka: ["deficit di attenzione e iperattività"], codes: [c("HPO", "HP:0007018"), c("ICD10", "F90")] },
  { label: "Paralisi cerebrale infantile", aka: ["PCI"], codes: [c("HPO", "HP:0100021"), c("ICD10", "G80")] },
  { label: "Microcefalia", codes: [c("HPO", "HP:0000252"), c("ICD10", "Q02")] },
  { label: "Idrocefalo", codes: [c("HPO", "HP:0000238"), c("ICD10", "Q03")] },
  { label: "Spina bifida", aka: ["difetto del tubo neurale"], codes: [c("HPO", "HP:0002414"), c("ICD10", "Q05")] },
  { label: "Labiopalatoschisi", aka: ["labbro leporino", "palatoschisi"], codes: [c("HPO", "HP:0000202"), c("ICD10", "Q37")] },
  { label: "Ipoacusia", aka: ["sordità"], codes: [c("HPO", "HP:0000365"), c("ICD10", "H90")] },
  { label: "Ipovisione", aka: ["cecità"], codes: [c("HPO", "HP:0000505")] },
  { label: "Displasia congenita dell'anca", codes: [c("HPO", "HP:0001385"), c("ICD10", "Q65")] },
  { label: "Piede torto congenito", codes: [c("HPO", "HP:0001762"), c("ICD10", "Q66.0")] },
  { label: "Ipospadia", codes: [c("HPO", "HP:0000047"), c("ICD10", "Q54")] },
  { label: "Criptorchidismo", codes: [c("HPO", "HP:0000028"), c("ICD10", "Q53")] },
  { label: "Stenosi ipertrofica del piloro", codes: [c("HPO", "HP:0002021"), c("ICD10", "Q40.0")] },
  { label: "Demenza", aka: ["Alzheimer"], codes: [c("HPO", "HP:0000726")] },
  { label: "Depressione", codes: [c("HPO", "HP:0000716"), c("ICD10", "F32")] },
  { label: "Disturbo bipolare", codes: [c("HPO", "HP:0007302"), c("ICD10", "F31")] },
  { label: "Schizofrenia", codes: [c("HPO", "HP:0100753"), c("ICD10", "F20")] },
  { label: "Aborti spontanei ricorrenti", codes: [c("HPO", "HP:0200067")] },
  { label: "Infertilità", codes: [c("HPO", "HP:0000789")] },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Ricerca locale per nome, sinonimo o codice (es. "fibrosi", "FC",
 * "ORPHA:586", "E84"). Nessuna rete, nessun log.
 */
export function searchConditions(query: string, limit = 8): VocabEntry[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { e: VocabEntry; score: number }[] = [];
  for (const e of CONDITION_VOCAB) {
    const label = normalize(e.label);
    const aka = (e.aka ?? []).map(normalize);
    const codes = e.codes.map((x) => normalize(`${x.system}:${x.code}`)).concat(e.codes.map((x) => normalize(x.code)));
    let score = 0;
    if (label.startsWith(q)) score = 4;
    else if (label.split(/[\s'(-]+/).some((w) => w.startsWith(q))) score = 3;
    else if (aka.some((a) => a.startsWith(q))) score = 3;
    else if (codes.some((x) => x.startsWith(q) || x.endsWith(`:${q}`))) score = 2;
    else if (label.includes(q) || aka.some((a) => a.includes(q))) score = 1;
    if (score > 0) scored.push({ e, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label, "it")).slice(0, limit).map((s) => s.e);
}
