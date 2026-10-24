import type { SvgNode } from "./svg-tree";

/**
 * Serializzazione XML con escape di tutto il testo dell'utente: nessun
 * markup può entrare nell'SVG esportato (etichette con `<script>`,
 * virgolette negli attributi, caratteri di controllo).
 */
export function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const NAME_RE = /^[a-zA-Z_][\w:.-]*$/;

export function serialize(node: SvgNode, indent = ""): string {
  if (!NAME_RE.test(node.tag)) throw new Error("tag SVG non valido");
  const attrs = Object.entries(node.attrs)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => {
      if (!NAME_RE.test(k) || /^on/i.test(k)) throw new Error("attributo SVG non valido");
      return ` ${k}="${escapeXml(String(v))}"`;
    })
    .join("");
  if (node.children.length === 0) return `${indent}<${node.tag}${attrs}/>`;
  const onlyText = node.children.every((c) => typeof c === "string");
  if (onlyText) {
    return `${indent}<${node.tag}${attrs}>${node.children.map((c) => escapeXml(c as string)).join("")}</${node.tag}>`;
  }
  const inner = node.children
    .map((c) => (typeof c === "string" ? `${indent}  ${escapeXml(c)}` : serialize(c, `${indent}  `)))
    .join("\n");
  return `${indent}<${node.tag}${attrs}>\n${inner}\n${indent}</${node.tag}>`;
}

/** Documento SVG completo, pronto per file o appunti. */
export function toSvgDocument(root: SvgNode): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(root)}\n`;
}
