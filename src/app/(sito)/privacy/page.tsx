import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Come TreeBuilder tratta i dati: il genogramma si elabora solo nel browser e il sito non riceve nulla.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow="Informazioni" title="Privacy" description="In breve: quello che inserisci nel genogramma non lascia il tuo dispositivo." />
      <div className="prose-page mt-8">
        <h2>Dati inseriti nello strumento</h2>
        <p>
          Un genogramma può contenere dati relativi alla salute e dati genetici tuoi e dei tuoi familiari (categorie
          particolari di dati, art. 9 GDPR). Per scelta di progetto questi dati sono elaborati{" "}
          <strong>esclusivamente nel browser del tuo dispositivo</strong>:
        </p>
        <ul>
          <li>
            il sito non riceve, non trasmette, non registra e non conserva alcun dato inserito nello strumento, nemmeno in
            forma aggregata o anonimizzata; non ci sono statistiche, telemetria o strumenti di analisi;
          </li>
          <li>
            la ricerca di condizioni e codici (HPO, ORPHA, OMIM, ICD) avviene su un vocabolario incluso nella pagina, senza
            richieste in rete;
          </li>
          <li>
            una Content-Security-Policy impedisce alla pagina di collegarsi a qualunque indirizzo diverso dal sito stesso, e
            nessun dato del genogramma finisce nell&apos;indirizzo della pagina;
          </li>
          <li>
            il passaggio del genogramma tra paziente e medico avviene solo tramite un file che crei sul tuo dispositivo e
            consegni tu;
          </li>
          <li>non serve alcun account.</li>
        </ul>

        <h2>Memoria del browser</h2>
        <p>
          Le bozze si salvano automaticamente nella memoria locale del browser (IndexedDB, database{" "}
          <code>treebuilder-genogramma</code>). Due voci di <code>localStorage</code>/<code>sessionStorage</code> ricordano
          la modalità &quot;non salvare&quot; e quale bozza riaprire. Non sono cookie e non vengono inviate al sito. Puoi
          disattivare il salvataggio (modalità per dispositivi condivisi) e cancellare tutto con il pulsante &quot;Cancella
          tutti i dati locali&quot;.
        </p>
        <p>Il sito non usa cookie.</p>

        <h2>Hosting</h2>
        <p>
          Il sito è ospitato da Vercel Inc. Come per qualunque sito, il fornitore di hosting tratta i dati tecnici
          necessari a consegnare le pagine e a proteggerle da abusi (indirizzo IP, data e ora, pagina richiesta, browser).
          Queste richieste riguardano solo i file del sito, mai il contenuto del genogramma.
        </p>

        <h2>Responsabilità dei file</h2>
        <p>
          Chi usa lo strumento resta responsabile dei file che esporta e condivide. Consigliamo di usare iniziali e anni di
          nascita invece di nomi e date complete; l&apos;export offre l&apos;opzione per rimuovere i dati identificativi.
        </p>
      </div>
    </PageContainer>
  );
}
