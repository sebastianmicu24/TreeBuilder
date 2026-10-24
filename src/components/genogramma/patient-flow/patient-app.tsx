"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { uuid } from "@/lib/genogramma/model/create";
import { getStorage, takeOpenRequest } from "@/lib/genogramma/storage/indexeddb";
import { draftTitle } from "@/lib/genogramma/storage/title";
import type { PatientAnswers } from "@/lib/genogramma/wizard/patient";
import { ExportDialog } from "../export/export-dialog";
import { GenogramEditor } from "../genogram-editor";
import { PrivacyBar } from "../privacy-bar";
import { useGenogramStore } from "../use-genogram-store";
import { useLocalDraft } from "../use-local-draft";
import { PatientFlow } from "./patient-flow";

/**
 * Percorso paziente pubblico: questionario, poi anteprima del genogramma
 * con correzioni semplici. Nessun account, nessun dato inviato: tutto
 * resta nel browser (memoria e, se attivo, bozza locale in IndexedDB).
 */
export function PatientApp() {
  const store = useGenogramStore(null);
  const draft = useLocalDraft();
  // ID della bozza creato al primo uso (mai durante il render/prerender).
  const idRef = useRef<string | null>(null);
  const draftId = useCallback(() => (idRef.current ??= uuid()), []);
  const [exporting, setExporting] = useState(false);
  const [answers, setAnswers] = useState<PatientAnswers | undefined>();
  const [flowKey, setFlowKey] = useState(0);
  const [confirmBack, setConfirmBack] = useState(false);
  const { load } = store;
  const { adopt, save } = draft;

  // Bozza scelta nella schermata iniziale.
  useEffect(() => {
    const id = takeOpenRequest();
    if (!id) return;
    getStorage()
      .then((s) => s.get(id))
      .then((d) => {
        if (!d) return;
        adopt(d);
        idRef.current = d.id;
        if (d.answers) {
          setAnswers(d.answers);
          setFlowKey((k) => k + 1);
        }
        if (d.pedigree) load(d.pedigree);
      })
      .catch(() => undefined);
  }, [adopt, load]);

  useEffect(() => {
    const p = store.pedigree;
    if (p) {
      const id = draftId();
      save({ id, kind: "pedigree", view: "patient", title: draftTitle(p), updatedAt: new Date().toISOString(), pedigree: { ...p, id }, answers });
    } else if (answers) {
      save({ id: draftId(), kind: "patient", view: "patient", title: "Questionario in corso", updatedAt: new Date().toISOString(), answers });
    }
  }, [store.pedigree, answers, draftId, save]);

  if (!store.pedigree) {
    return (
      <>
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
          <PrivacyBar draft={draft} />
        </div>
        <PatientFlow
          key={flowKey}
          initial={answers}
          onChange={setAnswers}
          onDone={(p, a) => {
            setAnswers(a);
            load({ ...p, id: draftId() });
          }}
        />
      </>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">Il tuo genogramma</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Tocca un familiare per correggere i dati o aggiungere un parente. Alla fine scarica il file da portare al medico.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setConfirmBack(true)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Torna al questionario
        </Button>
      </div>
      <div className="mt-4">
        <PrivacyBar draft={draft} onReload={(d) => d.pedigree && load(d.pedigree)} />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <GenogramEditor store={store} variant="patient" className="h-[70dvh] min-h-[420px]" />
      </div>
      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5" aria-labelledby="pa-export">
        <h2 id="pa-export" className="text-base font-semibold text-neutral-900">
          Da portare al medico
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Scarica il file del genogramma (JSON): il medico lo apre nel suo editor. Puoi anche stampare o salvare in PDF o
          come immagine. Il file si crea sul tuo dispositivo e lo consegni tu.
        </p>
        <div className="mt-3">
          <Button onClick={() => setExporting(true)}>Scarica o stampa</Button>
        </div>
      </section>
      {exporting ? <ExportDialog pedigree={store.pedigree} doctor={false} onClose={() => setExporting(false)} /> : null}
      <Dialog
        open={confirmBack}
        onClose={() => setConfirmBack(false)}
        title="Tornare al questionario?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmBack(false)}>
              Resta qui
            </Button>
            <Button
              onClick={() => {
                setConfirmBack(false);
                setFlowKey((k) => k + 1);
                load(null);
              }}
            >
              Torna alle domande
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Le risposte restano, ma le correzioni fatte sul disegno andranno perse: il genogramma verrà ricreato dalle risposte.
        </p>
      </Dialog>
    </div>
  );
}
