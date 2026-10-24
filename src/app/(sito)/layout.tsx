import type { ReactNode } from "react";
import Link from "next/link";

/** Pagine di contenuto: piè di pagina essenziale. L'editor ne fa a meno. */
export default function SitoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-neutral-500 sm:px-6 lg:px-10">
          <p>TreeBuilder · Nomenclatura NSGC 2022/2025 · Nessun dato lascia il dispositivo</p>
          <nav aria-label="Informazioni" className="flex gap-4">
            <Link href="/simboli" className="hover:text-neutral-900">
              Simboli
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900">
              Privacy
            </Link>
            <a href="https://github.com/sebastianmicu24/TreeBuilder" className="hover:text-neutral-900" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
