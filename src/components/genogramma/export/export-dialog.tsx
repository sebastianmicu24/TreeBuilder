"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  CSV_LOSSES,
  exportCsv,
  exportFhir,
  exportFileName,
  exportGa4gh,
  exportNativeJson,
  exportPed,
  exportPhenopacket,
  exportSvg,
  FHIR_IG_VERSION,
  FHIR_LOSSES,
  GA4GH_LOSSES,
  identifyingData,
  PED_LOSSES,
  PHENOPACKET_LOSSES,
  stripIdentifying,
} from "@/lib/genogramma/io";
import type { Pedigree } from "@/lib/genogramma/model/types";
import { renderPedigree } from "@/lib/genogramma/render/render";
import { FieldRow, Select, Toggle } from "../fields";
import { copyPng, copySvg, downloadBlob, downloadText, svgToPng } from "./browser-io";
import { PrintView } from "./print-view";

type Format = "json" | "png" | "svg" | "print" | "csv" | "ped" | "phenopacket" | "ga4gh" | "fhir";

const FORMATS: { id: Format; label: string; hint: string; doctor?: boolean }[] = [
  { id: "json", label: "File del genogramma (JSON)", hint: "Completo, senza perdite: da consegnare al medico o riaprire qui." },
  { id: "png", label: "Immagine PNG", hint: "Da allegare o stampare." },
  { id: "svg", label: "Immagine SVG", hint: "Vettoriale, modificabile in PowerPoint e Word." },
  { id: "print", label: "Stampa o PDF", hint: "Con legenda e dati; scegli \"Salva come PDF\" nella finestra di stampa." },
  { id: "csv", label: "Tabella CSV", hint: CSV_LOSSES, doctor: true },
  { id: "ped", label: "PED (PLINK/LINKAGE)", hint: PED_LOSSES, doctor: true },
  { id: "phenopacket", label: "Phenopackets v2 (Family)", hint: PHENOPACKET_LOSSES, doctor: true },
  { id: "ga4gh", label: "GA4GH Pedigree (KIN)", hint: GA4GH_LOSSES, doctor: true },
  { id: "fhir", label: "FHIR R4 (sperimentale)", hint: `${FHIR_LOSSES} ${FHIR_IG_VERSION}.`, doctor: true },
];

/**
 * Export in tutti i formati, generati nel browser e scaricati come file
 * locali. Prima di un file con nomi o date complete compare un avviso, con
 * la possibilità di esportare senza.
 */
export function ExportDialog({ pedigree, onClose, doctor }: { pedigree: Pedigree; onClose: () => void; doctor: boolean }) {
  const [format, setFormat] = useState<Format>("json");
  const [office, setOffice] = useState(true);
  const [scale, setScale] = useState("2");
  const [sep, setSep] = useState<";" | ",">(";");
  const [condition, setCondition] = useState(pedigree.legend.conditions[0]?.id ?? "");
  const [strip, setStrip] = useState(false);
  const [printMode, setPrintMode] = useState<"fit" | "pages" | null>(null);
  const [pageMode, setPageMode] = useState<"fit" | "pages">("fit");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ident = identifyingData(pedigree);
  const sensitive = ident.names + ident.fullDates > 0;
  const ped = strip ? stripIdentifying(pedigree) : pedigree;
  const available = FORMATS.filter((f) => doctor || !f.doctor);
  const current = available.find((f) => f.id === format)!;

  const run = async (action: "download" | "copy-svg" | "copy-png") => {
    setError(null);
    setStatus(null);
    try {
      if (action === "copy-svg") {
        const how = await copySvg(exportSvg(ped, office));
        setStatus(how === "image" ? "SVG copiato negli appunti." : "SVG copiato come testo.");
        return;
      }
      if (action === "copy-png") {
        const r = renderPedigree(ped, { idPrefix: "x-" });
        await copyPng(await svgToPng(exportSvg(ped), r.width, r.height, Number(scale)));
        setStatus("Immagine copiata: incollala in Word o PowerPoint.");
        return;
      }
      switch (format) {
        case "json":
          downloadText(exportFileName(ped, "json"), exportNativeJson(ped), "application/json");
          break;
        case "svg":
          downloadText(exportFileName(ped, "svg"), exportSvg(ped, office), "image/svg+xml");
          break;
        case "png": {
          const r = renderPedigree(ped, { idPrefix: "x-" });
          downloadBlob(exportFileName(ped, "png"), await svgToPng(exportSvg(ped), r.width, r.height, Number(scale)));
          break;
        }
        case "print":
          setPrintMode(pageMode);
          return;
        case "csv":
          downloadText(exportFileName(ped, "csv"), exportCsv(ped, sep), "text/csv");
          break;
        case "ped":
          downloadText(exportFileName(ped, "ped"), exportPed(ped, condition || undefined), "text/plain");
          break;
        case "phenopacket":
          downloadText(exportFileName(ped, "phenopacket.json"), exportPhenopacket(ped, condition || undefined), "application/json");
          break;
        case "ga4gh":
          downloadText(exportFileName(ped, "ga4gh.json"), exportGa4gh(ped), "application/json");
          break;
        case "fhir":
          downloadText(exportFileName(ped, "fhir.json"), exportFhir(ped), "application/fhir+json");
          break;
      }
      setStatus("File creato sul dispositivo.");
    } catch (e) {
      const clip = action !== "download";
      setError(
        clip
          ? "Copia non riuscita: il browser non ha concesso l'accesso agli appunti (la pagina deve essere in primo piano). Usa \"Scarica\"."
          : e instanceof Error && /probando/.test(e.message)
            ? e.message
            : "Export non riuscito."
      );
    }
  };

  const rendered = printMode ? renderPedigree(ped, { idPrefix: "p-" }) : null;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title="Esporta"
        description="Il file si crea sul dispositivo: nulla viene inviato al sito."
        size="lg"
        footer={
          <>
            {format === "svg" || format === "png" ? (
              <>
                <Button variant="ghost" onClick={() => run("copy-svg")}>
                  Copia SVG
                </Button>
                <Button variant="ghost" onClick={() => run("copy-png")}>
                  Copia PNG
                </Button>
              </>
            ) : null}
            <Button onClick={() => run("download")}>{format === "print" ? "Stampa" : "Scarica"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Formato</legend>
            {available.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 px-3 py-2 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                <input type="radio" name="fmt" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-1 accent-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-neutral-900">{f.label}</span>
                  <span className="block text-xs text-neutral-500">{f.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {format === "svg" ? <Toggle id="ex-office" label="Compatibilità Office: tratteggi come linee (consigliato per PowerPoint)" checked={office} onChange={setOffice} /> : null}
          {format === "png" || format === "svg" ? (
            <FieldRow label="Risoluzione PNG" htmlFor="ex-scale">
              <Select id="ex-scale" value={scale} onChange={setScale} options={[{ value: "1", label: "1×" }, { value: "2", label: "2× (consigliata)" }, { value: "3", label: "3×" }]} />
            </FieldRow>
          ) : null}
          {format === "print" ? (
            <FieldRow label="Impaginazione" htmlFor="ex-pages">
              <Select id="ex-pages" value={pageMode} onChange={(v) => setPageMode(v as "fit")} options={[{ value: "fit", label: "Adatta a una pagina" }, { value: "pages", label: "Dividi su più pagine A4" }]} />
            </FieldRow>
          ) : null}
          {format === "csv" ? (
            <FieldRow label="Separatore" htmlFor="ex-sep">
              <Select id="ex-sep" value={sep} onChange={(v) => setSep(v as ";")} options={[{ value: ";", label: "Punto e virgola (Excel italiano)" }, { value: ",", label: "Virgola" }]} />
            </FieldRow>
          ) : null}
          {(format === "ped" || format === "phenopacket") && pedigree.legend.conditions.length ? (
            <FieldRow label="Condizione per lo stato di affetto" htmlFor="ex-cond" hint="Il formato ha una sola colonna di fenotipo.">
              <Select id="ex-cond" value={condition} onChange={setCondition} options={pedigree.legend.conditions.map((c) => ({ value: c.id, label: c.label }))} />
            </FieldRow>
          ) : null}

          {sensitive ? (
            <Alert variant="error">
              Il genogramma contiene {ident.names ? `${ident.names} nomi` : ""}
              {ident.names && ident.fullDates ? " e " : ""}
              {ident.fullDates ? `${ident.fullDates} date complete` : ""}: chi riceve il file potrà identificare le persone.
              <div className="mt-2">
                <Toggle id="ex-strip" label="Esporta senza nomi e con il solo anno di nascita" checked={strip} onChange={setStrip} />
              </div>
            </Alert>
          ) : null}
          {current.doctor ? <p className="text-xs text-neutral-500">{current.hint}</p> : null}
          {status ? <Alert variant="success">{status}</Alert> : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>
      </Dialog>
      {printMode && rendered ? (
        <PrintView svg={rendered.svg} width={rendered.width} height={rendered.height} mode={printMode} onDone={() => setPrintMode(null)} />
      ) : null}
    </>
  );
}
