"use client";

/**
 * Operazioni del browser per export e import: solo Blob, URL locali
 * (`blob:`), canvas e appunti. Nessuna richiesta di rete.
 */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(name: string, text: string, type: string): void {
  downloadBlob(name, new Blob([text], { type: `${type};charset=utf-8` }));
}

const MAX_SIDE = 16000;
const MAX_AREA = 100_000_000;

/** PNG dallo stesso SVG dell'export (canvas locale), sfondo bianco. */
export async function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  let k = scale;
  while ((width * k > MAX_SIDE || height * k > MAX_SIDE || width * height * k * k > MAX_AREA) && k > 0.25) k /= 1.5;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * k);
    canvas.height = Math.round(height * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG non generato."))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Copia negli appunti: PNG come immagine (incollabile in Word e PowerPoint). */
export async function copyPng(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("Appunti non disponibili in questo browser.");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** Copia SVG: come immagine SVG dove supportato, altrimenti come testo. */
export async function copySvg(svg: string): Promise<"image" | "text"> {
  if (!navigator.clipboard) throw new Error("Appunti non disponibili in questo browser.");
  try {
    if (typeof ClipboardItem !== "undefined" && (ClipboardItem as unknown as { supports?: (t: string) => boolean }).supports?.("image/svg+xml")) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/svg+xml": new Blob([svg], { type: "image/svg+xml" }),
          "text/plain": new Blob([svg], { type: "text/plain" }),
        }),
      ]);
      return "image";
    }
  } catch {
    // Si ripiega sul testo.
  }
  await navigator.clipboard.writeText(svg);
  return "text";
}

/** Lettura locale di un file scelto dall'utente (FileReader/Blob, nessun upload). */
export async function readFileText(file: File): Promise<string> {
  return await file.text();
}
