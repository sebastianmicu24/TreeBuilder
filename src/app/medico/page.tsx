import type { Metadata } from "next";
import { DoctorEditor } from "@/components/genogramma/doctor-editor";

export const metadata: Metadata = {
  title: "Editor clinico",
  description:
    "Editor clinico del genogramma con nomenclatura NSGC: wizard, legenda con codici, valutazioni, export per la ricerca. Nessun account; i dati restano sul dispositivo.",
  alternates: { canonical: "/medico" },
};

/** Editor clinico, pubblico: nessun login, nessuna dipendenza dalla sessione. */
export default function MedicoPage() {
  return <DoctorEditor />;
}
