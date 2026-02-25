// ===== Genogram Renderer =====
// Orchestrates: graph creation → legend → pattern defs → dagre render
//               → post-layout fixes → zoom setup.
// Heavy lifting is delegated to renderer/ submodules.

if (typeof window.PatternManager === 'undefined') {
    console.error('[Renderer] CRITICAL: PatternManager class not found! patterns.js must be loaded first.');
}

async function renderGenogram(data) {
    const { individuals, families } = data;

    // Ensure PatternManager instance exists
    if (!window.patternManager) {
        if (typeof window.PatternManager !== 'undefined') {
            window.patternManager = new window.PatternManager();
        } else {
            console.error('[Renderer] CRITICAL: PatternManager class not found!');
            return;
        }
    }

    // --- Read settings ---
    const nodeSep      = window.genogramSettings ? parseInt(window.genogramSettings.nodeSep)      : 50;
    const rankSep      = window.genogramSettings ? parseInt(window.genogramSettings.rankSep)      : 50;
    const fontSize     = window.genogramSettings ? parseInt(window.genogramSettings.fontSize)     : 12;
    const textDist     = window.genogramSettings ? parseInt(window.genogramSettings.textDist)     : 10;
    const fontFamily   = window.genogramSettings ? window.genogramSettings.fontFamily             : 'Inter';
    const noteMaxWidth = window.genogramSettings ? parseInt(window.genogramSettings.noteMaxWidth) : 150;
    const nodeSize     = window.genogramSettings ? parseInt(window.genogramSettings.nodeSize)     : 40;
    const isGrayscale  = window.grayscaleMode || false;

    // --- Build dagre graph ---
    const g = new dagreD3.graphlib.Graph()
        .setGraph({ rankdir: 'TB', nodesep: nodeSep, ranksep: rankSep, marginx: 20, marginy: 20 })
        .setDefaultEdgeLabel(function() { return {}; });

    // --- Collect unique conditions ---
    const allConditions = Object.values(individuals).flatMap(i => {
        if (Array.isArray(i.condition)) return i.condition;
        if (i.condition && i.condition !== 'None' && i.condition !== '') return [i.condition];
        return [];
    });
    const conditions = [...new Set(allConditions)].filter(c => c !== 'None' && c !== '');

    window.patternManager.initColorScale(conditions);

    // --- Render legend (submodule) ---
    renderLegend(conditions, isGrayscale);

    // --- Shape helper ---
    const getShape = (sex) => {
        if (sex === 'M')        return 'rect';
        if (sex === 'F')        return 'circle';
        if (sex === 'Abortion') return 'triangle';
        return 'diamond'; // Unknown
    };

    // Sort individuals descending by value for consistent left-to-right ordering
    const sortedIndividuals = Object.values(individuals).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    // --- Add individual nodes to graph ---
    sortedIndividuals.forEach(ind => {
        const shape           = getShape(ind.sex);
        const indConditions   = Array.isArray(ind.condition) ? ind.condition : (ind.condition ? [ind.condition] : []);
        const validConditions = indConditions.filter(c => c && c !== 'None' && c !== '');

        let fillStyle;
        if (isGrayscale) {
            if (validConditions.length === 1) {
                const basePatternId = window.patternManager.getPatternForCondition(validConditions[0]);
                fillStyle = `fill: url(#${basePatternId}-with-bg); stroke: #333; stroke-width: 2px;`;
            } else if (validConditions.length > 1) {
                const compositePatternId  = `composite-${ind.id}`;
                ind._compositePatternId   = compositePatternId;
                ind._validConditions      = validConditions;
                fillStyle = `fill: url(#${compositePatternId}); stroke: #333; stroke-width: 2px;`;
            } else {
                fillStyle = 'fill: #fff; stroke: #333; stroke-width: 2px;';
            }
        } else {
            const color = validConditions.length > 0
                ? window.patternManager.getColorForCondition(validConditions[0])
                : '#fff';
            fillStyle = `fill: ${color}; stroke: #333; stroke-width: 2px;`;
        }

        if (ind.wasAdopted) fillStyle += ' stroke-dasharray: 8,4;';

        g.setNode(ind.id, {
            label:      '',
            shape,
            style:      fillStyle,
            width:      nodeSize,
            height:     nodeSize,
            labelStyle: 'font-size: 10px; font-weight: bold;',
            // Extra data for post-processing
            dead:              ind.dead,
            isPatient:         ind.isPatient,
            notes:             ind.notes,
            idText:            ind.id,
            value:             ind.value,
            condition:         ind.condition,
            geneticTesting:    ind.geneticTesting,
            infertile:         ind.infertile,
            noChildrenByChoice: ind.noChildrenByChoice,
            wasAdopted:        ind.wasAdopted
        });
    });

    // --- Add family (couple) nodes and edges ---
    families.forEach(fam => {
        const coupleNodeId = fam.id;
        const childHubId   = `hub_${fam.id}`;

        if (fam.father && fam.mother) {
            // Invisible couple midpoint node
            g.setNode(coupleNodeId, {
                shape: 'circle', label: '', width: 0, height: 0,
                style: 'fill: none; stroke: none;', isCoupleNode: true
            });

            // Connect both partners to the couple node (high weight keeps them adjacent)
            g.setEdge(fam.father, coupleNodeId, {
                arrowhead: 'undirected',
                style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                minlen: 1, weight: 100, isCoupleEdge: true
            });
            g.setEdge(fam.mother, coupleNodeId, {
                arrowhead: 'undirected',
                style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                minlen: 1, weight: 100, isCoupleEdge: true
            });

            if (fam.children.length > 0) {
                // Child hub below the couple node for clean sibling distribution
                g.setNode(childHubId, {
                    shape: 'circle', label: '', width: 0, height: 0,
                    style: 'fill: none; stroke: none;', isChildHub: true
                });
                g.setEdge(coupleNodeId, childHubId, {
                    arrowhead: 'undirected',
                    style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                    minlen: 1, weight: 10
                });
                fam.children.forEach((childId, index) => {
                    g.setEdge(childHubId, childId, {
                        arrowhead: 'undirected',
                        style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                        weight: fam.children.length - index
                    });
                });
            }
        } else {
            // Single-parent family
            g.setNode(coupleNodeId, {
                shape: 'circle', label: '', width: 0, height: 0,
                style: 'fill: none; stroke: none;'
            });
            const parentId = fam.father || fam.mother;
            if (parentId) {
                g.setEdge(parentId, coupleNodeId, {
                    arrowhead: 'undirected',
                    style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                    weight: 5
                });
            }
            fam.children.forEach((childId, index) => {
                g.setEdge(coupleNodeId, childId, {
                    arrowhead: 'undirected',
                    style: 'stroke: #333; stroke-width: 1.5px; fill: none;',
                    weight: fam.children.length - index
                });
            });
        }
    });

    // --- Set up dagre-d3 renderer with custom triangle shape ---
    const render = new dagreD3.render();
    render.shapes().triangle = function(parent, bbox, node) {
        const w = bbox.width, h = bbox.height;
        const points = [
            { x: 0,    y: -h / 2 },
            { x: -w / 2, y: h / 2 },
            { x:  w / 2, y: h / 2 }
        ];
        const shapeSvg = parent.insert('polygon', ':first-child')
            .attr('points', points.map(d => `${d.x},${d.y}`).join(' '));
        node.intersect = function(point) {
            return dagreD3.intersect.polygon(node, points, point);
        };
        return shapeSvg;
    };

    // --- Clear SVG and add <defs> ---
    const svg = d3.select('#genogram');
    svg.html('');
    const defs = svg.append('defs');

    // Create SVG pattern definitions (grayscale only, async)
    await createSVGPatternDefs(defs, conditions, sortedIndividuals, isGrayscale);

    // --- Render graph ---
    const svgGroup = svg.append('g');
    render(svgGroup, g);

    // --- Post-layout corrections ---
    fixCoupleAdjacency(g, families, nodeSep, svgGroup);
    overrideEdgePaths(svgGroup, g, families);
    decorateNodes(svgGroup, g, { fontSize, fontFamily, noteMaxWidth, textDist });
    drawFertilitySymbols(svgGroup, g, families, sortedIndividuals);

    // --- Center graph and set up zoom ---
    const svgWidth       = svg.node().getBoundingClientRect().width;
    const xCenterOffset  = (svgWidth - g.graph().width) / 2;
    const initialTransform = d3.zoomIdentity.translate(xCenterOffset, 20);

    svgGroup.attr('transform', initialTransform);

    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', function() {
            svgGroup.attr('transform', d3.event.transform);
            updateZoomLevel(d3.event.transform.k);
        });

    svg.call(zoom)
       .call(zoom.transform, initialTransform)
       .on('dblclick.zoom', null); // Disable double-click zoom

    // Store references for zoom button controls
    window.currentZoom      = zoom;
    window.currentSvg       = svg;
    window.currentSvgGroup  = svgGroup;
    window.initialTransform = initialTransform;

    updateZoomLevel(1);
}

// Make renderGenogram available globally
window.renderGenogram = renderGenogram;

function updateZoomLevel(scale) {
    const el = document.getElementById('zoomLevel');
    if (el) el.textContent = Math.round(scale * 100) + '%';
}
