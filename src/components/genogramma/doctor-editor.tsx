"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { uuid } from "@/lib/genogramma/model/create";
import type { Pedigree } from "@/lib/genogramma/model/types";
import { getStorage, takeOpenRequest } from "@/lib/genogramma/storage/indexeddb";
import { draftTitle } from "@/lib/genogramma/storage/title";
import { DoctorWizard } from "./doctor-wizard";
import { ExportButton } from "./export/export-button";
import { ImportButton } from "./export/import-button";
import { GenogramEditor } from "./genogram-editor";
import { PrivacyBar } from "./privacy-bar";
import { useGenogramStore } from "./use-genogram-store";
import { useLocalDraft } from "./use-local-draft";

/**
 * Percorso medico: wizard iniziale, poi editor completo. Tutto lo stato
 * resta nel browser (memoria e bozza locale); l'account serve solo ad
 * aprire questa pagina.
 */
export function DoctorEditor() {
  const store = useGenogramStore(null);
  const draft = useLocalDraft();
  const [confirmNew, setConfirmNew] = useState(false);
  const { load } = store;
  const { adopt, save } = draft;

  // Bozza scelta nella schermata iniziale (ID in sessionStorage, mai nell'URL).
  useEffect(() => {
    const id = takeOpenRequest();
    if (!id) return;
    getStorage()
      .then((s) => s.get(id))
      .then((d) => {
        if (d?.pedigree) {
          adopt(d);
          load(d.pedigree);
        }
      })
      .catch(() => undefined);
  }, [adopt, load]);

  useEffect(() => {
    const p = store.pedigree;
    if (p) save({ id: p.id, kind: "pedigree", view: "doctor", title: draftTitle(p), updatedAt: new Date().toISOString(), pedigree: p });
  }, [store.pedigree, save]);

  // Un file importato diventa una bozza nuova: non sovrascrive quelle salvate.
  const openImported = (p: Pedigree) => load({ ...p, id: uuid() });

  if (!store.pedigree) {
    return (
      <>
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pt-6 sm:px-6">
          <PrivacyBar draft={draft} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-600">Hai già un file (ad esempio dal paziente)?</p>
            <ImportButton onImport={openImported} hasCurrent={false} label="Apri un file" variant="secondary" />
          </div>
        </div>
        <DoctorWizard onCreate={(p) => load(p)} />
      </>
    );
  }
  return (
    <>
      <GenogramEditor
        store={store}
        className="h-[calc(100dvh-3rem)]"
        onNew={() => setConfirmNew(true)}
        toolbarExtra={
          <>
            <ExportButton pedigree={store.pedigree} doctor />
            <ImportButton onImport={openImported} hasCurrent />
          </>
        }
        bottomBar={<PrivacyBar draft={draft} compact onReload={(d) => d.pedigree && load(d.pedigree)} />}
      />
      <Dialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        title="Nuovo genogramma"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmNew(false)}>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmNew(false);
                load(null);
              }}
            >
              Nuovo
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Il genogramma aperto resta tra le bozze di questo browser (se il salvataggio è attivo) e potrai riaprirlo dalla
          pagina iniziale.
        </p>
      </Dialog>
    </>
  );
}
