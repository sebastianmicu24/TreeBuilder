import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "block h-9 w-full rounded-md border bg-white shadow-xs px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors hover:border-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/15";

export function TextField({
  label,
  id,
  error,
  hint,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  id: string;
  error?: string | null;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          fieldClass,
          error ? "border-red-600" : "border-neutral-300"
        )}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  id,
  error,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: ReactNode;
  id: string;
  error?: string | null;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-neutral-300 accent-brand-600"
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-snug text-neutral-600">
          {label}
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
