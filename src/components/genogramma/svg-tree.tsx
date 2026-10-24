import { createElement, type ReactNode } from "react";
import type { SvgNode } from "@/lib/genogramma/render/svg-tree";

/**
 * Adattatore React dell'albero SVG puro: lo stesso albero usato per
 * l'export diventa elementi React (attributi in camelCase). Nessun
 * innerHTML: il testo resta testo e React ne fa l'escape.
 */
function attrName(k: string): string {
  if (k.startsWith("data-") || k.startsWith("aria-")) return k;
  return k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function propsOf(node: SvgNode): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.attrs)) {
    if (v === undefined || v === "" || k === "xmlns" || k === "version") continue;
    props[attrName(k)] = v;
  }
  return props;
}

function toReact(node: SvgNode | string, key: number): ReactNode {
  if (typeof node === "string") return node;
  return createElement(node.tag, { ...propsOf(node), key }, ...node.children.map(toReact));
}

export function SvgTree({
  node,
  className,
  title,
}: {
  node: SvgNode;
  className?: string;
  title?: string;
}) {
  const props = propsOf(node);
  if (className) props.className = className;
  if (title) {
    props["aria-label"] = title;
    props.role = "img";
  }
  return createElement("svg", props, ...node.children.map(toReact));
}
