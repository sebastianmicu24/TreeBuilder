import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Superficie bianca con bordo sottile: l'unico "contenitore" del sito. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Intestazione di sezione: titolo, nota e azione a destra, con filetto sotto. */
export function PanelHeader({
  title,
  description,
  action,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-5 py-3.5",
        className
      )}
    >
      <div className="min-w-0">
        <Heading className="text-sm font-semibold text-neutral-900">
          {title}
        </Heading>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}

/** Titolo di sezione "libera" (fuori dai pannelli), in carattere serif. */
export function SectionTitle({
  children,
  description,
  action,
  className,
}: {
  children: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-1",
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
          {children}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="text-sm">{action}</div> : null}
    </div>
  );
}
