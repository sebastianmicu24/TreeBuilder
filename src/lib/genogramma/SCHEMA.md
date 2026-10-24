# Schema del genogramma (`schemaVersion: 1`)

Logica pura in `src/lib/genogramma/`: niente React, DOM o rete. I tipi sono in
`model/types.ts`; questo file spiega le scelte che i tipi da soli non dicono.

## Principi

- **Grafo normalizzato.** Gli individui (`individuals`) e le unioni (`unions`)
  hanno ID stabili (UUID nel browser, ID leggibili nelle fixture). Le relazioni
  stanno solo nelle unioni. I ruoli rispetto al probando ("zia materna") si
  calcolano con `getRelationToProband`: non si salvano mai.
- **Allineato a GA4GH Pedigree.** `Pedigree` ↔ Pedigree, `Individual` ↔
  Individual, unioni e legami dei figli ↔ Relationship con i codici KIN
  (`model/kin.ts`, forma ridotta).
- **"Non lo so" è un dato.** Il valore letterale `"unknown"` (nascita, età,
  sesso, stato in vita) e `healthUnknown` registrano che l'informatore non lo sa.
  Un campo assente vuol dire invece "non ancora chiesto". `unknownFields()`
  elenca i dati da completare.
- **Età relative alla data del genogramma** (`date`), mai a "oggi": lo stesso
  file produce sempre lo stesso disegno.
- **Minimizzazione.** `label` contiene di default le iniziali o un'etichetta;
  `name` si compila solo per scelta esplicita. Per la nascita si preferisce
  l'anno.

## Pedigree

| Campo | Significato |
|---|---|
| `date` | Data di raccolta (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`); riferimento per le età |
| `proband`, `consultands` | Probando (al massimo uno) e consultandi (possono essere diversi dal probando) |
| `meta` | Metadati NSGC: chi compila e con quale qualifica, informatore, motivo della consulenza, ancestry dei due rami, data di aggiornamento |
| `legend.conditions` | Condizioni con codici opzionali (HPO, ORPHA, OMIM, ICD-10/11), riempimento B/N e colore |
| `legend.evaluations` | Tipi di valutazione; con più di uno si numerano `E1…En` nell'ordine della legenda |
| `display` | Impostazioni di visualizzazione salvate con il genogramma |

## Individual

- **Sesso e genere (NSGC 2022).** `sex` è il sesso assegnato alla nascita,
  `gender` l'identità di genere. La forma del simbolo segue il genere; con
  `not-expressed` o `unknown` segue il sesso, perché per bambini, gravidanze e
  parenti si assumono allineati. AMAB, AFAB e UAAB si scrivono solo quando sesso
  e genere non coincidono.
- **Gravidanze ed esiti.** Un individuo con `pregnancy` è una gravidanza o un
  esito: `ongoing` (P), `SAB`, `TOP`, `ECT`, `SB`. Non esistono altre sigle.
- **Condizioni.** `conditions[]` riferisce una voce della legenda con lo stato
  `affected` (riempimento), `carrier` (riempimento parziale) o `presymptomatic`
  (linea verticale), e con l'età di esordio o di diagnosi.
- **Valutazioni.** `evaluations[]` sono dati strutturati (tipo, esito
  `+`/`-`/`u`, gene, variante, ripetute). La notazione `E` la genera il
  renderer. `documentedEvaluation` corrisponde all'asterisco `*`.
- **Gemelli.** Si indicano con `twin.groupId` e la zigosità (`MZ`, `DZ`,
  `unknown`); `proven` aggiunge `*`. I membri devono stare nella stessa fratria.
- **Individui multipli.** `multiple` vale un numero ≥ 2 oppure `"n"`.
  `expandMultiple` li trasforma in individui singoli.
- **Ordine nella fratria.** `birthOrder` è la posizione manuale (1 = primo a
  sinistra).

## Union

- `partners` contiene 1 o 2 ID. **Un solo partner = genitore senza partner
  noto**: la linea di discendenza scende da sotto il simbolo (Fig. 5c) e non si
  crea nessun individuo fantasma. "Aggiungi genitori" inserisce l'altro
  genitore nella stessa unione.
- `status` è `current` o `ended` (due barre oblique sulla linea di relazione).
- `sequence` è l'ordine cronologico rispetto alle altre unioni e decide la
  posizione dei partner multipli.
- `consanguinity` presente = linea di relazione doppia; `degree` è il testo
  scritto sopra la linea. `detectConsanguinity` trova antenato comune, grado e
  coefficiente di parentela.
- `noChildren` indica nessun figlio per scelta (una barra) o infertilità (due
  barre), con il motivo. Esiste anche su `Individual`, per chi non ha partner.
- `children[]` è la fratria. `childOrder: "auto"` ordina per età (vedi
  `sibling-order.ts`); il drag imposta `"manual"` e riordina l'array.
  `partnerOrder` forza l'ordine sinistra→destra dei partner.

### Legami dei figli (`ChildLink`)

| `link` | Uso |
|---|---|
| `biological` | Figlio biologico dei partner; `adoptedOut` = dato in adozione (disegnato sotto i genitori biologici, tra parentesi) |
| `adoptive` | Adottato dentro; se esiste anche un legame biologico in un'altra unione, è un'adozione da parte di un parente o con famiglia biologica nota |
| `foster` | Affido (KIN:021) |
| `art` | Procreazione assistita: `art.eggFrom`, `spermFrom`, `carriedBy`, `mitoFrom` indicano un partner, un donatore o una gestante |

Dai dettagli ART si ricavano i ruoli. Non vengono salvati due volte:

- **D (donatore)**: ha fornito un gamete e non è partner.
- **G (gestante per altri)**: ha portato la gravidanza senza fornire l'ovocita.
- **Surrogata**: ha fornito l'ovocita e ha portato la gravidanza. Si marca con
  `D` e la gravidanza si disegna sotto di lei.

Un figlio appartiene **a una sola unione con legame di nascita** (biologico o
ART). Può avere in più legami adottivi o di affido. L'unione "casa", cioè dove
il figlio viene disegnato, segue le regole NSGC dell'adozione (`homeEntry`).

## Invarianti (`validate`)

Errori:
- riferimenti rotti;
- unioni con 0 o più di 2 partner;
- partner di sé stesso;
- figlio della propria unione;
- figlio biologico di più unioni;
- ciclo nella discendenza;
- gemelli in fratrie diverse.

Avvisi:
- grafo non connesso;
- date non valide;
- gemello senza il proprio gemello.

## Undo/redo

Ogni mutazione passa da un comando immutabile (`model/commands.ts`) che
restituisce un nuovo `Pedigree` condividendo la struttura invariata.
`model/history.ts` tiene una pila di istantanee, fino a 200 passi.

## Migrazioni e import

`migrate(json)` copia solo i campi noti, con il tipo atteso:
- tronca le stringhe;
- scarta le chiavi pericolose (`__proto__`);
- limita il numero di individui (2000);
- rifiuta le versioni future dello schema con un messaggio chiaro.

Una nuova versione dello schema aggiungerà qui un passo `v1 → v2`.

## Cosa si perde negli altri formati

Lo documenta `io/` per ciascun formato (fase 6). In sintesi:
- **JSON nativo:** nessuna perdita.
- **GA4GH/KIN:** si perdono display e pattern della legenda.
- **FHIR FamilyMemberHistory:** il modello è centrato sul probando; si perdono
  gravidanze, ART e gemelli.
- **Phenopackets:** si perdono relazioni non biologiche, gravidanze e genere.
- **PED:** resta una sola condizione; si perdono relazioni non biologiche e
  gravidanze.
