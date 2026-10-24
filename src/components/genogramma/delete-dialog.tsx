"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { planRemoval, removeIndividual, replaceWithPlaceholder } from "@/lib/genogramma/model/commands";
import type { Id } from "@/lib/genogramma/model/types";
import { personName } from "./member-panel";
import { Toggle } from "./fields";
import type { GenogramStore } from "./use-genogram-store";

/**
 * Eliminazione con regole esplicite: il probando non si elimina senza
 * sceglierne un altro; se il genogramma si dividerebbe (individuo "ponte")
 * si propone un segnaposto ignoto; i discendenti si possono tenere.
 */
export function DeleteDialog({ store, id, numbering, onClose }: { store: GenogramStore; id: Id; numbering: Record<Id, string>; onClose: () => void }) {
  const ped = store.pedigree!;
  const [withDesc, setWithDesc] = useState(false);
  const plan = planRemoval(ped, id, withDesc);
  const extra = plan.ids.filter((x) => x !== id && !plan.descendants.includes(x));

  const doDelete = () => {
    if (store.run((p) => removeIndividual(p, id, withDesc), { select: null })) onClose();
  };
  const doPlaceholder = () => {
    if (store.run((p) => replaceWithPlaceholder(p, id))) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Elimina familiare"
      description={personName(ped, id, numbering)}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          {!plan.blocked ? (
            <Button variant="secondary" onClick={doPlaceholder}>
              Sostituisci con segnaposto
            </Button>
          ) : null}
          {!plan.blocked && !plan.disconnects ? (
            <Button variant="danger" onClick={doDelete}>
              Elimina
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-3 text-sm text-neutral-700">
        {plan.blocked ? (
          <p>{plan.blocked}</p>
        ) : (
          <>
            {plan.descendants.length > 0 ? (
              <Toggle
                id="del-desc"
                label={`Elimina anche i discendenti (${plan.descendants.length})`}
                checked={withDesc}
                onChange={setWithDesc}
              />
            ) : null}
            {extra.length > 0 ? (
              <p>
                Verranno eliminati anche i partner che resterebbero isolati:{" "}
                {extra.map((x) => personName(ped, x, numbering)).join(", ")}.
              </p>
            ) : null}
            {plan.disconnects ? (
              <p>
                Questo familiare collega due parti del genogramma: eliminarlo le separerebbe. Puoi sostituirlo con un
                segnaposto ignoto, che mantiene i legami senza dati.
              </p>
            ) : (
              <p>L&apos;operazione si può annullare con Ctrl+Z.</p>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
