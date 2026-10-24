"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FilePlus2, MousePointerClick, PanelRightClose, PanelRightOpen, Redo2, Table2, Undo2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { layout as computeLayout } from "@/lib/genogramma/layout";
import { moveChild, updateDisplay } from "@/lib/genogramma/model/commands";
import type { Id } from "@/lib/genogramma/model/types";
import { renderPedigree } from "@/lib/genogramma/render/render";
import { cn } from "@/lib/utils";
import { AddRelativeDialog } from "./add-relative-dialog";
import { DeleteDialog } from "./delete-dialog";
import { DisplaySettingsPanel } from "./display-settings";
import { Segmented } from "./fields";
import { GenogramCanvas, type QuickAdd } from "./genogram-canvas";
import { LegendEditor } from "./legend-editor";
import { MemberPanel } from "./member-panel";
import { MetadataPanel } from "./metadata-panel";
import { TableEditor } from "./table-editor";
import type { GenogramStore } from "./use-genogram-store";

type Tab = "member" | "legend" | "meta" | "display";

const MIN_W = 300;
const MAX_W = 640;

/**
 * Editor del genogramma: disegno interattivo, pannello laterale
 * ridimensionabile e richiudibile (foglio dal basso su mobile), undo/redo,
 * tabella, legenda, dati e impostazioni. `variant="patient"` mostra solo le
 * correzioni semplici del percorso paziente.
 */
export function GenogramEditor({
  store,
  variant = "doctor",
  onNew,
  toolbarExtra,
  bottomBar,
  className,
}: {
  store: GenogramStore;
  variant?: "doctor" | "patient";
  onNew?: () => void;
  toolbarExtra?: ReactNode;
  /** Barra in fondo (stato del salvataggio locale, privacy). */
  bottomBar?: ReactNode;
  /** Altezza e cornice (di default occupa tutto lo schermo nella shell). */
  className?: string;
}) {
  const ped = store.pedigree!;
  const doctor = variant === "doctor";
  const lay = useMemo(() => computeLayout(ped), [ped]);
  const rendered = useMemo(() => renderPedigree(ped, { interactive: true, idPrefix: "ed-" }, lay), [ped, lay]);
  const [tab, setTab] = useState<Tab>("member");
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(380);
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState<{ kind: QuickAdd; target: Id } | null>(null);
  const [deleting, setDeleting] = useState<Id | null>(null);
  const [table, setTable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const resize = useRef<{ x: number; w: number } | null>(null);

  // Undo / redo da tastiera (non dentro i campi di testo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const select = (id: Id | null) => {
    store.select(id);
    if (id) {
      setTab("member");
      setSheet(true);
    }
  };

  const onResizeDown = (e: ReactPointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resize.current = { x: e.clientX, w: width };
  };
  const onResizeMove = (e: ReactPointerEvent) => {
    if (!resize.current) return;
    setWidth(Math.min(MAX_W, Math.max(MIN_W, resize.current.w + (resize.current.x - e.clientX))));
  };

  const tabs = doctor
    ? [
        { id: "member" as const, label: "Familiare" },
        { id: "legend" as const, label: "Condizioni" },
        { id: "meta" as const, label: "Dati" },
        { id: "display" as const, label: "Aspetto" },
      ]
    : [
        { id: "member" as const, label: "Familiare" },
        { id: "legend" as const, label: "Condizioni" },
      ];

  const panelBody = (
    <>
      <Tabs items={tabs} value={tab} onChange={setTab} idPrefix="gen" label="Pannelli" className="mx-3 mt-3" />
      <div id={`gen-panel-${tab}`} role="tabpanel" aria-labelledby={`gen-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
        {tab === "member" ? (
          store.selected ? (
            <MemberPanel
              store={store}
              id={store.selected}
              numbering={lay.numbering}
              onQuickAdd={(kind, id) => setAdding({ kind, target: id })}
              onDelete={setDeleting}
              onManageConditions={() => setTab("legend")}
              simple={!doctor}
            />
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <MousePointerClick className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-medium text-neutral-900">Nessun familiare selezionato</p>
              <p className="mt-1 max-w-xs text-sm text-neutral-500">
                Fai clic su un simbolo nel disegno (o usa le frecce della tastiera) per vederne i dati e aggiungere parenti.
              </p>
            </div>
          )
        ) : tab === "legend" ? (
          <LegendEditor store={store} simple={!doctor} />
        ) : tab === "meta" ? (
          <MetadataPanel store={store} numbering={lay.numbering} />
        ) : (
          <DisplaySettingsPanel store={store} />
        )}
      </div>
    </>
  );

  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-35";

  return (
    <div className={cn("flex flex-col", className ?? "h-[calc(100dvh-3.5rem)] lg:h-dvh")}>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-neutral-200 bg-white px-2 py-1.5 sm:px-3">
        <div className="flex items-center" role="group" aria-label="Modifiche">
          <button type="button" className={iconBtn} onClick={store.undo} disabled={!store.canUndo} aria-label="Annulla (Ctrl+Z)" title="Annulla (Ctrl+Z)">
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className={iconBtn} onClick={store.redo} disabled={!store.canRedo} aria-label="Ripeti (Ctrl+Shift+Z)" title="Ripeti (Ctrl+Shift+Z)">
            <Redo2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <span className="mx-1.5 h-5 w-px bg-neutral-200" aria-hidden="true" />
        <div className="w-52" title="Colori del disegno: il bianco e nero è lo standard per stampa e cartella">
          <Segmented
            label="Colori del disegno"
            size="sm"
            value={ped.display.color ? "color" : "bw"}
            onChange={(v) => store.run((p) => updateDisplay(p, { color: v === "color" }))}
            options={[
              { value: "bw", label: "Bianco e nero" },
              { value: "color", label: "Colori" },
            ]}
          />
        </div>
        <span className="mx-1.5 h-5 w-px bg-neutral-200" aria-hidden="true" />
        {doctor ? (
          <Button size="sm" variant="ghost" onClick={() => setTable(true)}>
            <Table2 className="h-4 w-4" aria-hidden="true" /> Tabella
          </Button>
        ) : null}
        {toolbarExtra}
        <div className="ml-auto flex items-center gap-1">
          {onNew ? (
            <Button size="sm" variant="ghost" onClick={onNew}>
              <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Nuovo
            </Button>
          ) : null}
          <button
            type="button"
            className={cn(iconBtn, "hidden lg:inline-flex")}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Chiudi il pannello laterale" : "Apri il pannello laterale"}
            aria-expanded={open}
            title={open ? "Chiudi il pannello" : "Apri il pannello"}
          >
            {open ? <PanelRightClose className="h-4 w-4" aria-hidden="true" /> : <PanelRightOpen className="h-4 w-4" aria-hidden="true" />}
          </button>
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setSheet((v) => !v)} aria-expanded={sheet}>
            Pannelli
          </Button>
        </div>
      </div>

      {store.error ? (
        <Alert variant="error" onDismiss={store.clearError} className="mx-3 mt-2">
          {store.error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="info" onDismiss={() => setMessage(null)} className="mx-3 mt-2">
          {message}
        </Alert>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <GenogramCanvas
            pedigree={ped}
            rendered={rendered}
            selected={store.selected}
            onSelect={select}
            onQuickAdd={(kind, id) => setAdding({ kind, target: id })}
            onOpen={(id) => {
              select(id);
            }}
            onDelete={setDeleting}
            onReorder={(unionId, childId, index) => store.run((p) => moveChild(p, unionId, childId, index))}
            onMessage={setMessage}
          />
        </div>

        {open ? (
          <aside className="relative hidden flex-col border-l border-neutral-200 bg-white lg:flex" style={{ width }} aria-label="Pannello del genogramma">
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ridimensiona il pannello"
              tabIndex={0}
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={() => (resize.current = null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setWidth((w) => Math.min(MAX_W, w + 20));
                if (e.key === "ArrowRight") setWidth((w) => Math.max(MIN_W, w - 20));
              }}
              className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize transition-colors hover:bg-brand-500/25 focus:bg-brand-500/25 focus:outline-none"
            />
            {panelBody}
          </aside>
        ) : null}

        {sheet ? (
          <div
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-neutral-200 bg-white shadow-[0_-8px_30px_rgb(0_0_0/0.08)] lg:hidden"
            role="dialog"
            aria-label="Pannello del genogramma"
          >
            <div className="relative flex justify-end px-2 pt-2">
              <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-neutral-200" aria-hidden="true" />
              <button type="button" className="rounded-md px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" onClick={() => setSheet(false)}>
                Chiudi
              </button>
            </div>
            {panelBody}
          </div>
        ) : null}
      </div>

      {bottomBar ? <div className="border-t border-neutral-200 bg-white px-3 py-1">{bottomBar}</div> : null}

      {adding ? <AddRelativeDialog store={store} kind={adding.kind} target={adding.target} numbering={lay.numbering} onClose={() => setAdding(null)} /> : null}
      {deleting ? <DeleteDialog store={store} id={deleting} numbering={lay.numbering} onClose={() => setDeleting(null)} /> : null}
      {table ? (
        <Dialog open onClose={() => setTable(false)} title="Tabella dei familiari" description="Le modifiche si vedono subito nel disegno." size="xl">
          <TableEditor
            store={store}
            numbering={lay.numbering}
            onSelect={(id) => {
              setTable(false);
              select(id);
            }}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
