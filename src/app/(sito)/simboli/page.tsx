import type { Metadata } from "next";
import { SvgTree } from "@/components/genogramma/svg-tree";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { buildCatalog } from "@/lib/genogramma/catalog";
import { renderPedigree } from "@/lib/genogramma/render/render";

export const metadata: Metadata = {
  title: "Simboli del genogramma",
  description:
    "Catalogo dei simboli del genogramma clinico secondo la nomenclatura NSGC (2008, rivista nel 2022 e corretta nel 2025).",
  alternates: { canonical: "/simboli" },
};

export default function SimboliPage() {
  const sections = buildCatalog();
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Riferimento"
        title="Simboli del genogramma"
        description="Ogni voce della nomenclatura standardizzata NSGC disegnata dallo stesso motore usato dallo strumento. Esempi sintetici, nessun dato reale."
      />
      <nav aria-label="Sezioni del catalogo" className="mt-6 flex flex-wrap gap-1.5 text-sm">
        {sections.map((s) => (
          <a key={s.key} href={`#${s.key}`} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900">
            {s.title}
          </a>
        ))}
      </nav>
      {sections.map((section) => (
        <section key={section.key} id={section.key} className="mt-14 scroll-mt-20">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-neutral-900">{section.title}</h2>
          {section.intro ? <p className="mt-1 text-sm text-neutral-600">{section.intro}</p> : null}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.entries.map((entry) => {
              const rendered = renderPedigree(entry.pedigree, { idPrefix: `${entry.key}-`, margin: 12 });
              const wide = rendered.width > 380;
              return (
                <figure
                  key={entry.key}
                  className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-xs ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}
                >
                  <div className="overflow-x-auto">
                    <SvgTree
                      node={rendered.svg}
                      title={entry.title}
                      className="mx-auto h-auto max-w-full"
                    />
                  </div>
                  {entry.title ? (
                    <figcaption className="mt-2 border-t border-neutral-100 pt-2 text-sm">
                      <span className="font-medium text-neutral-900">{entry.title}</span>
                      {entry.note ? <span className="block text-neutral-600">{entry.note}</span> : null}
                    </figcaption>
                  ) : null}
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </PageContainer>
  );
}
