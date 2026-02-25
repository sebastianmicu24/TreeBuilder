// ===== Post-Layout: Node Decorations =====
// Adds visual markers and text labels to each rendered node:
//   - Genetic testing line (above node)
//   - Dead marker (oblique line through node)
//   - Patient/proband arrow
//   - Name, condition and notes text labels
//   - Click handler to open edit modal

function decorateNodes(svgGroup, g, settings) {
    const { fontSize, fontFamily, noteMaxWidth, textDist } = settings;
    const lineHeight = fontSize * 1.2;

    svgGroup.selectAll('g.node').each(function(v) {
        const node = g.node(v);
        const el   = d3.select(this);

        // --- Genetic Testing: horizontal line above shape ---
        if (node.geneticTesting) {
            const lineOffset = window.genogramSettings ? parseInt(window.genogramSettings.geneticTestOffset) : 8;
            const lineWidth  = window.genogramSettings ? parseInt(window.genogramSettings.geneticTestWidth)  : 2;
            const lineY      = -node.height / 2 - lineOffset;

            el.append('line')
                .attr('x1', -node.width / 2).attr('y1', lineY)
                .attr('x2',  node.width / 2).attr('y2', lineY)
                .attr('class', 'genetic-testing-marker')
                .style('stroke-width', lineWidth + 'px')
                .style('stroke', '#000');
        }

        // --- Dead Marker: single oblique line from bottom-left to top-right ---
        if (node.dead) {
            const padding = 9; // Extra reach to fully cross node border
            el.append('line')
                .attr('x1', -node.width / 2 - padding).attr('y1',  node.height / 2 + padding)
                .attr('x2',  node.width / 2 + padding).attr('y2', -node.height / 2 - padding)
                .attr('class', 'dead-marker')
                .style('stroke-width', '2px')
                .style('stroke', '#000');
        }

        // --- Patient/Proband Arrow: 45° arrow pointing to bottom-left corner ---
        if (node.isPatient) {
            const arrowLength = 30;
            const cornerX = -node.width / 2 - 15;
            const cornerY =  node.height / 2 + 15;
            const startX  = cornerX - arrowLength * Math.cos(Math.PI / 4);
            const startY  = cornerY + arrowLength * Math.sin(Math.PI / 4);

            el.append('line')
                .attr('x1', startX).attr('y1', startY)
                .attr('x2', cornerX).attr('y2', cornerY)
                .attr('stroke', '#000')
                .attr('stroke-width', 2)
                .attr('marker-end', 'url(#arrowhead)');

            // Ensure arrowhead marker is defined in defs (add once)
            const defs = d3.select('#genogram defs');
            if (defs.select('#arrowhead').empty()) {
                defs.append('marker')
                    .attr('id', 'arrowhead')
                    .attr('markerWidth', 10)
                    .attr('markerHeight', 10)
                    .attr('refX', 9)
                    .attr('refY', 3)
                    .attr('orient', 'auto')
                    .append('polygon')
                    .attr('points', '0 0, 10 3, 0 6')
                    .attr('fill', '#000');
            }
        }

        // --- Text Labels ---
        let currentYOffset = 0;
        const xLeft  = -node.width / 2 - textDist;
        const xRight =  node.width / 2 + textDist;

        // Name (left side, bold)
        if (window.showNames && node.idText) {
            el.append('text')
                .attr('x', xLeft)
                .attr('y', currentYOffset)
                .text(node.idText)
                .style('font-size',    fontSize + 'px')
                .style('font-family',  fontFamily)
                .style('font-weight',  'bold')
                .style('text-anchor',  'end');
            currentYOffset += lineHeight;
        }

        // Condition(s) (left side, red)
        if (window.showConditions && node.condition) {
            const displayConditions = Array.isArray(node.condition) ? node.condition : [node.condition];
            const validConditions   = displayConditions.filter(c => c !== 'None' && c !== '');

            if (validConditions.length > 0) {
                el.append('text')
                    .attr('x', xLeft)
                    .attr('y', currentYOffset)
                    .text(validConditions.join(', '))
                    .style('font-size',   fontSize + 'px')
                    .style('font-family', fontFamily)
                    .style('text-anchor', 'end')
                    .style('fill', '#e11d48');
                currentYOffset += lineHeight;
            }
        }

        // Notes (right side, word-wrapped)
        if (window.showNotes && node.notes && node.notes !== 'None' && node.notes !== '') {
            const words      = node.notes.split(' ');
            let line         = '';
            let lineNumber   = 0;
            const textGroup  = el.append('g');

            words.forEach((word, i) => {
                const testLine = line + (line ? ' ' : '') + word;

                // Measure width using a temporary element
                const tempText = textGroup.append('text')
                    .attr('x', xRight).attr('y', 0)
                    .text(testLine)
                    .style('font-size',   fontSize + 'px')
                    .style('font-family', fontFamily)
                    .style('text-anchor', 'start');

                const textWidth = tempText.node().getComputedTextLength();
                tempText.remove();

                if (textWidth > noteMaxWidth && line !== '') {
                    // Flush current line and start a new one
                    textGroup.append('text')
                        .attr('x', xRight)
                        .attr('y', lineNumber * lineHeight)
                        .text(line)
                        .style('font-size',   fontSize + 'px')
                        .style('font-family', fontFamily)
                        .style('text-anchor', 'start');
                    line = word;
                    lineNumber++;
                } else {
                    line = testLine;
                }

                // Flush the final line
                if (i === words.length - 1) {
                    textGroup.append('text')
                        .attr('x', xRight)
                        .attr('y', lineNumber * lineHeight)
                        .text(line)
                        .style('font-size',   fontSize + 'px')
                        .style('font-family', fontFamily)
                        .style('text-anchor', 'start');
                }
            });
        }

        // --- Click handler: open edit modal ---
        el.style('cursor', 'pointer')
            .on('click', function() {
                openEditModal(v);
            });
    });
}
