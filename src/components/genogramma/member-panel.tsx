"use client";

import type { ReactNode } from "react";
import { Baby, ChevronRight, HeartHandshake, Star, Trash2, UserPlus, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  addLegendCondition,
  clearTwin,
  expandMultiple,
  resetChildOrder,
  setIndividualCondition,
  setProband,
  setTwins,
  toggleConsultand,
  updateChildLink,
  updateIndividual,
  updateUnion,
} from "@/lib/genogramma/model/commands";
import { createIndividual, uuid } from "@/lib/genogramma/model/create";
import {
  canAddParents,
  detectConsanguinity,
  getRelationToProband,
  homeEntry,
  unknownFields,
  unionsOf,
} from "@/lib/genogramma/model/queries";
import { orderChildren } from "@/lib/genogramma/model/sibling-order";
import type {
  ArtDetails,
  ConditionStatus,
  EvaluationResult,
  Gender,
  Id,
  Individual,
  Pedigree,
  PregnancyOutcome,
  Sex,
  VitalStatus,
} from "@/lib/genogramma/model/types";
import { cn } from "@/lib/utils";
import type { GenogramStore } from "./use-genogram-store";
import { AgeInput, DateInput, FieldRow, Section, Segmented, Select, TextInput, Toggle } from "./fields";
import { ConditionPicker } from "./condition-picker";
import { GENDER_OPTIONS, PREGNANCY_OPTIONS, SEX_OPTIONS } from "./options";
import type { QuickAdd } from "./genogram-canvas";
import { Swatch } from "./legend-editor";

export function personName(p: Pedigree, id: Id, numbering?: Record<Id, string>): string {
  const ind = p.individuals[id];
  if (!ind) return "?";
  const rel = getRelationToProband(p, id);
  const num = numbering?.[id];
  return [ind.label ?? ind.name, rel, num].filter(Boolean).join(" · ") || "Familiare";
}

type Upd = (patch: Partial<Omit<Individual, "id">> | ((i: Individual) => Individual)) => void;

/** Interruttore compatto per i segni NSGC (probando, consultando, *, ?). */
function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400"
      )}
    >
      {children}
    </button>
  );
}

/** Gruppo con titolo piccolo: separa le sezioni senza appesantire. */
function Group({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-neutral-200 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const STATUS_SEGMENTS: { value: "" | ConditionStatus; label: string; title: string }[] = [
  { value: "", label: "—", title: "Non presente" },
  { value: "affected", label: "Affetto", title: "Clinicamente sintomatico" },
  { value: "carrier", label: "Portatore", title: "Portatore non affetto (recessiva)" },
  { value: "presymptomatic", label: "Presint.", title: "Portatore asintomatico o presintomatico" },
];

/**
 * Pannello del familiare selezionato (laterale su desktop, foglio dal basso
 * su mobile). In alto ciò che serve in consulenza genetica: sesso, stato,
 * età, segni NSGC, condizioni, test. Il resto in "Altre opzioni".
 */
export function MemberPanel({
  store,
  id,
  numbering,
  onQuickAdd,
  onDelete,
  onClose,
  onManageConditions,
  simple = false,
}: {
  store: GenogramStore;
  id: Id;
  numbering: Record<Id, string>;
  onQuickAdd: (kind: QuickAdd, id: Id) => void;
  onDelete: (id: Id) => void;
  onClose?: () => void;
  onManageConditions?: () => void;
  /** Percorso paziente: solo i campi essenziali. */
  simple?: boolean;
}) {
  const ped = store.pedigree!;
  const ind = ped.individuals[id];
  if (!ind) return null;
  const run = store.run;
  const upd: Upd = (patch) => run((p) => updateIndividual(p, id, patch));
  const parents = canAddParents(ped, id);
  const relation = getRelationToProband(ped, id);
  const missing = unknownFields(ind);
  const fid = (k: string) => `m-${k}`;
  const isProband = ped.proband === id;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-neutral-900">
            {(() => {
              const t = relation || ind.label || "Familiare";
              return t.charAt(0).toUpperCase() + t.slice(1);
            })()}
            <span className="ml-2 text-sm font-normal text-neutral-500">{numbering[id] ?? ""}</span>
          </h2>
          {missing.length || ind.placeholder ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {ind.placeholder ? <Badge>Segnaposto</Badge> : null}
              {missing.map((m) => (
                <Badge key={m} tone="warning">
                  Da completare: {m}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Chiudi il pannello" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-4 gap-1.5 pb-3" role="group" aria-label="Aggiungi un familiare">
          {(
            [
              ["parents", "Genitori", Users, !parents.allowed],
              ["sibling", "Fratello", UserPlus, false],
              ["child", "Figlio", Baby, false],
              ["partner", "Partner", HeartHandshake, false],
            ] as const
          ).map(([kind, label, Icon, disabled]) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              title={disabled ? `Genitori: ${parents.reason}` : `Aggiungi ${label.toLowerCase()}`}
              onClick={() => onQuickAdd(kind, id)}
              className="flex flex-col items-center gap-1 rounded-md border border-neutral-200 bg-white px-1 py-2 text-xs text-neutral-700 hover:border-brand-600 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />+ {label}
            </button>
          ))}
        </div>

        <Group title="Persona">
          <Segmented
            label="Sesso"
            value={ind.sex === "unassigned" ? undefined : ind.sex}
            onChange={(v) => upd({ sex: v as Sex })}
            options={[
              { value: "male", label: "Maschio" },
              { value: "female", label: "Femmina" },
              { value: "unknown", label: "Non noto" },
            ]}
          />
          <Segmented
            label="Stato in vita"
            value={ind.vital}
            onChange={(v) => upd({ vital: v as VitalStatus })}
            options={[
              { value: "alive", label: "In vita" },
              { value: "deceased", label: "Deceduto" },
              { value: "unknown", label: "Non so" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Anno di nascita" htmlFor={fid("birth")}>
              <DateInput id={fid("birth")} value={ind.birth} onCommit={(v) => upd({ birth: v })} />
            </FieldRow>
            <FieldRow label="Iniziali" htmlFor={fid("label")}>
              <TextInput id={fid("label")} value={ind.label} onCommit={(v) => upd({ label: v })} maxLength={40} />
            </FieldRow>
          </div>
          {ind.vital !== "deceased" ? (
            ind.birth === undefined || ind.birth === "unknown" ? (
              <FieldRow label="Età" htmlFor={fid("age")}>
                <AgeInput id={fid("age")} value={ind.age} onCommit={(v) => upd({ age: v })} />
              </FieldRow>
            ) : null
          ) : (
            <div className="space-y-2 rounded-md bg-neutral-50 p-2.5">
              <FieldRow label="Età al decesso" htmlFor={fid("dage")}>
                <AgeInput id={fid("dage")} value={ind.death?.age} onCommit={(v) => upd((i) => ({ ...i, death: { ...i.death, age: v } }))} />
              </FieldRow>
              <div className="grid grid-cols-2 gap-2">
                <FieldRow label="Anno del decesso" htmlFor={fid("ddate")}>
                  <DateInput id={fid("ddate")} value={ind.death?.date} onCommit={(v) => upd((i) => ({ ...i, death: { ...i.death, date: v } }))} />
                </FieldRow>
                <FieldRow label="Causa" htmlFor={fid("dcause")}>
                  <TextInput id={fid("dcause")} value={ind.death?.cause} onCommit={(v) => upd((i) => ({ ...i, death: { ...i.death, cause: v } }))} />
                </FieldRow>
              </div>
            </div>
          )}
          {!simple ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Segni NSGC">
              <Chip active={isProband} onClick={() => !isProband && run((p) => setProband(p, id))} title="Familiare affetto che arriva all'attenzione medica (freccia con P)">
                <Star className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Probando
              </Chip>
              <Chip active={ped.consultands.includes(id)} onClick={() => run((p) => toggleConsultand(p, id))} title="Chi chiede la consulenza (freccia senza P)">
                Consultando
              </Chip>
              <Chip active={!!ind.documentedEvaluation} onClick={() => upd({ documentedEvaluation: !ind.documentedEvaluation || undefined })} title="Valutazione fatta o verificata dal proprio team (*)">
                Valutato dal team *
              </Chip>
              <Chip active={!!ind.familyHistoryUnknown} onClick={() => upd({ familyHistoryUnknown: !ind.familyHistoryUnknown || undefined })} title="Storia familiare non nota (?)">
                Storia non nota ?
              </Chip>
            </div>
          ) : null}
        </Group>

        <Group
          title="Condizioni"
          action={
            onManageConditions ? (
              <button type="button" onClick={onManageConditions} className="inline-flex items-center text-xs text-brand-700 hover:underline">
                Gestisci <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null
          }
        >
          {ped.legend.conditions.map((c) => {
            const cur = ind.conditions.find((x) => x.conditionId === c.id);
            return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Swatch c={c} color={ped.display.color} size={18} />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-800" title={c.label}>
                    {c.label}
                  </span>
                </div>
                <Segmented
                  label={`Stato per ${c.label}`}
                  size="sm"
                  value={cur?.status ?? ""}
                  onChange={(v) => run((p) => setIndividualCondition(p, id, c.id, v ? { ...cur, status: v as ConditionStatus } : null))}
                  options={STATUS_SEGMENTS}
                />
                {cur ? (
                  <FieldRow label="Esordio (età)" htmlFor={fid(`co-${c.id}`)}>
                    <AgeInput id={fid(`co-${c.id}`)} value={cur.onset} onCommit={(v) => run((p) => setIndividualCondition(p, id, c.id, { ...cur, onset: v }))} />
                  </FieldRow>
                ) : null}
              </div>
            );
          })}
          <ConditionPicker
            placeholder="Aggiungi una condizione (es. fibrosi cistica)"
            onAdd={(label, codes) =>
              run((p) => {
                const res = addLegendCondition(p, label, uuid, codes);
                return setIndividualCondition(res.pedigree, id, res.id, { status: "affected" });
              })
            }
          />
          <Toggle id={fid("hu")} label="Non so se ha problemi di salute" checked={!!ind.healthUnknown} onChange={(v) => upd({ healthUnknown: v || undefined })} />
        </Group>

        {!simple ? <TestsGroup store={store} id={id} upd={upd} /> : null}

        <Group title="Note">
          <TextInput id={fid("notes")} value={ind.notes} onCommit={(v) => upd({ notes: v })} multiline maxLength={1000} />
        </Group>

        {!simple ? <MoreOptions store={store} id={id} numbering={numbering} upd={upd} /> : <GenderOptions ind={ind} upd={upd} />}

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
          {simple && !isProband ? (
            <Button size="sm" variant="secondary" onClick={() => run((p) => setProband(p, id))}>
              <Star className="h-4 w-4" aria-hidden="true" /> Imposta come probando
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => onDelete(id)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Elimina familiare
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Identità di genere e sesso assegnato: predefiniti allineati, modificabili qui. */
function GenderOptions({ ind, upd }: { ind: Individual; upd: Upd }) {
  return (
    <Section title="Altre opzioni" defaultOpen={false}>
      <GenderFields ind={ind} upd={upd} />
    </Section>
  );
}

function GenderFields({ ind, upd }: { ind: Individual; upd: Upd }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <FieldRow label="Identità di genere" htmlFor="m-gender" hint="Predefinita: come il sesso assegnato.">
        <Select id="m-gender" value={ind.gender} onChange={(v) => upd({ gender: v as Gender })} options={GENDER_OPTIONS} />
      </FieldRow>
      <FieldRow label="Sesso assegnato alla nascita" htmlFor="m-sex-full">
        <Select id="m-sex-full" value={ind.sex} onChange={(v) => upd({ sex: v as Sex })} options={SEX_OPTIONS} />
      </FieldRow>
    </div>
  );
}

function TestsGroup({ store, id, upd }: { store: GenogramStore; id: Id; upd: Upd }) {
  const ped = store.pedigree!;
  const ind = ped.individuals[id];
  const fid = (k: string) => `t-${k}`;
  return (
    <Group
      title="Test e valutazioni"
      action={
        <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => upd((x) => ({ ...x, evaluations: [...x.evaluations, { result: "u" }] }))}>
          + Aggiungi
        </button>
      }
    >
      {ind.evaluations.length === 0 ? <p className="text-xs text-neutral-500">Nessun test. Notazione NSGC: E+, E−, Eu.</p> : null}
      {ind.evaluations.map((ev, i) => (
        <div key={i} className="space-y-1.5 rounded-md bg-neutral-50 p-2">
          <div className="flex items-center gap-2">
            {ped.legend.evaluations.length > 0 ? (
              <div className="min-w-0 flex-1">
                <Select
                  id={fid(`et-${i}`)}
                  label="Tipo di valutazione"
                  value={ev.evaluationId ?? ""}
                  onChange={(v) => upd((x) => ({ ...x, evaluations: x.evaluations.map((e, k) => (k === i ? { ...e, evaluationId: v || undefined } : e)) }))}
                  options={[{ value: "", label: "Generica (E)" }, ...ped.legend.evaluations.map((e, k) => ({ value: e.id, label: `E${k + 1} ${e.label}` }))]}
                />
              </div>
            ) : (
              <span className="flex-1 text-sm text-neutral-700">Valutazione {i + 1}</span>
            )}
            <button
              type="button"
              aria-label="Rimuovi la valutazione"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-neutral-500 hover:bg-neutral-200"
              onClick={() => upd((x) => ({ ...x, evaluations: x.evaluations.filter((_, k) => k !== i) }))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Segmented
            label="Esito"
            size="sm"
            value={ev.result}
            onChange={(v) => upd((x) => ({ ...x, evaluations: x.evaluations.map((e, k) => (k === i ? { ...e, result: v as EvaluationResult } : e)) }))}
            options={[
              { value: "+", label: "+ positivo" },
              { value: "-", label: "− negativo" },
              { value: "u", label: "u non inform." },
            ]}
          />
          <TextInput
            id={fid(`ed-${i}`)}
            value={ev.detail ?? [ev.variant, ev.gene].filter(Boolean).join(" ")}
            onCommit={(v) => upd((x) => ({ ...x, evaluations: x.evaluations.map((e, k) => (k === i ? { ...e, detail: v } : e)) }))}
            placeholder="Dettaglio: variante e gene, metodo (es. 5385insC BRCA1)"
            maxLength={120}
          />
        </div>
      ))}
    </Group>
  );
}

/** Opzioni meno frequenti, raggruppate per argomento e chiuse di default. */
function MoreOptions({ store, id, numbering, upd }: { store: GenogramStore; id: Id; numbering: Record<Id, string>; upd: Upd }) {
  const ped = store.pedigree!;
  const ind = ped.individuals[id];
  const run = store.run;
  const fid = (k: string) => `a-${k}`;
  const home = homeEntry(ped, id);
  const siblings = home ? orderChildren(ped, home.union).filter((c) => c !== id) : [];
  const twinMates = ind.twin ? Object.values(ped.individuals).filter((x) => x.twin?.groupId === ind.twin!.groupId && x.id !== id) : [];
  const name = (x: Id) => personName(ped, x, numbering);
  const others = Object.keys(ped.individuals).filter((x) => x !== id);
  const preg = ind.pregnancy;

  const setPreg = (outcome: string) =>
    upd((i) => {
      const copy = { ...i };
      if (!outcome) delete copy.pregnancy;
      else copy.pregnancy = { ...i.pregnancy, outcome: outcome as PregnancyOutcome };
      if (outcome && outcome !== "ongoing") copy.vital = "deceased";
      return copy;
    });

  const artPick = (role: keyof ArtDetails, value: string) => {
    if (!home) return;
    run((p) => {
      let next = p;
      let target: Id | undefined = value || undefined;
      if (value === "@new") {
        const nid = uuid();
        const fields: Partial<Individual> = role === "spermFrom" ? { sex: "male", gender: "man" } : { sex: "female", gender: "woman" };
        next = { ...next, individuals: { ...next.individuals, [nid]: createIndividual(nid, fields) } };
        target = nid;
      }
      const link = next.unions[home.union.id].children.find((c) => c.id === id)!;
      return updateChildLink(next, home.union.id, id, { link: "art", art: { ...link.art, [role]: target } });
    });
  };

  return (
    <Section title="Altre opzioni" defaultOpen={false}>
      <Sub title="Genere, cariotipo, origine">
        <GenderFields ind={ind} upd={upd} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FieldRow label="Cariotipo" htmlFor={fid("kar")}>
            <TextInput id={fid("kar")} value={ind.karyotype} onCommit={(v) => upd({ karyotype: v })} placeholder="es. 46,XY" maxLength={60} />
          </FieldRow>
          <FieldRow label="Origine / ancestry" htmlFor={fid("pop")}>
            <TextInput id={fid("pop")} value={ind.populationDescriptors} onCommit={(v) => upd({ populationDescriptors: v })} maxLength={120} />
          </FieldRow>
        </div>
      </Sub>

      <Sub title="Gravidanza o esito">
        <Select id={fid("preg")} label="Gravidanza o esito" value={preg?.outcome ?? ""} onChange={setPreg} options={PREGNANCY_OPTIONS} />
        {preg ? (
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Settimane" htmlFor={fid("gw")}>
              <TextInput
                id={fid("gw")}
                value={preg.gestationalWeeks !== undefined ? String(preg.gestationalWeeks) : undefined}
                onCommit={(v) => {
                  const n = v ? Number(v) : undefined;
                  if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 45)) return;
                  upd((i) => ({ ...i, pregnancy: { ...i.pregnancy!, gestationalWeeks: n } }));
                }}
                maxLength={4}
              />
            </FieldRow>
            <FieldRow label="Risultato" htmlFor={fid("pres")}>
              <TextInput id={fid("pres")} value={preg.result} onCommit={(v) => upd((i) => ({ ...i, pregnancy: { ...i.pregnancy!, result: v } }))} placeholder="46,XY" maxLength={60} />
            </FieldRow>
            <FieldRow label="Metodo" htmlFor={fid("pmet")}>
              <TextInput id={fid("pmet")} value={preg.method} onCommit={(v) => upd((i) => ({ ...i, pregnancy: { ...i.pregnancy!, method: v } }))} placeholder="Amnio, CVS" maxLength={40} />
            </FieldRow>
          </div>
        ) : null}
      </Sub>

      {home && siblings.length > 0 ? (
        <Sub title="Gemelli">
          <Select
            id={fid("twin")}
            label="Gemello di"
            value={twinMates[0]?.id ?? ""}
            onChange={(v) =>
              run((p) => {
                let next = clearTwin(p, id);
                const group = Object.values(next.individuals).filter((x) => x.twin && p.individuals[id].twin && x.twin.groupId === p.individuals[id].twin!.groupId);
                if (group.length === 1) next = clearTwin(next, group[0].id);
                if (!v) return next;
                return setTwins(next, [v, id], next.individuals[v].twin?.zygosity ?? "unknown", uuid);
              })
            }
            options={[{ value: "", label: "Non è un gemello" }, ...siblings.map((x) => ({ value: x, label: `Gemello di ${name(x)}` }))]}
          />
          {ind.twin ? (
            <>
              <Segmented
                label="Zigosità"
                size="sm"
                value={ind.twin.zygosity}
                onChange={(v) => run((p) => setTwins(p, [id, ...twinMates.map((x) => x.id)], v as "MZ", uuid, ind.twin!.proven))}
                options={[
                  { value: "MZ", label: "Monozigoti" },
                  { value: "DZ", label: "Dizigoti" },
                  { value: "unknown", label: "Non nota (?)" },
                ]}
              />
              <Toggle id={fid("prov")} label="Zigosità provata da test (*)" checked={!!ind.twin.proven} onChange={(v) => run((p) => setTwins(p, [id, ...twinMates.map((x) => x.id)], ind.twin!.zygosity, uuid, v))} />
            </>
          ) : null}
        </Sub>
      ) : null}

      {home ? (
        <Sub title="Legame con i genitori (adozione, PMA)">
          <Select
            id={fid("link")}
            label="Tipo di legame"
            value={home.link.link}
            onChange={(v) => run((p) => updateChildLink(p, home.union.id, id, { link: v as "biological" }))}
            options={[
              { value: "biological", label: "Biologico" },
              { value: "adoptive", label: "Adottato dentro (genitori adottivi)" },
              { value: "foster", label: "In affido" },
              { value: "art", label: "Procreazione assistita" },
            ]}
          />
          {home.link.link === "biological" ? (
            <Toggle id={fid("out")} label="Dato in adozione (adottato fuori)" checked={!!home.link.adoptedOut} onChange={(v) => run((p) => updateChildLink(p, home.union.id, id, { adoptedOut: v || undefined }))} />
          ) : null}
          {home.link.link === "art"
            ? (
                [
                  ["eggFrom", "Ovocita da"],
                  ["spermFrom", "Seme da"],
                  ["carriedBy", "Gravidanza portata da"],
                ] as const
              ).map(([role, label]) => (
                <FieldRow key={role} label={label} htmlFor={fid(role)}>
                  <Select
                    id={fid(role)}
                    value={home.link.art?.[role] ?? ""}
                    onChange={(v) => artPick(role, v)}
                    options={[
                      { value: "", label: "Non indicato" },
                      ...others.map((x) => ({ value: x, label: name(x) })),
                      { value: "@new", label: role === "carriedBy" ? "Nuova gestante (G)" : "Nuovo donatore (D)" },
                    ]}
                  />
                </FieldRow>
              ))
            : null}
        </Sub>
      ) : null}

      <UnionsEditor store={store} id={id} numbering={numbering} />

      <Sub title="Fratria, individui multipli, figli">
        <FieldRow label="Posizione nella fratria" htmlFor={fid("bo")} hint="Vuoto = ordine per età. Puoi anche trascinare il simbolo.">
          <TextInput
            id={fid("bo")}
            value={ind.birthOrder !== undefined ? String(ind.birthOrder) : undefined}
            onCommit={(v) => {
              const n = v ? Math.round(Number(v)) : undefined;
              if (n !== undefined && (!Number.isFinite(n) || n < 1 || n > 99)) return;
              upd({ birthOrder: n });
            }}
            maxLength={2}
          />
        </FieldRow>
        {home && home.union.childOrder === "manual" ? (
          <Button size="sm" variant="secondary" onClick={() => run((p) => resetChildOrder(p, home.union.id))}>
            Ripristina l&apos;ordine per età
          </Button>
        ) : null}
        <FieldRow label="Più individui in un simbolo" htmlFor={fid("mult")}>
          <div className="flex flex-wrap gap-2">
            <Select
              id={fid("mult")}
              value={ind.multiple === undefined ? "" : String(ind.multiple)}
              onChange={(v) =>
                upd((x) => {
                  const copy = { ...x };
                  if (!v) delete copy.multiple;
                  else copy.multiple = v === "n" ? "n" : Number(v);
                  return copy;
                })
              }
              options={[{ value: "", label: "No" }, { value: "n", label: "n (numero ignoto)" }, ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => ({ value: String(k), label: String(k) }))]}
            />
            {typeof ind.multiple === "number" ? (
              <Button size="sm" variant="secondary" onClick={() => run((p) => expandMultiple(p, id, uuid))}>
                Espandi in {ind.multiple}
              </Button>
            ) : null}
          </div>
        </FieldRow>
        <FieldRow label="Nessun figlio (senza partner)" htmlFor={fid("nc")}>
          <div className="flex flex-wrap gap-2">
            <Select
              id={fid("nc")}
              value={ind.noChildren?.kind ?? ""}
              onChange={(v) =>
                upd((x) => {
                  const copy = { ...x };
                  if (!v) delete copy.noChildren;
                  else copy.noChildren = { ...x.noChildren, kind: v as "by-choice" };
                  return copy;
                })
              }
              options={[
                { value: "", label: "—" },
                { value: "by-choice", label: "Per scelta o motivo ignoto" },
                { value: "infertility", label: "Infertilità" },
              ]}
            />
            {ind.noChildren ? <TextInput id={fid("ncr")} value={ind.noChildren.reason} onCommit={(v) => upd((x) => ({ ...x, noChildren: { ...x.noChildren!, reason: v } }))} placeholder="Motivo" maxLength={80} /> : null}
          </div>
        </FieldRow>
      </Sub>

      <Sub title="Nome completo">
        <TextInput id={fid("name")} value={ind.name} onCommit={(v) => upd({ name: v })} maxLength={120} />
        <p className="text-xs text-neutral-500">Identifica la persona: inseriscilo solo se serve. Prima di un export con nomi comparirà un avviso.</p>
      </Sub>
    </Section>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-md border border-neutral-200 p-2.5">
      <p className="text-xs font-semibold text-neutral-700">{title}</p>
      {children}
    </div>
  );
}

function UnionsEditor({ store, id, numbering }: { store: GenogramStore; id: Id; numbering: Record<Id, string> }) {
  const ped = store.pedigree!;
  const unions = unionsOf(ped, id).filter((u) => u.partners.length === 2);
  if (unions.length === 0) return null;
  return (
    <Sub title="Relazioni di coppia">
      {unions.map((u) => {
        const other = u.partners.find((p) => p !== id)!;
        const cons = detectConsanguinity(ped, u.partners[0], u.partners[1]);
        const fid = (k: string) => `u-${u.id}-${k}`;
        return (
          <div key={u.id} className="space-y-2 border-t border-neutral-100 pt-2 first:border-0 first:pt-0">
            <p className="text-sm text-neutral-800">Con {personName(ped, other, numbering)}</p>
            <Segmented
              label="Stato della relazione"
              size="sm"
              value={u.status}
              onChange={(v) => store.run((p) => updateUnion(p, u.id, { status: v as "current" }))}
              options={[
                { value: "current", label: "In corso" },
                { value: "ended", label: "Terminata //" },
              ]}
            />
            {cons.related && !u.consanguinity ? (
              <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                I partner risultano imparentati: {cons.label}.{" "}
                <button type="button" className="font-medium underline" onClick={() => store.run((p) => updateUnion(p, u.id, { consanguinity: { degree: cons.label } }))}>
                  Segna come consanguinei
                </button>
              </div>
            ) : null}
            <Toggle
              id={fid("cons")}
              label="Consanguinei (linea doppia)"
              checked={!!u.consanguinity}
              onChange={(v) => store.run((p) => updateUnion(p, u.id, { consanguinity: v ? { degree: cons.label } : undefined }))}
            />
            {u.consanguinity ? (
              <TextInput id={fid("deg")} value={u.consanguinity.degree} onCommit={(v) => store.run((p) => updateUnion(p, u.id, { consanguinity: { degree: v } }))} placeholder="Grado scritto sopra la linea" maxLength={60} />
            ) : null}
            {u.children.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                <Select
                  id={fid("nc")}
                  label="Nessun figlio"
                  value={u.noChildren?.kind ?? ""}
                  onChange={(v) => store.run((p) => updateUnion(p, u.id, { noChildren: v ? { ...u.noChildren, kind: v as "by-choice" } : undefined }))}
                  options={[
                    { value: "", label: "Nessuna indicazione sui figli" },
                    { value: "by-choice", label: "Nessun figlio per scelta" },
                    { value: "infertility", label: "Infertilità" },
                  ]}
                />
                {u.noChildren ? (
                  <TextInput id={fid("ncr")} value={u.noChildren.reason} onCommit={(v) => store.run((p) => updateUnion(p, u.id, { noChildren: { ...u.noChildren!, reason: v } }))} placeholder="Motivo (es. vasectomia)" maxLength={80} />
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="text-xs text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
              onClick={() =>
                store.run((p) => {
                  const cur = p.unions[u.id].partnerOrder ?? p.unions[u.id].partners;
                  return updateUnion(p, u.id, { partnerOrder: [...cur].reverse() });
                })
              }
            >
              Scambia sinistra e destra nella coppia
            </button>
          </div>
        );
      })}
    </Sub>
  );
}
