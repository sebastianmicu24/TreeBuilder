"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { importAny, MAX_IMPORT_BYTES, type ImportResult } from "@/lib/genogramma/io";
import type { Pedigree } from "@/lib/genogramma/model/types";
import { readFileText } from "./browser-io";

/**
 * Import da file locale (FileReader/Blob): JSON nativo, GA4GH, Phenopackets,
 * CSV, PED, GEDCOM. Errori chiari, nessun crash; se c'è già un genogramma
 * aperto chiede conferma prima di sostituirlo.
 */
export function ImportButton({
  onImport,
  hasCurrent,
  label = "Importa",
  variant = "ghost",
}: {
  onImport: (p: Pedigree) => void;
  hasCurrent: boolean;
  label?: string;
  variant?: "ghost" | "secondary" | "primary";
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setResult({ ok: false, error: "Il file è troppo grande (massimo 5 MB)." });
      return;
    }
    try {
      const text = await readFileText(file);
      setResult(importAny(file.name, text));
    } catch {
      setResult({ ok: false, error: "Impossibile leggere il file." });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const accept = (p: Pedigree) => {
    onImport(p);
    setResult(null);
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,.csv,.tsv,.ped,.fam,.ged,application/json,text/csv,text/plain"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button size="sm" variant={variant} onClick={() => input.current?.click()}>
        <Upload className="h-4 w-4" aria-hidden="true" /> {label}
      </Button>
      {result ? (
        <Dialog
          open
          onClose={() => setResult(null)}
          title={result.ok ? `Importa (${result.format})` : "Import non riuscito"}
          size="sm"
          footer={
            result.ok ? (
              <>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Annulla
                </Button>
                <Button onClick={() => accept(result.pedigree)}>{hasCurrent ? "Sostituisci il genogramma aperto" : "Apri"}</Button>
              </>
            ) : (
              <Button onClick={() => setResult(null)}>Chiudi</Button>
            )
          }
        >
          {result.ok ? (
            <div className="space-y-3 text-sm text-neutral-700">
              <p>{Object.keys(result.pedigree.individuals).length} familiari letti dal file. Il file è stato letto solo su questo dispositivo.</p>
              {hasCurrent ? <Alert>Il genogramma aperto verrà sostituito. Se non l&apos;hai esportato, le modifiche andranno perse.</Alert> : null}
              {result.warnings.length ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-600">
                  {[...new Set(result.warnings)].slice(0, 6).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Alert variant="error">{result.error}</Alert>
          )}
        </Dialog>
      ) : null}
    </>
  );
}
