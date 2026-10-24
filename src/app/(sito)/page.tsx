import Link from "next/link";
import { ArrowRight, FileDown, Layers, ShieldCheck, Stethoscope, Users } from "lucide-react";
import { StartLocal } from "@/components/genogramma/start-local";

const card =
  "group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md";

const FEATURES = [
  {
    icon: Layers,
    title: "Nomenclatura NSGC",
    text: "Simboli, linee e legenda secondo le raccomandazioni 2022 e la correzione 2025: genere, ART, gemelli, gravidanze, consanguineità.",
  },
  {
    icon: ShieldCheck,
    title: "Solo sul dispositivo",
    text: "Nessun account, nessun server, nessuna telemetria. Le bozze restano nel browser e si cancellano con un clic.",
  },
  {
    icon: FileDown,
    title: "Export per clinica e ricerca",
    text: "SVG, PNG, PDF e formati compatibili con Office; PED, Phenopackets, GA4GH, FHIR e CSV per la ricerca.",
  },
];

/** Pagina iniziale: scelta del percorso, bozze locali, caratteristiche. */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Genogramma clinico</p>
      <h1 className="mt-3 max-w-3xl text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.035em] text-neutral-950 sm:text-[3.25rem]">
        L&apos;albero genealogico clinico, disegnato secondo gli standard.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
        Per genetisti, pediatri e famiglie. Il disegno si dispone da solo, segue la simbologia NSGC e resta sul tuo
        dispositivo.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Link href="/medico" className={card}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Stethoscope className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-neutral-900">Editor clinico</h2>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-600">
            Per medici e ricercatori: wizard rapido, scheda di ogni familiare, condizioni con codici HPO/ORPHA/OMIM/ICD,
            test genetici, tabella e tutti gli export.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            Apri l&apos;editor <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
        <Link href="/paziente" className={card}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Users className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-neutral-900">Per pazienti e famiglie</h2>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-600">
            Domande semplici sulla famiglia, con &quot;Non lo so&quot; sempre possibile. Alla fine ottieni il disegno e un
            file da consegnare al medico.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900">
            Inizia il questionario <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </div>

      <div className="mt-6">
        <StartLocal />
      </div>

      <section aria-label="Caratteristiche" className="mt-16 grid gap-8 border-t border-neutral-200 pt-10 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <f.icon className="h-5 w-5 text-neutral-400" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-semibold text-neutral-900">{f.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
