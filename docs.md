# Clinical Genogram — Codebase Documentation

## Project Structure

```
index.html          ← Single HTML page (UI shell)
style.css           ← All visual styles
js/
  parser.js         ← Reads CSV files into data objects
  graph.js          ← Builds the family-graph data structure
  patterns.js       ← Manages condition patterns and colors
  renderer.js       ← Orchestrates the full render pipeline
  export.js         ← PNG export and CSV download
  main.js           ← App entry point, event listeners, settings
  renderer/         ← Renderer pipeline sub-modules
    pickers.js
    legend.js
    svg-patterns.js
    layout.js
    node-decorations.js
  ui/               ← User-interface sub-modules
    table.js
    modals.js
    wizard.js
```

---

## File-by-File Guide

### `index.html`
The entire app lives in this one HTML page. It defines the sidebar (with controls, settings, the data table, and legend), the SVG canvas where the genogram is drawn, and all the modal dialogs (edit person, add related, setup wizard).

---

### `style.css`
Contains all the visual styling — layout, colours, panels, sliders, modal dialogs, and the legend. Nothing functional here, purely presentation.

---

### `js/parser.js`
Reads a CSV text string (semicolon-delimited) and converts it into a flat dictionary of individuals. Handles quoted fields and multi-condition values. Called once when the user uploads a file.

---

### `js/graph.js`
Takes the flat dictionary of individuals and builds the family relationships:
- Groups people into **family units** (couple + their children)
- Calculates a numeric **value** for every individual based on their distance from the patient — this drives the left-to-right ordering in the layout

---

### `js/patterns.js`
Manages the visual representation of medical conditions. Keeps track of which **pattern** (grayscale mode) or **colour** (colour mode) is assigned to each condition. Also exposes the list of all available patterns and colours for the picker modals.

---

### `js/renderer.js`
The **orchestrator** for the entire rendering pipeline. When called, it:
1. Reads the current display settings
2. Builds the dagre-d3 graph (nodes + edges)
3. Calls each renderer sub-module in order
4. Sets up zoom and pan behaviour

It doesn't do the heavy work itself — it delegates to the files inside `js/renderer/`.

---

### `js/renderer/legend.js`
Draws the condition legend in the sidebar. In grayscale mode, each entry shows a clickable pattern thumbnail; in colour mode, a clickable colour swatch. Clicking opens the corresponding picker.

---

### `js/renderer/pickers.js`
The floating modal dialogs that let you reassign a **pattern** or **colour** to a condition. Clicking a swatch/pattern in the legend opens one of these. Selecting a new option triggers a graph redraw.

---

### `js/renderer/svg-patterns.js`
Creates the SVG `<defs>` entries needed for grayscale fills. Three types:
- **Base patterns** — one per unique condition pattern image
- **Wrapper patterns** — base pattern layered over a white background (used by single-condition nodes)
- **Composite patterns** — multiple base patterns stacked (used by multi-condition nodes)

---

### `js/renderer/layout.js`
Three post-layout corrections that dagre can't do on its own:

- **`fixCoupleAdjacency`** — ensures husband and wife are always drawn next to each other with no intruding nodes between them
- **`overrideEdgePaths`** — replaces dagre's curved edges with clean orthogonal (right-angle) lines
- **`drawFertilitySymbols`** — draws the standard genogram symbols for infertile couples (double bar) and couples who chose not to have children (single bar)

---

### `js/renderer/node-decorations.js`
Adds all the visual extras on top of the basic node shapes after layout:
- Oblique line through dead individuals
- Horizontal line above the shape for genetic testing
- Arrow pointing to the proband/patient
- Name, condition, and notes text labels (optional, toggled from the sidebar)
- Click handler that opens the edit modal

---

### `js/export.js`
Two download functions:
- **`exportToPng`** — flattens the current SVG view (with legend) onto a canvas and downloads it as a PNG image
- **`downloadCsv`** — serialises the current data table back to a semicolon-delimited CSV file

---

### `js/main.js`
The **entry point**. On page load it wires up all the event listeners (sliders, buttons, checkboxes, file upload, zoom controls, the sidebar resizer, collapsible panels) and opens the setup wizard. Also holds `updateGraph()` — the function that re-reads the table and redraws everything — and `processData()` which runs after a CSV is loaded.

---

### `js/ui/table.js`
Everything related to the editable data table in the sidebar:
- **`addTableRow`** — appends one individual as a new editable row
- **`populateTable`** — fills the whole table from a parsed data set
- **`getTableData`** — reads the current table rows back into a data dictionary (used before every redraw)

---

### `js/ui/modals.js`
The **Edit Person** and **Add Related** modal dialogs:
- Opening them pre-fills form fields from the data table
- Saving writes the changes back to the table and triggers a redraw
- Handles ID uniqueness checks and cascade-renames role references when a person's ID changes

---

### `js/ui/wizard.js`
The **Setup Wizard** that appears on first load. Lets the clinician quickly scaffold a family tree by specifying numbers of siblings, children, and how many generations to include (parents only / grandparents / great-grandparents). Generates the corresponding table rows and triggers a first draw.
