"use client";

import { useState, useSyncExternalStore } from "react";
import { HardDrive, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { isNoSaveMode, setNoSaveMode, wipeLocalData } from "@/lib/genogramma/storage/indexeddb";
import { uuid } from "@/lib/genogramma/model/create";
import type { StoredDraft } from "@/lib/genogramma/storage/adapter";
import type { LocalDraft } from "./use-local-draft";

const noop = () => () => {};

/**
 * Avviso di privacy e controlli dello storage locale: i dati restano su
 * questo dispositivo e browser; modalità senza salvataggio per dispositivi
 * condivisi; cancellazione completa dei dati locali.
 */
export function PrivacyBar({
  draft,
  compact = false,
  onReload,
}: {
  draft?: LocalDraft;
  compact?: boolean;
  /** Versione dell'altra scheda accettata dopo un conflitto. */
  onReload?: (d: StoredDraft) => void;
}) {
  const [confirm, setConfirm] = useState<"wipe" | "nosave" | null>(null);
  // Letto dopo l'idratazione (sul server non c'è localStorage).
  const noSave = useSyncExternalStore(noop, isNoSaveMode, () => false);
  const status =
    noSave
      ? "Senza salvataggio: chiudendo la pagina i dati si perdono."
      : draft?.persistent === false
        ? "Salvataggio non disponibile in questo browser: esporta il file prima di chiudere."
        : "Salvato automaticamente solo su questo dispositivo e browser.";

  const reload = () => window.location.reload();

  return (
    <div className={compact ? "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600" : "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600 ring-1 ring-inset ring-neutral-200/70"}>
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-neutral-500" aria-hidden="true" /> I dati restano su questo dispositivo: il sito non li riceve.
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HardDrive className="h-4 w-4 text-neutral-500" aria-hidden="true" /> {status}
      </span>
      <span className="ml-auto flex flex-wrap gap-1">
        {noSave ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNoSaveMode(false);
              reload();
            }}
          >
            Riattiva il salvataggio
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm("nosave")}>
            Dispositivo condiviso: non salvare
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirm("wipe")}>
          Cancella tutti i dati locali
        </Button>
      </span>
      {confirm ? (
        <Dialog
          open
          onClose={() => setConfirm(null)}
          title={confirm === "wipe" ? "Cancellare tutti i dati locali?" : "Usare lo strumento senza salvare?"}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                Annulla
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await wipeLocalData();
                  if (confirm === "nosave") setNoSaveMode(true);
                  setConfirm(null);
                  reload();
                }}
              >
                {confirm === "wipe" ? "Cancella" : "Cancella e non salvare"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-neutral-700">
            {confirm === "wipe"
              ? "Verranno eliminati da questo browser tutti i genogrammi e le bozze salvati. L'operazione non si può annullare: esporta prima i file che ti servono."
              : "Le bozze già salvate in questo browser verranno cancellate e da ora nulla verrà salvato: chiudendo la pagina i dati si perdono. Adatto a un dispositivo condiviso."}
          </p>
        </Dialog>
      ) : null}
      {draft?.conflict ? <ConflictDialog draft={draft} onReload={onReload} /> : null}
    </div>
  );
}

function ConflictDialog({ draft, onReload }: { draft: LocalDraft; onReload?: (d: StoredDraft) => void }) {
  return (
    <Dialog
      open
      onClose={() => draft.overwrite()}
      title="Modificato in un'altra scheda"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => draft.saveAsCopy(uuid())}>
            Salva come copia
          </Button>
          <Button variant="secondary" onClick={() => draft.overwrite()}>
            Sovrascrivi
          </Button>
          <Button
            onClick={() => {
              const d = draft.reloadFromConflict();
              if (d) onReload?.(d);
            }}
          >
            Ricarica
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-700">
        Questo genogramma è stato salvato da un&apos;altra scheda dopo che l&apos;hai aperto qui. Per non perdere dati scegli:
        ricaricare la versione dell&apos;altra scheda, salvare questa come copia o sovrascrivere.
      </p>
    </Dialog>
  );
}
