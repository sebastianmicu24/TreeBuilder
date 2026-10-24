"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { addChild, addParents, addPartner, addSibling, setIndividualCondition, setTwins, type NewIndividual } from "@/lib/genogramma/model/commands";
import { uuid } from "@/lib/genogramma/model/create";
import { canAddParents, getParents, isFemaleLike, isMaleLike, partnersOf } from "@/lib/genogramma/model/queries";
import type { Age, DateValue, Gender, Id, Pedigree, PregnancyOutcome, Sex, VitalStatus } from "@/lib/genogramma/model/types";
import { cn } from "@/lib/utils";
import { AgeInput, DateInput, FieldRow, Select, Toggle } from "./fields";
import type { QuickAdd } from "./genogram-canvas";
import { personName } from "./member-panel";
import { PREGNANCY_OPTIONS, VITAL_OPTIONS } from "./options";
import type { GenogramStore } from "./use-genogram-store";

const TITLES: Record<QuickAdd, string> = {
  parents: "Aggiungi genitori",
  sibling: "Aggiungi fratello o sorella",
  child: "Aggiungi figlio o figlia",
  partner: "Aggiungi partner",
};

type Kind = "man" | "woman" | "unknown";

function sexGender(kind: Kind, child: boolean): { sex: Sex; gender: Gender } {
  if (kind === "man") return { sex: "male", gender: child ? "not-expressed" : "man" };
  if (kind === "woman") return { sex: "female", gender: child ? "not-expressed" : "woman" };
  return { sex: "unknown", gender: "unknown" };
}

/**
 * Mini-modulo per un nuovo familiare: sesso/genere, età, stato vitale,
 * condizioni; per i figli la scelta del partner (esistente, nuovo, ignoto);
 * in più gemellarità ed esiti di gravidanza nella sezione avanzata.
 */
export function AddRelativeDialog({
  store,
  kind,
  target,
  numbering,
  onClose,
}: {
  store: GenogramStore;
  kind: QuickAdd;
  target: Id;
  numbering: Record<Id, string>;
  onClose: () => void;
}) {
  const ped = store.pedigree as Pedigree;
  const isChild = kind === "child" || kind === "sibling";
  const partners = partnersOf(ped, target);
  const t = ped.individuals[target];
  const defaultKind: Kind =
    kind === "partner" ? (isMaleLike(t) ? "woman" : isFemaleLike(t) ? "man" : "unknown") : "unknown";
  const [who, setWho] = useState<Kind>(defaultKind);
  const [birth, setBirth] = useState<DateValue | undefined>();
  const [age, setAge] = useState<Age | undefined>();
  const [vital, setVital] = useState<VitalStatus>("alive");
  const [conds, setConds] = useState<string[]>([]);
  const [partner, setPartner] = useState<string>(partners[0] ?? "new");
  const [half, setHalf] = useState<string>("full");
  const [twin, setTwin] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const parentsInfo = canAddParents(ped, target);
  const bioParents = getParents(ped, target).biological;

  const confirm = () => {
    const fields: NewIndividual = { ...sexGender(who, isChild), vital: outcome && outcome !== "ongoing" ? "deceased" : vital };
    if (birth !== undefined) fields.birth = birth;
    if (age !== undefined) fields.age = age;
    if (outcome) fields.pregnancy = { outcome: outcome as PregnancyOutcome };
    const ok = store.run(
      (p) => {
        let res;
        if (kind === "parents") res = addParents(p, target, uuid);
        else if (kind === "partner") res = addPartner(p, target, fields, uuid);
        else if (kind === "child") {
          res = addChild(p, target, fields, uuid, { partner: partner === "new" ? "new" : partner === "none" ? "none" : partner });
        } else if (half !== "full" && bioParents.includes(half)) {
          // Mezzo fratello: figlio dello stesso genitore con un altro partner.
          res = addChild(p, half, fields, uuid, { partner: "new" });
        } else {
          res = addSibling(p, target, fields, uuid);
        }
        let next = res.pedigree;
        const newId = res.created[res.created.length - 1];
        if (kind !== "parents") {
          for (const c of conds) next = setIndividualCondition(next, newId, c, { status: "affected" });
          if (kind === "sibling" && twin) next = setTwins(next, [target, newId], twin as "MZ", uuid);
        }
        return { pedigree: next, created: res.created };
      },
      { select: "created" }
    );
    if (ok) onClose();
  };

  const kindBtn = (k: Kind, label: string) => (
    <button
      type="button"
      aria-pressed={who === k}
      onClick={() => setWho(k)}
      className={cn(
        "flex-1 rounded-md border px-3 py-2 text-sm",
        who === k ? "border-brand-600 bg-brand-50 text-neutral-900" : "border-neutral-300 bg-white hover:border-neutral-400"
      )}
    >
      {label}
    </button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={TITLES[kind]}
      description={`Per ${personName(ped, target, numbering)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={confirm} disabled={kind === "parents" && !parentsInfo.allowed}>
            Aggiungi
          </Button>
        </>
      }
    >
      {kind === "parents" ? (
        <p className="text-sm text-neutral-700">
          {parentsInfo.allowed
            ? parentsInfo.missing === 1
              ? "È noto un solo genitore: verrà aggiunto quello mancante, nella stessa coppia."
              : "Verranno aggiunti padre e madre biologici. Potrai completare i dati dal pannello."
            : parentsInfo.reason}
        </p>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-neutral-700">Chi è</legend>
            <div className="flex gap-2">
              {kindBtn("man", isChild ? "Maschio" : "Uomo")}
              {kindBtn("woman", isChild ? "Femmina" : "Donna")}
              {kindBtn("unknown", "Non specificato")}
            </div>
            <p className="mt-1 text-xs text-neutral-500">Sesso, genere e altri dettagli si correggono poi dal pannello.</p>
          </fieldset>

          {kind === "child" ? (
            <FieldRow label="Con quale partner" htmlFor="add-partner">
              <Select
                id="add-partner"
                value={partner}
                onChange={setPartner}
                options={[
                  ...partners.map((x) => ({ value: x, label: personName(ped, x, numbering) })),
                  { value: "new", label: "Nuovo partner" },
                  { value: "none", label: "Partner non noto (linea dal solo genitore)" },
                ]}
              />
            </FieldRow>
          ) : null}
          {kind === "sibling" && bioParents.length > 0 ? (
            <FieldRow label="Genitori in comune" htmlFor="add-half">
              <Select
                id="add-half"
                value={half}
                onChange={setHalf}
                options={[
                  { value: "full", label: "Entrambi (fratello pieno)" },
                  ...bioParents.map((p) => ({ value: p, label: `Solo ${personName(ped, p, numbering)} (mezzo fratello)` })),
                ]}
              />
            </FieldRow>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRow label="Anno di nascita" htmlFor="add-birth">
              <DateInput id="add-birth" value={birth} onCommit={setBirth} />
            </FieldRow>
            <FieldRow label="Stato in vita" htmlFor="add-vital">
              <Select id="add-vital" value={vital} onChange={(v) => setVital(v as VitalStatus)} options={VITAL_OPTIONS} />
            </FieldRow>
          </div>
          {birth === undefined ? (
            <FieldRow label="Oppure età" htmlFor="add-age">
              <AgeInput id="add-age" value={age} onCommit={setAge} />
            </FieldRow>
          ) : null}

          {ped.legend.conditions.length > 0 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-neutral-700">Condizioni (affetto)</legend>
              {ped.legend.conditions.map((c) => (
                <Toggle
                  key={c.id}
                  id={`add-c-${c.id}`}
                  label={c.label}
                  checked={conds.includes(c.id)}
                  onChange={(v) => setConds((list) => (v ? [...list, c.id] : list.filter((x) => x !== c.id)))}
                />
              ))}
            </fieldset>
          ) : null}

          {isChild ? (
            <details className="rounded-md border border-neutral-200 p-2.5">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Avanzate</summary>
              <div className="mt-3 space-y-3">
                <FieldRow label="Gravidanza o esito" htmlFor="add-outcome">
                  <Select id="add-outcome" value={outcome} onChange={setOutcome} options={PREGNANCY_OPTIONS} />
                </FieldRow>
                {kind === "sibling" ? (
                  <FieldRow label="Gemello" htmlFor="add-twin">
                    <Select
                      id="add-twin"
                      value={twin}
                      onChange={setTwin}
                      options={[
                        { value: "", label: "No" },
                        { value: "MZ", label: "Sì, monozigoti" },
                        { value: "DZ", label: "Sì, dizigoti" },
                        { value: "unknown", label: "Sì, zigosità non nota" },
                      ]}
                    />
                  </FieldRow>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
