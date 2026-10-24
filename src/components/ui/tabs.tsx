"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type TabItem<T extends string> = { id: T; label: string };

/**
 * Schede accessibili (ruoli ARIA tablist/tab, frecce sinistra/destra).
 * Il contenuto lo rende il chiamante con `id="{idPrefix}-panel-{id}"`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  idPrefix,
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-0.5 overflow-x-auto rounded-lg bg-neutral-100 p-0.5", className)}>
      {items.map((item, i) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex-1 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-950/5"
                : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
