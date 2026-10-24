import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "error";

const styles: Record<AlertVariant, string> = {
  info: "border-neutral-200 bg-neutral-50 text-neutral-800 [&>svg]:text-neutral-500",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-950 [&>svg]:text-emerald-700",
  error: "border-red-300 bg-red-50 text-red-950 [&>svg]:text-red-700",
};

const icons: Record<AlertVariant, ReactNode> = {
  info: <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
  success: (
    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
  ),
  error: <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />,
};

export function Alert({
  variant = "info",
  children,
  className,
  onDismiss,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
  /**
   * Se presente, l'avviso mostra la "x" in alto a destra: chiuderlo è un
   * gesto esplicito dell'utente invece di un avviso che resta lì.
   */
  onDismiss?: () => void;
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "relative flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed",
        styles[variant],
        onDismiss && "pr-10",
        className
      )}
    >
      {icons[variant]}
      <div className="min-w-0">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Chiudi l'avviso"
          title="Chiudi"
          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded text-current opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
