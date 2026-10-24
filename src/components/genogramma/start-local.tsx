"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DraftMeta, StorageAdapter } from "@/lib/genogramma/storage/adapter";
import { getStorage, requestOpen } from "@/lib/genogramma/storage/indexeddb";
import { uuid } from "@/lib/genogramma/model/create";
import type { Pedigree } from "@/lib/genogramma/model/types";
import { ImportButton } from "./export/import-button";
import { PrivacyBar } from "./privacy-bar";

/**
 * Riapertura dalla schermata iniziale: bozze salvate in questo browser e
 * import di un file. Nessun login: ogni bozza si riapre dove è nata, e un
 * genogramma del paziente si può aprire anche nell'editor clinico.
 */
export function StartLocal() {
  const [drafts, setDrafts] = useState<DraftMeta[] | null>(null);
  const [storage, setStorage] = useState<StorageAdapter | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getStorage()
      .then(async (s) => {
        const list = await s.list();
        if (alive) {
          setStorage(s);
          setDrafts(list);
        }
      })
      .catch(() => alive && setDrafts([]));
    return () => {
      alive = false;
    };
  }, []);

  const MEDICO = "/medico";
  const PAZIENTE = "/paziente";
  const viewOf = (d: DraftMeta) => d.view ?? (d.kind === "patient" ? "patient" : "doctor");

  const open = (d: DraftMeta, where?: "doctor" | "patient") => {
    requestOpen(d.id);
    // Navigazione completa voluta: la pagina di destinazione riparte pulita e legge la bozza.
    window.location.assign((where ?? viewOf(d)) === "doctor" ? MEDICO : PAZIENTE);
  };

  const openFile = async (p: Pedigree) => {
    if (!storage) return;
    const id = uuid();
    await storage.put({ id, kind: "pedigree", view: "doctor", title: "File importato", updatedAt: new Date().toISOString(), pedigree: { ...p, id } }, null);
    if (!storage.persistent) {
      // Senza storage persistente il file non sopravvive al cambio di pagina.
      setNotice("Il salvataggio locale non è attivo: apri il file direttamente dall'editor o dalla vista paziente.");
      return;
    }
    requestOpen(id);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(MEDICO);
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs" aria-labelledby="start-local">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="start-local" className="text-base font-semibold tracking-[-0.01em] text-neutral-900">
          Riprendi un genogramma
        </h2>
        <ImportButton onImport={openFile} hasCurrent={false} label="Apri un file" variant="secondary" />
      </div>
      {notice ? (
        <Alert className="mt-3" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      ) : null}
      {drafts === null ? (
        <p className="mt-3 text-sm text-neutral-500">Lettura delle bozze locali…</p>
      ) : drafts.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nessuna bozza salvata in questo browser.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 border-y border-neutral-100">
          {drafts.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{d.title}</p>
                <p className="text-xs text-neutral-500">
                  {d.kind === "patient" ? "Questionario" : viewOf(d) === "doctor" ? "Editor clinico" : "Percorso paziente"} ·{" "}
                  {new Date(d.updatedAt).toLocaleString("it-IT")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="secondary" onClick={() => open(d)}>
                  <FolderOpen className="h-4 w-4" aria-hidden="true" /> Riapri
                </Button>
                {d.kind === "pedigree" && viewOf(d) === "patient" ? (
                  <Button size="sm" variant="ghost" onClick={() => open(d, "doctor")} title="Apri nell'editor clinico completo">
                    Editor clinico
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Elimina la bozza ${d.title}`}
                  onClick={async () => {
                    await storage?.remove(d.id);
                    setDrafts((list) => list?.filter((x) => x.id !== d.id) ?? []);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-neutral-100 pt-4">
        <PrivacyBar />
      </div>
    </section>
  );
}
