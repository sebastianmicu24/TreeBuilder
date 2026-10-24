"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/medico", label: "Editor clinico", short: "Editor" },
  { href: "/paziente", label: "Per pazienti", short: "Pazienti" },
  { href: "/simboli", label: "Simboli", short: "Simboli" },
] as const;

/** Barra superiore unica, sottile: lascia tutta l'altezza al disegno. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200/80 bg-white/85 px-3 backdrop-blur sm:px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md pr-1" aria-label="TreeBuilder — Pagina iniziale">
        <Logo />
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-neutral-900">TreeBuilder</span>
      </Link>
      <nav aria-label="Sezioni" className="ml-auto flex items-center gap-0.5 text-sm">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                active ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.short}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
