import type { NextConfig } from "next";

/**
 * Content-Security-Policy dell'intero sito: i dati del genogramma sono
 * sanitari e genetici e non devono lasciare il browser. `connect-src` è la
 * vera barriera (nessuna richiesta verso domini esterni); `form-action
 * 'none'` impedisce invii di moduli. Niente nonce: sono incompatibili con il
 * prerendering statico, quindi script e stili inline restano ammessi.
 * In sviluppo servono 'unsafe-eval' (React) e ws: (HMR).
 */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  ["connect-src 'self'", ...(isDev ? ["ws:"] : [])].join(" "),
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    // Indirizzi della vecchia versione statica.
    return [{ source: "/index.html", destination: "/", permanent: true }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
