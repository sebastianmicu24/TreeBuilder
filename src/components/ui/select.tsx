import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** <select> nativo con etichetta, nello stile dei campi del sito. */
export function SelectField({
  label,
  id,
  options,
  hint,
  className,
  ...props
}: Omit<ComponentProps<"select">, "children"> & {
  label: string;
  id: string;
  options: SelectOption[];
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      <select
        id={id}
        className={cn(fieldClass, "border-neutral-300 pr-8")}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
