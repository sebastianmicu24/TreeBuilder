import { describe, expect, it } from "vitest";
import { conditionsAndEvaluations, FIXTURES, hostileText, largeFamily } from "../__fixtures__";
import { buildCatalog } from "../catalog";
import { updateDisplay } from "../model/commands";
import { formatCode } from "../render/legend";
import { renderPedigree } from "../render/render";
import { escapeXml, serialize, toSvgDocument } from "../render/serialize";
import { clipSegment, sectorPolygon, shapePolygon } from "../render/geometry";

describe("renderer SVG", () => {
  it.each(Object.entries({ ...FIXTURES, largeFamily: () => largeFamily() }))(
    "%s: SVG valido, deterministico, autosufficiente",
    (_n, make) => {
      const a = serialize(renderPedigree(make()).svg);
      const b = serialize(renderPedigree(make()).svg);
      expect(a).toBe(b);
      expect(a).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(a).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(a).not.toMatch(/foreignObject|class=|<style|xlink:href|https?:\/\/(?!www\.w3\.org)/);
      expect(a).not.toMatch(/NaN|Infinity/);
    }
  );

  it("fa l'escape di tutto il testo dell'utente", () => {
    const svg = serialize(renderPedigree(updateDisplay(hostileText(), { showNotes: true, showLabel: true })).svg);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<svg onload");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;script&gt;");
    expect(escapeXml(`a"b'c<d>&`)).toBe("a&quot;b&apos;c&lt;d&gt;&amp;");
  });

  it("rifiuta tag e attributi non validi (nessun gestore di eventi)", () => {
    expect(() => serialize({ tag: "g", attrs: { onload: "x" }, children: [] })).toThrow();
    expect(() => serialize({ tag: "g x", attrs: {}, children: [] })).toThrow();
  });

  it("modalità Office: tratteggi come linee, nessun <pattern>", () => {
    const ped = conditionsAndEvaluations();
    const normal = serialize(renderPedigree(ped).svg);
    const office = serialize(renderPedigree(ped, { office: true }).svg);
    expect(normal).toContain("<pattern");
    expect(office).not.toContain("<pattern");
    expect(office).not.toContain("url(#");
    expect(toSvgDocument(renderPedigree(ped, { office: true }).svg)).toMatch(/^<\?xml/);
  });

  it("export senza attributi interattivi; vista con data-gid e ARIA", () => {
    const ped = conditionsAndEvaluations();
    expect(serialize(renderPedigree(ped).svg)).not.toContain("data-gid");
    const interactive = serialize(renderPedigree(ped, { interactive: true }).svg);
    expect(interactive).toContain(`data-gid="${ped.proband}"`);
    expect(interactive).toContain("aria-label");
  });

  it("legenda in una sola lingua per disegno", () => {
    const it = serialize(renderPedigree(conditionsAndEvaluations()).svg);
    const en = serialize(renderPedigree(updateDisplay(conditionsAndEvaluations(), { language: "en" })).svg);
    expect(it).toContain("Legenda");
    expect(it).not.toContain(">Legend<");
    expect(en).toContain(">Legend<");
    expect(en).not.toContain("Legenda");
  });

  it("bianco e nero di default; colori solo su richiesta", () => {
    const bw = serialize(renderPedigree(conditionsAndEvaluations()).svg);
    const color = serialize(renderPedigree(updateDisplay(conditionsAndEvaluations(), { color: true })).svg);
    expect(bw).not.toContain("#ae1c33");
    expect(color).toContain("#ae1c33");
  });

  it("formatta i codici delle condizioni", () => {
    expect(formatCode({ system: "HPO", code: "HP:0001639" })).toBe("HP:0001639");
    expect(formatCode({ system: "ORPHA", code: "586" })).toBe("ORPHA:586");
    expect(formatCode({ system: "ICD10", code: "C50" })).toBe("ICD-10 C50");
  });
});

describe("geometria dei riempimenti", () => {
  it("i settori coprono il simbolo senza sovrapporsi", () => {
    const poly = shapePolygon("square", 0, 0, 40);
    const area = (p: [number, number][]) =>
      Math.abs(p.reduce((acc, [x, y], i) => acc + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y, 0)) / 2;
    for (const count of [1, 2, 4, 5, 6]) {
      let total = 0;
      for (let i = 0; i < count; i++) total += area(sectorPolygon(poly, [0, 0], i, count));
      expect(total).toBeCloseTo(1600, 0);
    }
  });

  it("ritaglia i segmenti di tratteggio sul contorno", () => {
    const poly = shapePolygon("square", 0, 0, 40);
    expect(clipSegment([-100, 0], [100, 0], poly)).toEqual([
      [-20, 0],
      [20, 0],
    ]);
    expect(clipSegment([-100, 50], [100, 50], poly)).toBeNull();
  });
});

describe("pagina-catalogo", () => {
  it("disegna tutte le voci senza errori", () => {
    const sections = buildCatalog();
    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const s of sections) for (const e of s.entries) expect(() => renderPedigree(e.pedigree)).not.toThrow();
  });
});
