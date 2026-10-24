"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SvgNode } from "@/lib/genogramma/render/svg-tree";
import { SvgTree } from "../svg-tree";

/**
 * Vista di stampa (anche "Salva come PDF" del browser): genogramma con
 * legenda e metadati, su una pagina adattata oppure diviso in pagine A4.
 * Si monta nel body, stampa e si smonta: nessuna libreria PDF, nessuna rete.
 */
export function PrintView({
  svg,
  width,
  height,
  mode,
  onDone,
}: {
  svg: SvgNode;
  width: number;
  height: number;
  mode: "fit" | "pages";
  onDone: () => void;
}) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    document.body.classList.add("genogram-printing");
    const t = setTimeout(() => {
      window.print();
      done.current();
    }, 50);
    return () => {
      clearTimeout(t);
      document.body.classList.remove("genogram-printing");
    };
  }, []);

  // Pagine A4 orizzontali: riquadri del disegno con un piccolo sormonto.
  const tileW = 1000;
  const tileH = Math.round(tileW / 1.414);
  const tiles: { x: number; y: number }[] = [];
  if (mode === "pages") {
    for (let y = 0; y < height; y += tileH - 20) for (let x = 0; x < width; x += tileW - 20) tiles.push({ x, y });
  }

  return createPortal(
    <div id="genogram-print" aria-hidden="true">
      <style>{`
        #genogram-print { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body.genogram-printing > *:not(#genogram-print) { display: none !important; }
          body.genogram-printing #genogram-print { display: block; }
          #genogram-print .page { break-after: page; page-break-after: always; width: 100%; height: 185mm; display: flex; align-items: center; justify-content: center; }
          #genogram-print .page:last-child { break-after: auto; page-break-after: auto; }
          #genogram-print svg { max-width: 100%; max-height: 185mm; width: auto; height: auto; }
        }
      `}</style>
      {mode === "fit" ? (
        <div className="page">
          <SvgTree node={svg} />
        </div>
      ) : (
        tiles.map((t, i) => (
          <div className="page" key={i}>
            <SvgTree
              node={{
                ...svg,
                attrs: { ...svg.attrs, viewBox: `${t.x} ${t.y} ${tileW} ${tileH}`, width: tileW, height: tileH },
              }}
            />
          </div>
        ))
      )}
    </div>,
    document.body
  );
}
