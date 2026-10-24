# TreeBuilder — clinical genogram (NSGC)

Draws clinical pedigrees/genograms following the NSGC standardized nomenclature
(2008, revised 2022, corrected 2025). Live at https://www.sebastianmicu.com.

- **Editor clinico** (`/medico`): quick wizard, per-member panel, conditions with
  HPO/ORPHA/OMIM/ICD codes, genetic tests (E notation), table, legend, metadata,
  display settings, undo/redo, drag to reorder siblings.
- **Per pazienti** (`/paziente`): guided questionnaire for patients and families,
  ending with a drawing and a file to hand to the clinician.
- **Simboli** (`/simboli`): catalogue of every NSGC symbol, drawn by the same engine.
- Import/export: native JSON, GA4GH Pedigree, Phenopackets v2, PED, CSV, FHIR
  (experimental), GEDCOM import; SVG, PNG, print/PDF, Office-compatible SVG.

## Privacy by design

Everything runs in the browser. No account, no server code, no telemetry; drafts
live in IndexedDB and can be wiped from the UI. A site-wide Content-Security-Policy
(`connect-src 'self'`, `form-action 'none'`) blocks any outbound request, and
`src/lib/genogramma/__tests__/no-network.test.ts` fails if network APIs appear.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # vitest: model, layout, renderer, import/export, no-network
npm run lint
npm run build
```

Layout and rendering are written from scratch (`src/lib/genogramma/layout`,
`src/lib/genogramma/render`); see `src/lib/genogramma/SCHEMA.md` for the data model.
Stack: Next.js 16 (App Router, fully static), React 19, Tailwind CSS 4.
