import { cn } from "@/lib/utils";

/** Marchio TreeBuilder: una coppia e il loro figlio, in simboli NSGC. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <rect x="6.5" y="7" width="7" height="7" rx="0.5" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="22" cy="10.5" r="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
      <path d="M13.5 10.5h4.9M16 10.5v7.5" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16" cy="22" r="3.6" fill="#818cf8" />
    </svg>
  );
}
