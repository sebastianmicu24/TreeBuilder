// ===== SVG Export =====

function exportSVG() {
    const svg = document.querySelector('#genogram');
    const contentGroup = svg.querySelector('g');

    // Get the bounding box of the content (untransformed)
    const bbox = contentGroup.getBBox();

    // Clone content with transform reset for export
    const clone = contentGroup.cloneNode(true);
    clone.setAttribute('transform', '');

    // --- Build Legend SVG ---
    const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const legendItems = document.querySelectorAll('#legend .legend-item');
    let legendHeight = 0;
    const legendWidth = 200;

    const exportFontFamily = window.genogramSettings ? window.genogramSettings.fontFamily : 'Inter';

    // Title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.textContent = 'Clinical Genogram';
    title.setAttribute('x', 0);
    title.setAttribute('y', 0);
    title.setAttribute('font-family', exportFontFamily);
    title.setAttribute('font-size', '18px');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#1e293b');
    legendGroup.appendChild(title);
    legendHeight += 30;

    let yOffset = legendHeight;
    legendItems.forEach(item => {
        const colorDiv  = item.querySelector('.legend-color');
        const textSpan  = item.querySelector('span');
        const color     = colorDiv.style.backgroundColor;
        const text      = textSpan.textContent;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', yOffset - 10);
        rect.setAttribute('width', 12);
        rect.setAttribute('height', 12);
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', '#333');
        rect.setAttribute('stroke-width', '1');

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.textContent = text;
        textEl.setAttribute('x', 20);
        textEl.setAttribute('y', yOffset);
        textEl.setAttribute('font-family', exportFontFamily);
        textEl.setAttribute('font-size', '12px');
        textEl.setAttribute('fill', '#333');

        legendGroup.appendChild(rect);
        legendGroup.appendChild(textEl);
        yOffset += 20;
    });
    legendHeight = yOffset;

    // Position legend above the genogram
    const gap = 40;
    legendGroup.setAttribute('transform', `translate(${bbox.x}, ${bbox.y - legendHeight - gap})`);

    // --- Create Export SVG ---
    const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const padding = 40;

    const minX   = bbox.x;
    const minY   = bbox.y - legendHeight - gap;
    const width  = Math.max(bbox.width, legendWidth);
    const height = (bbox.y + bbox.height) - minY;

    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;
    const viewBoxW = width + padding * 2;
    const viewBoxH = height + padding * 2;

    exportSvg.setAttribute('width',   viewBoxW);
    exportSvg.setAttribute('height',  viewBoxH);
    exportSvg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`);
    exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add a white background rect
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', viewBoxX);
    bgRect.setAttribute('y', viewBoxY);
    bgRect.setAttribute('width', viewBoxW);
    bgRect.setAttribute('height', viewBoxH);
    bgRect.setAttribute('fill', '#ffffff');
    exportSvg.appendChild(bgRect);

    // Copy defs (patterns, markers, etc.) from the original SVG
    const originalDefs = svg.querySelector('defs');
    if (originalDefs) {
        exportSvg.appendChild(originalDefs.cloneNode(true));
    }

    // Embed CSS styles
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        svg {
            font-family: '${exportFontFamily}', sans-serif;
        }
        .node rect, .node circle, .node polygon, .node ellipse {
            stroke: #1e293b;
            stroke-width: 2px;
            fill: white;
        }
        .node text {
            font-family: '${exportFontFamily}', sans-serif;
            fill: #1e293b;
        }
        .edgePath path {
            stroke: #1e293b;
            stroke-width: 1.5px;
            fill: none;
        }
        .dead-marker {
            stroke: #1e293b;
            stroke-width: 2px;
        }
        text {
            font-family: '${exportFontFamily}', sans-serif;
        }
    `;
    exportSvg.appendChild(styleElement);

    exportSvg.appendChild(legendGroup);
    
    // We need to ensure that the cloned nodes retain their inline styles (like fill: url(#pattern))
    // The cloneNode(true) already does this for inline styles, but we need to make sure
    // the pattern URLs are correctly referenced. Since we copied the defs into the same SVG,
    // the local references like url(#pattern-id) will work correctly.
    exportSvg.appendChild(clone);

    // Serialize to data URL
    const serializer   = new XMLSerializer();
    const source       = serializer.serializeToString(exportSvg);
    const sourceWithXml = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    return sourceWithXml;
}
