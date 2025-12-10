function renderGenogram(data) {
    const { individuals, families } = data;
    
    // Get settings
    const nodeSep = window.genogramSettings ? parseInt(window.genogramSettings.nodeSep) : 50;
    const rankSep = window.genogramSettings ? parseInt(window.genogramSettings.rankSep) : 50;
    const fontSize = window.genogramSettings ? parseInt(window.genogramSettings.fontSize) : 12;
    const textDist = window.genogramSettings ? parseInt(window.genogramSettings.textDist) : 10;

    // Create the graph
    const g = new dagreD3.graphlib.Graph()
        .setGraph({
            rankdir: 'TB',
            nodesep: nodeSep,
            ranksep: rankSep,
            marginx: 20,
            marginy: 20
        })
        .setDefaultEdgeLabel(function() { return {}; });

    // Define colors for conditions
    const conditions = [...new Set(Object.values(individuals).map(i => i.condition))].filter(c => c !== 'None' && c !== '');
    
    // Initialize pattern manager
    window.patternManager.initColorScale(conditions);
    
    // Check if grayscale mode is enabled
    const isGrayscale = window.grayscaleMode || false;

    // Render Legend
    const legend = d3.select("#legend");
    legend.html(""); // Clear existing
    
    if (isGrayscale) {
        // Grayscale legend with clickable items
        conditions.forEach(cond => {
            const patternId = window.patternManager.getPatternForCondition(cond);
            const item = legend.append("div")
                .attr("class", "legend-item")
                .style("cursor", "pointer")
                .on("click", function() {
                    // Change pattern for this condition
                    window.patternManager.changePattern(cond);
                    updateGraph();
                });
            
            const colorDiv = item.append("div").attr("class", "legend-color");
            colorDiv.style("background", window.patternManager.getPatternPreviewCSS(patternId));
            item.append("span").text(cond);
        });
        
        const noneItem = legend.append("div").attr("class", "legend-item");
        noneItem.append("div").attr("class", "legend-color")
            .style("background-color", "#fff")
            .style("border", "1px solid #333");
        noneItem.append("span").text("None/Healthy");
    } else {
        // Color legend
        conditions.forEach(cond => {
            const item = legend.append("div").attr("class", "legend-item");
            item.append("div")
                .attr("class", "legend-color")
                .style("background-color", window.patternManager.getColorForCondition(cond));
            item.append("span").text(cond);
        });
        
        const noneItem = legend.append("div").attr("class", "legend-item");
        noneItem.append("div").attr("class", "legend-color").style("background-color", "#fff");
        noneItem.append("span").text("None/Healthy");
    }


    // Register custom shapes
    // We wrap standard shapes to add the "Dead" line if needed
    const registerCustomShape = (shapeName, baseShape) => {
        g.setNode(shapeName, { shape: shapeName }); // Placeholder, actual registration below
    };

    // Helper to get shape based on sex
    const getShape = (sex) => {
        if (sex === 'M') return 'rect';
        if (sex === 'F') return 'circle';
        if (sex === 'Abortion') return 'triangle'; // Need to implement triangle
        return 'diamond'; // Unknown
    };

    // Sort individuals by their calculated value (descending) for consistent ordering
    // This ensures that males (higher values) appear on the left
    const sortedIndividuals = Object.values(individuals).sort((a, b) => {
        const aValue = a.value ?? 0;
        const bValue = b.value ?? 0;
        return bValue - aValue; // Descending order
    });

    // Add nodes for individuals in sorted order
    sortedIndividuals.forEach(ind => {
        const shape = getShape(ind.sex);
        let fillStyle;
        
        if (isGrayscale) {
            // Use patterns for grayscale mode
            if (ind.condition && ind.condition !== 'None') {
                const patternId = window.patternManager.getPatternForCondition(ind.condition);
                fillStyle = `fill: url(#${patternId}); stroke: #333; stroke-width: 2px;`;
            } else {
                fillStyle = `fill: #fff; stroke: #333; stroke-width: 2px;`;
            }
        } else {
            // Use colors for normal mode
            const color = (ind.condition && ind.condition !== 'None')
                ? window.patternManager.getColorForCondition(ind.condition)
                : '#fff';
            fillStyle = `fill: ${color}; stroke: #333; stroke-width: 2px;`;
        }
        
        // Get settings or defaults
        const nodeSize = window.genogramSettings ? parseInt(window.genogramSettings.nodeSize) : 40;
        
        // Create label showing the value
        const valueLabel = ind.value !== null && ind.value !== undefined
            ? ind.value.toFixed(2)
            : 'N/A';
        
        g.setNode(ind.id, {
            label: valueLabel, // Display value inside the shape
            shape: shape,
            style: fillStyle,
            width: nodeSize,
            height: nodeSize,
            labelStyle: "font-size: 10px; font-weight: bold;",
            // Custom data for post-processing
            dead: ind.dead,
            isPatient: ind.isPatient,
            notes: ind.notes,
            idText: ind.id, // Store ID to display outside if needed
            value: ind.value, // Store the calculated value for reference
            condition: ind.condition // Store condition for pattern application
        });
    });

    // Add nodes for families (marriage knots) and edges
    families.forEach(fam => {
        // Create a family node (invisible point)
        g.setNode(fam.id, {
            shape: 'circle',
            label: '',
            width: 0,
            height: 0,
            style: 'fill: none; stroke: none;'
        });

        // Edges from parents to family node
        if (fam.father) {
            g.setEdge(fam.father, fam.id, {
                arrowhead: 'undirected',
                style: "stroke: #333; stroke-width: 1.5px; fill: none;"
            });
        }
        if (fam.mother) {
            g.setEdge(fam.mother, fam.id, {
                arrowhead: 'undirected',
                style: "stroke: #333; stroke-width: 1.5px; fill: none;"
            });
        }

        // Edges from family node to children (already sorted by value in graph.js)
        // Add edges in order - dagre-d3 will try to maintain this order
        fam.children.forEach((childId, index) => {
            g.setEdge(fam.id, childId, {
                arrowhead: 'undirected',
                style: "stroke: #333; stroke-width: 1.5px; fill: none;",
                weight: fam.children.length - index // Higher weight for earlier children (higher values)
            });
        });
    });

    // Set ordering constraints for siblings based on their values
    // Group siblings by family and set their order
    families.forEach(fam => {
        if (fam.children.length > 1) {
            // Create ordering constraints between siblings
            for (let i = 0; i < fam.children.length - 1; i++) {
                const leftChild = fam.children[i];  // Higher value (should be on left)
                const rightChild = fam.children[i + 1];  // Lower value (should be on right)
                
                // Force ordering by setting an invisible edge with minlen
                // This is a hack but dagre doesn't have a direct "order" constraint
                // We'll rely on the weight in edges above instead
            }
        }
    });

    // Render
    const render = new dagreD3.render();
    
    // Custom shape handling for Triangle (Abortion) if not present
    render.shapes().triangle = function(parent, bbox, node) {
        const w = bbox.width,
              h = bbox.height,
              points = [
                  {x: 0, y: -h/2},
                  {x: -w/2, y: h/2},
                  {x: w/2, y: h/2}
              ];
        const shapeSvg = parent.insert("polygon", ":first-child")
            .attr("points", points.map(function(d) { return d.x + "," + d.y; }).join(" "));
            
        node.intersect = function(point) {
            return dagreD3.intersect.polygon(node, points, point);
        };
        return shapeSvg;
    };

    const svg = d3.select("#genogram");
    svg.html(""); // Clear previous render
    
    // Add defs for patterns before rendering (must be at SVG level)
    const defs = svg.append("defs");
    
    // Define patterns for different conditions (grayscale mode)
    if (isGrayscale) {
        conditions.forEach(cond => {
            const patternId = window.patternManager.getPatternForCondition(cond);
            window.patternManager.createSVGPattern(defs, patternId);
        });
    }
    
    const svgGroup = svg.append("g");

    render(svgGroup, g);

    // Post-processing: Override Edge Paths for strict orthogonal routing
    // We need to handle different types of connections:
    // 1. Parent -> Family Node (Marriage Line)
    // 2. Family Node -> Child (Offspring Line)
    
    svgGroup.selectAll("g.edgePath path").attr("d", function(d) {
        const source = g.node(d.v);
        const target = g.node(d.w);
        
        // Check if this is a connection to a family node (Parent -> Family)
        // Family nodes start with "fam_"
        const isToFamily = d.w.startsWith("fam_");
        const isFromFamily = d.v.startsWith("fam_");

        const startX = source.x;
        const startY = source.y + (source.height / 2); // Bottom of source
        const endX = target.x;
        const endY = target.y - (target.height / 2); // Top of target

        if (isToFamily) {
            // Parent to Family Node (Marriage)
            // Draw down, then horizontal to family node
            // We want: Parent -> Down -> Horizontal -> Family Node
            
            // Standard V-H-V
            const midY = (startY + endY) / 2;
            return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
        }
        else if (isFromFamily) {
            // Family Node to Child
            // Family node is the "knot".
            // We want: Family Node -> Down -> Horizontal -> Down -> Child
            
            // Simple V-H-V for now to ensure 90 degrees
            const midY = (startY + endY) / 2;
            return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
        }
        
        // Default fallback
        const midY = (startY + endY) / 2;
        return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    });

    // Post-processing: Add Dead markers and Patient highlight
    svgGroup.selectAll("g.node").each(function(v) {
        const node = g.node(v);
        const el = d3.select(this);
        
        if (node.dead) {
            // Draw single oblique line from bottom-left to top-right
            // Spanning the whole shape (sqrt(2) times longer than width if square)
            
            // To ensure it fully crosses the shape including borders, we extend it slightly
            const w = node.width;
            const h = node.height;
            const padding = 9; // Extra length to ensure full coverage
            
            // Bottom-Left (-w/2, h/2) to Top-Right (w/2, -h/2)
            el.append("line")
                .attr("x1", -w/2 - padding)
                .attr("y1", h/2 + padding)
                .attr("x2", w/2 + padding)
                .attr("y2", -h/2 - padding)
                .attr("class", "dead-marker")
                .style("stroke-width", "2px")
                .style("stroke", "#000");
        }

        if (node.isPatient) {
            // Add a double border or indicator
            // For simplicity, let's add an arrow or text "P"
            el.append("text")
                .attr("x", -node.width/2 - textDist)
                .attr("y", 5)
                .text("P ➔")
                .style("font-size", (fontSize + 2) + "px")
                .style("font-weight", "bold")
                .style("text-anchor", "end");
        }

        // Display Notes to the right
        if (node.notes && node.notes !== "None" && node.notes !== "") {
            el.append("text")
                .attr("x", node.width/2 + textDist)
                .attr("y", 5)
                .text(node.notes)
                .style("font-size", fontSize + "px")
                .style("text-anchor", "start");
        }

        // Add click handler to open edit modal
        el.style("cursor", "pointer")
            .on("click", function() {
                openEditModal(v);
            });
    });

    // Fix edge paths to be strictly orthogonal if dagre-d3 curve interpolation isn't enough
    // Dagre-D3 uses d3.curveBasis by default for edges. We overrode it above with curveStep/StepAfter/StepBefore
    // but sometimes we need to manually adjust paths for perfect Manhattan routing.
    // For now, let's rely on the d3.curveStep options added above.

    // Center the graph
    const svgWidth = svg.node().getBoundingClientRect().width;
    const xCenterOffset = (svgWidth - g.graph().width) / 2;
    svgGroup.attr("transform", "translate(" + xCenterOffset + ", 20)");
    
    // Enable Zoom
    const zoom = d3.zoom().on("zoom", function() {
        svgGroup.attr("transform", d3.event.transform);
    });
    svg.call(zoom);
}