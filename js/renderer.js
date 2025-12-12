// Pattern Picker Modal
window.showPatternPicker = function(condition, targetElement) {
    // Remove any existing picker
    d3.select("#pattern-picker").remove();

    const currentPatternId = window.patternManager.getPatternForCondition(condition);
    
    // Create picker container
    const picker = d3.select("body").append("div")
        .attr("id", "pattern-picker")
        .style("position", "fixed")
        .style("background", "white")
        .style("border", "2px solid #333")
        .style("border-radius", "8px")
        .style("padding", "15px")
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.3)")
        .style("z-index", "10000")
        .style("max-width", "400px")
        .style("max-height", "500px")
        .style("overflow-y", "auto");

    // Position near the clicked element (on the left side to avoid screen cutoff)
    const rect = targetElement.getBoundingClientRect();
    picker.style("right", (window.innerWidth - rect.left + 10) + "px")
        .style("top", rect.top + "px");

    // Add title
    picker.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "14px")
        .text(`Select pattern for: ${condition}`);

    // Create grid of patterns
    const grid = picker.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "repeat(4, 1fr)")
        .style("gap", "8px");

    // Add all available patterns
    window.patternManager.availablePatterns.forEach(patternInfo => {
        const conditionUsingThis = window.patternManager.getConditionByPattern(patternInfo.id);
        const isCurrentPattern = patternInfo.id === currentPatternId;
        const isInUse = conditionUsingThis !== null && !isCurrentPattern;

        const patternContainer = grid.append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("gap", "4px");

        const patternItem = patternContainer.append("div")
            .style("border", isCurrentPattern ? "3px solid #4CAF50" : "2px solid #000")
            .style("border-radius", "4px")
            .style("padding", "0")
            .style("cursor", "pointer")
            .style("position", "relative")
            .style("background", "white")
            .style("aspect-ratio", "1")
            .style("overflow", "hidden")
            .on("click", function() {
                console.log(`[PatternPicker] Selected pattern "${patternInfo.id}" for condition "${condition}"`);
                window.patternManager.setPatternForCondition(condition, patternInfo.id);
                d3.select("#pattern-picker").remove();
                updateGraph();
            })
            .on("mouseenter", function() {
                d3.select(this).style("opacity", "0.8");
            })
            .on("mouseleave", function() {
                d3.select(this).style("opacity", "1");
            });

        // Add pattern image (using data URI)
        patternItem.append("img")
            .attr("src", `data:image/png;base64,${patternInfo.base64}`)
            .attr("alt", patternInfo.name)
            .style("width", "100%")
            .style("height", "100%")
            .style("object-fit", "cover")
            .style("display", "block");

        // Add label showing if in use (outside the bordered box)
        if (isInUse) {
            patternContainer.append("div")
                .style("font-size", "9px")
                .style("text-align", "center")
                .style("color", "#ff6f00")
                .style("font-weight", "bold")
                .text(`Used by: ${conditionUsingThis}`);
        } else if (isCurrentPattern) {
            patternContainer.append("div")
                .style("font-size", "9px")
                .style("text-align", "center")
                .style("color", "#4CAF50")
                .style("font-weight", "bold")
                .text("Current");
        }
    });

    // Add close button
    picker.append("button")
        .text("Close")
        .style("margin-top", "10px")
        .style("width", "100%")
        .style("padding", "8px")
        .style("cursor", "pointer")
        .style("background", "#f44336")
        .style("color", "white")
        .style("border", "none")
        .style("border-radius", "4px")
        .style("font-weight", "bold")
        .on("click", function() {
            d3.select("#pattern-picker").remove();
        });

    // Close picker when clicking outside
    d3.select("body").on("click.pattern-picker", function() {
        if (!picker.node().contains(d3.event.target) && !targetElement.contains(d3.event.target)) {
            d3.select("#pattern-picker").remove();
            d3.select("body").on("click.pattern-picker", null);
        }
    });
};

// Color Picker Modal
window.showColorPicker = function(condition, targetElement) {
    // Remove any existing picker
    d3.select("#color-picker").remove();

    const currentColor = window.patternManager.getColorForCondition(condition);
    
    // Create picker container
    const picker = d3.select("body").append("div")
        .attr("id", "color-picker")
        .style("position", "fixed")
        .style("background", "white")
        .style("border", "2px solid #333")
        .style("border-radius", "8px")
        .style("padding", "15px")
        .style("box-shadow", "0 4px 12px rgba(0,0,0,0.3)")
        .style("z-index", "10000")
        .style("max-width", "400px")
        .style("max-height", "500px")
        .style("overflow-y", "auto");

    // Position near the clicked element (on the left side to avoid screen cutoff)
    const rect = targetElement.getBoundingClientRect();
    picker.style("right", (window.innerWidth - rect.left + 10) + "px")
        .style("top", rect.top + "px");

    // Add title
    picker.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "10px")
        .style("font-size", "14px")
        .text(`Select color for: ${condition}`);

    // Create grid of colors
    const grid = picker.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "repeat(4, 1fr)")
        .style("gap", "8px");

    // Add all available colors
    window.patternManager.availableColors.forEach(color => {
        const conditionUsingThis = window.patternManager.getConditionByColor(color);
        const isCurrentColor = color === currentColor;
        const isInUse = conditionUsingThis !== null && !isCurrentColor;

        const colorContainer = grid.append("div")
            .style("display", "flex")
            .style("flex-direction", "column")
            .style("gap", "4px");

        const colorItem = colorContainer.append("div")
            .style("border", isCurrentColor ? "3px solid #4CAF50" : "2px solid #000")
            .style("border-radius", "4px")
            .style("padding", "0")
            .style("cursor", "pointer")
            .style("position", "relative")
            .style("background", color)
            .style("aspect-ratio", "1")
            .style("min-height", "50px")
            .on("click", function() {
                console.log(`[ColorPicker] Selected color "${color}" for condition "${condition}"`);
                window.patternManager.setColorForCondition(condition, color);
                d3.select("#color-picker").remove();
                updateGraph();
            })
            .on("mouseenter", function() {
                d3.select(this).style("opacity", "0.8");
            })
            .on("mouseleave", function() {
                d3.select(this).style("opacity", "1");
            });

        // Add label showing if in use (outside the bordered box)
        if (isInUse) {
            colorContainer.append("div")
                .style("font-size", "9px")
                .style("text-align", "center")
                .style("color", "#ff6f00")
                .style("font-weight", "bold")
                .text(`Used by: ${conditionUsingThis}`);
        } else if (isCurrentColor) {
            colorContainer.append("div")
                .style("font-size", "9px")
                .style("text-align", "center")
                .style("color", "#4CAF50")
                .style("font-weight", "bold")
                .text("Current");
        }
    });

    // Add close button
    picker.append("button")
        .text("Close")
        .style("margin-top", "10px")
        .style("width", "100%")
        .style("padding", "8px")
        .style("cursor", "pointer")
        .style("background", "#f44336")
        .style("color", "white")
        .style("border", "none")
        .style("border-radius", "4px")
        .style("font-weight", "bold")
        .on("click", function() {
            d3.select("#color-picker").remove();
        });

    // Close picker when clicking outside
    d3.select("body").on("click.color-picker", function() {
        if (!picker.node().contains(d3.event.target) && !targetElement.contains(d3.event.target)) {
            d3.select("#color-picker").remove();
            d3.select("body").on("click.color-picker", null);
        }
    });
};

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
        console.log(`[Legend] Rendering grayscale legend for ${conditions.length} conditions:`, conditions);
        
        // Grayscale legend with clickable pattern icons
        conditions.forEach((cond, index) => {
            const patternId = window.patternManager.getPatternForCondition(cond);
            const patternImagePath = window.patternManager.getPatternPreview(patternId);
            
            console.log(`[Legend] Creating item ${index + 1}/${conditions.length} - Condition: "${cond}", Pattern: "${patternId}", Image: "${patternImagePath}"`);
            
            const item = legend.append("div")
                .attr("class", "legend-item");
            
            // Use img tag to display the pattern PNG (downscaled) - make it clickable
            const colorDiv = item.append("div")
                .attr("class", "legend-color")
                .style("cursor", "pointer")
                .style("position", "relative")
                .style("transition", "transform 0.2s, box-shadow 0.2s")
                .on("click", function() {
                    console.log(`[Legend] ✓ CLICK detected on pattern icon for condition: "${cond}"`);
                    console.log(`[Legend] Click event:`, d3.event);
                    console.log(`[Legend] Target element:`, this);
                    console.log(`[Legend] Checking if window.showPatternPicker exists:`, typeof window.showPatternPicker);
                    d3.event.stopPropagation();
                    
                    if (typeof window.showPatternPicker === 'function') {
                        console.log(`[Legend] Calling window.showPatternPicker("${cond}", DOM element)`);
                        window.showPatternPicker(cond, this);
                    } else {
                        console.error(`[Legend] ERROR: window.showPatternPicker is not a function!`);
                    }
                })
                .on("mouseenter", function() {
                    console.log(`[Legend] ✓ HOVER ENTER detected on pattern icon for: "${cond}"`);
                    d3.select(this)
                        .style("transform", "scale(1.1)")
                        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)");
                })
                .on("mouseleave", function() {
                    console.log(`[Legend] ✓ HOVER LEAVE detected on pattern icon for: "${cond}"`);
                    d3.select(this)
                        .style("transform", "scale(1)")
                        .style("box-shadow", "none");
                });
            
            colorDiv.append("img")
                .attr("src", patternImagePath)
                .attr("alt", cond)
                .style("width", "100%")
                .style("height", "100%")
                .style("object-fit", "cover")
                .style("display", "block")
                .style("pointer-events", "none"); // Prevent img from blocking click events
                
            item.append("span").text(cond);
            
            console.log(`[Legend] Item ${index + 1} created successfully`);
        });
        
        console.log(`[Legend] All ${conditions.length} grayscale legend items created`);
        
        const noneItem = legend.append("div").attr("class", "legend-item");
        noneItem.append("div").attr("class", "legend-color")
            .style("background-color", "#fff")
            .style("border", "1px solid #333");
        noneItem.append("span").text("None/Healthy");
    } else {
        console.log(`[Legend] Rendering color legend for ${conditions.length} conditions:`, conditions);
        
        // Color legend with clickable color boxes
        conditions.forEach((cond, index) => {
            console.log(`[Legend] Creating color item ${index + 1}/${conditions.length} - Condition: "${cond}"`);
            
            const item = legend.append("div")
                .attr("class", "legend-item");
            
            // Make color box clickable
            const colorDiv = item.append("div")
                .attr("class", "legend-color")
                .style("background-color", window.patternManager.getColorForCondition(cond))
                .style("cursor", "pointer")
                .style("transition", "transform 0.2s, box-shadow 0.2s")
                .on("click", function() {
                    console.log(`[Legend] ✓ CLICK detected on color box for condition: "${cond}"`);
                    d3.event.stopPropagation();
                    
                    if (typeof window.showColorPicker === 'function') {
                        console.log(`[Legend] Calling window.showColorPicker("${cond}", DOM element)`);
                        window.showColorPicker(cond, this);
                    } else {
                        console.error(`[Legend] ERROR: window.showColorPicker is not a function!`);
                    }
                })
                .on("mouseenter", function() {
                    console.log(`[Legend] ✓ HOVER ENTER detected on color box for: "${cond}"`);
                    d3.select(this)
                        .style("transform", "scale(1.1)")
                        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)");
                })
                .on("mouseleave", function() {
                    console.log(`[Legend] ✓ HOVER LEAVE detected on color box for: "${cond}"`);
                    d3.select(this)
                        .style("transform", "scale(1)")
                        .style("box-shadow", "none");
                });
                
            item.append("span").text(cond);
            
            console.log(`[Legend] Color item ${index + 1} created successfully`);
        });
        
        console.log(`[Legend] All ${conditions.length} color legend items created`);
        
        const noneItem = legend.append("div").attr("class", "legend-item");
        noneItem.append("div").attr("class", "legend-color")
            .style("background-color", "#fff")
            .style("border", "1px solid #333");
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
                console.log(`[Renderer] Individual ${ind.id} - Condition: "${ind.condition}", Pattern: "${patternId}", Fill: "${fillStyle}"`);
            } else {
                fillStyle = `fill: #fff; stroke: #333; stroke-width: 2px;`;
                console.log(`[Renderer] Individual ${ind.id} - No condition, using white fill`);
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
        
        g.setNode(ind.id, {
            label: '', // Empty label to show patterns clearly
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
        console.log(`[Renderer] Grayscale mode enabled. Creating ${conditions.length} patterns for conditions:`, conditions);
        conditions.forEach(cond => {
            const patternId = window.patternManager.getPatternForCondition(cond);
            console.log(`[Renderer] Creating pattern for condition "${cond}": ${patternId}`);
            window.patternManager.createSVGPattern(defs, patternId);
        });
        console.log(`[Renderer] All SVG patterns created in <defs>`);
    } else {
        console.log(`[Renderer] Color mode enabled, no patterns needed`);
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
