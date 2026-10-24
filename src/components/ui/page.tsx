import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
} as const;

/**
 * Contenitore standard delle pagine applicative: larghezza massima e
 * spaziature uniformi, così ogni sezione parte dallo stesso punto.
 */
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-10",
        WIDTHS[width],
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  as: Heading = "h1",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
            {eyebrow}
          </p>
        ) : null}
        <Heading className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-neutral-900 sm:text-[2.25rem]">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
