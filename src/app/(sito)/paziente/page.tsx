import type { Metadata } from "next";
import { PatientApp } from "@/components/genogramma/patient-flow/patient-app";

export const metadata: Metadata = {
  title: "Genogramma per pazienti e famiglie",
  description:
    "Rispondi a qualche domanda sulla tua famiglia e ottieni il genogramma da portare al medico. Nessuna registrazione: i dati restano sul tuo dispositivo.",
  alternates: { canonical: "/paziente" },
};

/** Percorso paziente: pubblico, nessuna dipendenza dalla sessione. */
export default function PazientePage() {
  return <PatientApp />;
}
