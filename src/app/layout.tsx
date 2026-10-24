import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const description =
  "Disegna il genogramma (albero genealogico clinico) con la nomenclatura internazionale NSGC. Per medici, genetisti e famiglie, senza registrazione: i dati restano sul dispositivo.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sebastianmicu24.com"),
  title: { default: "TreeBuilder — Genogramma clinico NSGC", template: "%s · TreeBuilder" },
  description,
  applicationName: "TreeBuilder",
  openGraph: { type: "website", locale: "it_IT", siteName: "TreeBuilder", title: "TreeBuilder — Genogramma clinico NSGC", description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-neutral-50 font-sans text-neutral-800 antialiased">
        <a
          href="#contenuto"
          className="sr-only rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Salta al contenuto
        </a>
        <SiteHeader />
        <main id="contenuto" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
