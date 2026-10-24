"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { dragInfo, dropIndex, dropMarkerX, modelIndex, nearestInDirection } from "@/lib/genogramma/layout/interaction";
import { canAddParents, getRelationToProband } from "@/lib/genogramma/model/queries";
import type { Id, Pedigree } from "@/lib/genogramma/model/types";
import type { Rendered } from "@/lib/genogramma/render/render";
import { cn } from "@/lib/utils";
import { SvgTree } from "./svg-tree";

export type QuickAdd = "parents" | "sibling" | "child" | "partner";

type View = { scale: number; x: number; y: number };

const MIN = 0.15;
const MAX = 4;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-40";

/**
 * Vista interattiva del genogramma: lo stesso SVG dell'export, con zoom
 * (rotellina, pizzico, pulsanti), spostamento, selezione con clic o
 * frecce, "+" contestuali attorno al simbolo selezionato e trascinamento
 * orizzontale di un fratello dentro la sua fratria.
 */
export function GenogramCanvas({
  pedigree,
  rendered,
  selected,
  onSelect,
  onQuickAdd,
  onOpen,
  onDelete,
  onReorder,
  onMessage,
  readOnlyDrag = false,
}: {
  pedigree: Pedigree;
  rendered: Rendered;
  selected: Id | null;
  onSelect: (id: Id | null) => void;
  onQuickAdd: (kind: QuickAdd, id: Id) => void;
  onOpen: (id: Id) => void;
  onDelete: (id: Id) => void;
  onReorder: (unionId: Id, childId: Id, modelIndex: number) => void;
  onMessage: (text: string) => void;
  readOnlyDrag?: boolean;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 800, h: 600 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    kind: "pan" | "maybe-drag" | "drag" | "pinch";
    startX: number;
    startY: number;
    view: View;
    id?: Id;
    distance?: number;
  } | null>(null);
  const [drag, setDrag] = useState<{ id: Id; unionId: Id; siblings: Id[]; x: number; index: number } | null>(null);
  const lay = rendered.layout;
  const fittedFor = useRef<string | null>(null);

  // Dimensioni del riquadro.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const scale = clamp(Math.min((size.w - 32) / rendered.width, (size.h - 32) / rendered.height, 1.25), MIN, MAX);
    setView({ scale, x: (size.w - rendered.width * scale) / 2, y: Math.max(16, (size.h - rendered.height * scale) / 2) });
  }, [rendered.width, rendered.height, size.w, size.h]);

  // Adatta alla vista al primo disegno di ogni genogramma.
  useEffect(() => {
    if (fittedFor.current === pedigree.id || size.w < 50) return;
    fittedFor.current = pedigree.id;
    fit();
  }, [pedigree.id, fit, size.w]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN, MAX);
      const k = scale / v.scale;
      return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  const toScreen = (lx: number, ly: number) => ({
    x: (lx + rendered.offsetX) * view.scale + view.x,
    y: (ly + rendered.offsetY) * view.scale + view.y,
  });
  const toLayoutX = (sx: number) => (sx - view.x) / view.scale - rendered.offsetX;

  const onWheel = (e: WheelEvent) => {
    const rect = viewport.current!.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
  };

  // La rotellina dentro il riquadro zooma invece di scorrere la pagina.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const stop = (e: globalThis.WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  const nodeAt = (target: EventTarget | null): Id | null => {
    const el = (target as Element | null)?.closest?.("[data-gid]");
    return el?.getAttribute("data-gid") ?? null;
  };

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest("[data-overlay]")) return;
    viewport.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", startX: 0, startY: 0, view, distance: Math.hypot(a.x - b.x, a.y - b.y) };
      setDrag(null);
      return;
    }
    const id = nodeAt(e.target);
    gesture.current = { kind: id && !readOnlyDrag ? "maybe-drag" : "pan", startX: e.clientX, startY: e.clientY, view, id: id ?? undefined };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const rect = viewport.current!.getBoundingClientRect();
    if (g.kind === "pinch" && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      const scale = clamp(g.view.scale * (d / (g.distance || d)), MIN, MAX);
      const k = scale / g.view.scale;
      setView({ scale, x: cx - (cx - g.view.x) * k, y: cy - (cy - g.view.y) * k });
      return;
    }
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.kind === "maybe-drag" && g.id) {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        const info = dragInfo(pedigree, lay, g.id);
        if (info.ok) {
          g.kind = "drag";
          onSelect(g.id);
        } else {
          onMessage(info.reason);
          g.kind = "pan";
        }
      } else if (Math.abs(dy) > 6) {
        g.kind = "pan";
      }
    }
    if (g.kind === "drag" && g.id) {
      const info = dragInfo(pedigree, lay, g.id);
      if (!info.ok) return;
      const lx = toLayoutX(e.clientX - rect.left);
      const index = dropIndex(lay, info.siblings, g.id, lx);
      setDrag({ id: g.id, unionId: info.unionId, siblings: info.siblings, x: lx, index });
      return;
    }
    if (g.kind === "pan") setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
  };

  const onPointerUp = (e: PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g) return;
    if (g.kind === "drag" && drag) {
      onReorder(drag.unionId, drag.id, modelIndex(pedigree, drag.unionId, drag.siblings, drag.id, drag.index));
      setDrag(null);
      return;
    }
    setDrag(null);
    const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 6;
    if (!moved && (g.kind === "maybe-drag" || g.kind === "pan")) onSelect(g.id ?? null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const dirs: Record<string, "left" | "right" | "up" | "down"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    if (dirs[e.key]) {
      e.preventDefault();
      const next = selected ? nearestInDirection(lay, selected, dirs[e.key]) : (pedigree.proband ?? lay.nodes[0]?.id ?? null);
      if (next) onSelect(next);
      return;
    }
    if (e.key === "Enter" && selected) {
      e.preventDefault();
      onOpen(selected);
    } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
      e.preventDefault();
      onDelete(selected);
    } else if (e.key === "Escape") {
      onSelect(null);
    } else if (e.key === "+" || e.key === "=") {
      zoomAt(1.2, size.w / 2, size.h / 2);
    } else if (e.key === "-") {
      zoomAt(1 / 1.2, size.w / 2, size.h / 2);
    } else if (e.key === "0") {
      fit();
    }
  };

  const sel = selected ? lay.byId.get(selected) : null;
  const ring = sel
    ? (() => {
        const p1 = toScreen(sel.symbolBox.x1, sel.symbolBox.y1);
        const p2 = toScreen(sel.symbolBox.x2, sel.symbolBox.y2);
        return { x: p1.x - 4, y: p1.y - 4, w: p2.x - p1.x + 8, h: p2.y - p1.y + 8 };
      })()
    : null;
  const center = sel ? toScreen(sel.x, sel.y) : null;
  const half = sel ? (lay.display.symbolSize / 2) * view.scale : 0;
  const parentsCheck = selected ? canAddParents(pedigree, selected) : null;
  const announce = sel
    ? [sel.number, getRelationToProband(pedigree, sel.id), pedigree.individuals[sel.id]?.label].filter(Boolean).join(", ")
    : "Nessun familiare selezionato";

  const plus = (kind: QuickAdd, x: number, y: number, label: string, disabled = false) => (
    <button
      key={kind}
      type="button"
      data-overlay
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={() => selected && onQuickAdd(kind, selected)}
      className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-600 bg-white text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-300"
      style={{ left: x, top: y }}
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-50 bg-[radial-gradient(circle,#d4d4d8_1px,transparent_1px)] bg-[size:22px_22px]">
      <div
        ref={viewport}
        tabIndex={0}
        role="application"
        aria-roledescription="genogramma"
        aria-label="Genogramma. Frecce per spostarsi tra i familiari, Invio per i dettagli, Canc per eliminare, + e − per lo zoom."
        className={cn("absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600", drag ? "cursor-grabbing" : "cursor-grab")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onDoubleClick={(e) => {
          const id = nodeAt(e.target);
          if (id) onOpen(id);
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, width: rendered.width, height: rendered.height }}
        >
          <SvgTree node={rendered.svg} className="block" />
        </div>

        {ring ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-md border-2 border-brand-600"
            style={{ left: ring.x, top: ring.y, width: ring.w, height: ring.h }}
          />
        ) : null}

        {drag ? (
          (() => {
            const mx = dropMarkerX(lay, drag.siblings, drag.id, drag.index);
            const node = lay.byId.get(drag.id)!;
            const p = toScreen(mx, node.y);
            return (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute w-0.5 bg-brand-600"
                style={{ left: p.x - 1, top: p.y - half - 10, height: half * 2 + 20 }}
              />
            );
          })()
        ) : null}

        {sel && center && !drag ? (
          <>
            {plus(
              "parents",
              center.x,
              center.y - half - 22,
              parentsCheck?.allowed ? "Aggiungi genitori" : `Aggiungi genitori: non disponibile. ${parentsCheck?.reason ?? ""}`,
              !parentsCheck?.allowed
            )}
            {plus("sibling", center.x - half - 22 - (sel.labelsRight ? 0 : 0), center.y, "Aggiungi fratello o sorella")}
            {plus("partner", center.x + half + 22, center.y, "Aggiungi partner")}
            {plus("child", center.x, center.y + half + 22, "Aggiungi figlio o figlia")}
          </>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white/95 p-1 shadow-sm backdrop-blur" data-overlay>
        <button type="button" className={iconBtn} onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)} aria-label="Riduci" title="Riduci">
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-neutral-600" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" className={iconBtn} onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)} aria-label="Ingrandisci" title="Ingrandisci">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={iconBtn}
          onClick={() => setView((v) => ({ ...v, scale: 1 }))}
          aria-label="Zoom al 100%"
          title="100%"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={iconBtn} onClick={fit} aria-label="Adatta alla vista" title="Adatta alla vista">
          <Maximize className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
