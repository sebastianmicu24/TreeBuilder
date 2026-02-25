// ===== Post-Layout: Couple Adjacency Fix =====
// Ensures partners in a couple are always adjacent (no nodes between them).
// Dagre doesn't understand this genogram constraint, so we fix it post-layout.

function fixCoupleAdjacency(g, families, nodeSep, svgGroup) {
    // Group nodes by rank (y-position with tolerance)
    const rankGroups = {};
    g.nodes().forEach(nodeId => {
        const node = g.node(nodeId);
        if (!node) return;
        const rankKey = Math.round(node.y / 5) * 5;
        if (!rankGroups[rankKey]) rankGroups[rankKey] = [];
        rankGroups[rankKey].push(nodeId);
    });

    // Sort each rank group left-to-right by x position
    Object.keys(rankGroups).forEach(rankKey => {
        rankGroups[rankKey].sort((a, b) => g.node(a).x - g.node(b).x);
    });

    families.forEach(fam => {
        if (!fam.father || !fam.mother) return;

        const fatherNode = g.node(fam.father);
        const motherNode = g.node(fam.mother);
        if (!fatherNode || !motherNode) return;

        const fatherRankKey = Math.round(fatherNode.y / 5) * 5;
        const motherRankKey = Math.round(motherNode.y / 5) * 5;
        if (fatherRankKey !== motherRankKey) return; // Must be on same rank

        const rankNodes = rankGroups[fatherRankKey];
        if (!rankNodes) return;

        const fatherIdx = rankNodes.indexOf(fam.father);
        const motherIdx = rankNodes.indexOf(fam.mother);
        if (fatherIdx === -1 || motherIdx === -1) return;

        const leftIdx  = Math.min(fatherIdx, motherIdx);
        const rightIdx = Math.max(fatherIdx, motherIdx);

        // Find non-family/hub nodes between the partners
        const nonFamilyNodesBetween = [];
        for (let i = leftIdx + 1; i < rightIdx; i++) {
            const betweenId = rankNodes[i];
            if (betweenId.startsWith('fam_') || betweenId.startsWith('hub_')) continue;
            nonFamilyNodesBetween.push(betweenId);
        }
        if (nonFamilyNodesBetween.length === 0) return; // Already adjacent

        const leftPartnerNode  = g.node(rankNodes[leftIdx]);
        const rightPartnerNode = g.node(rankNodes[rightIdx]);
        const coupleNode       = g.node(fam.id);

        const newRightX   = leftPartnerNode.x + leftPartnerNode.width / 2 + nodeSep + rightPartnerNode.width / 2;
        const shiftAmount = rightPartnerNode.x - newRightX;

        if (shiftAmount > 0) {
            // Right partner needs to move left; push intruders to the right
            rightPartnerNode.x = newRightX;
            if (coupleNode) coupleNode.x = (leftPartnerNode.x + newRightX) / 2;

            let currentX = newRightX + rightPartnerNode.width / 2 + nodeSep;
            nonFamilyNodesBetween.forEach(nodeId => {
                const node = g.node(nodeId);
                node.x = currentX + node.width / 2;
                currentX = node.x + node.width / 2 + nodeSep;
            });

            // Shift any nodes to the right of rightPartner if they now overlap
            for (let i = rightIdx + 1; i < rankNodes.length; i++) {
                const nodeId = rankNodes[i];
                if (nonFamilyNodesBetween.includes(nodeId)) continue;
                const node = g.node(nodeId);
                if (node.x < currentX + node.width / 2) {
                    node.x = currentX + node.width / 2;
                    currentX = node.x + node.width / 2 + nodeSep;
                } else {
                    break;
                }
            }
        } else {
            // Right partner stays; move intruders out to the right
            if (coupleNode) coupleNode.x = (leftPartnerNode.x + rightPartnerNode.x) / 2;

            let currentX = rightPartnerNode.x + rightPartnerNode.width / 2 + nodeSep;
            nonFamilyNodesBetween.forEach(nodeId => {
                const node = g.node(nodeId);
                node.x = currentX + node.width / 2;
                currentX = node.x + node.width / 2 + nodeSep;
            });

            // Shift remaining nodes if needed
            for (let i = rightIdx + 1; i < rankNodes.length; i++) {
                const nodeId = rankNodes[i];
                if (nonFamilyNodesBetween.includes(nodeId)) continue;
                const node = g.node(nodeId);
                if (node.x < currentX + node.width / 2) {
                    node.x = currentX + node.width / 2;
                    currentX = node.x + node.width / 2 + nodeSep;
                } else {
                    break;
                }
            }
        }

        // Keep child hub aligned below couple node
        const childHubNode = g.node(`hub_${fam.id}`);
        if (childHubNode && coupleNode) {
            childHubNode.x = coupleNode.x;
        }
    });

    // Apply corrected positions to SVG node transforms
    svgGroup.selectAll('g.node').each(function(v) {
        const node = g.node(v);
        if (node) {
            d3.select(this).attr('transform', `translate(${node.x},${node.y})`);
        }
    });
}

// ===== Post-Layout: Orthogonal Edge Path Override =====
// Edge types:
//   Parent → CoupleNode (fam_*)         : marriage/couple horizontal line
//   CoupleNode (fam_*) → ChildHub (hub_*) : vertical descent
//   ChildHub (hub_*) → Child             : sibling distribution lines
//   CoupleNode → Child (single parent)   : fallthrough

function overrideEdgePaths(svgGroup, g) {
    svgGroup.selectAll('g.edgePath path').attr('d', function(d) {
        const source = g.node(d.v);
        const target = g.node(d.w);

        const isToCoupleNode  = d.w.startsWith('fam_');
        const isFromCoupleNode = d.v.startsWith('fam_');
        const isToChildHub    = d.w.startsWith('hub_');
        const isFromChildHub  = d.v.startsWith('hub_');

        const startX = source.x;
        const startY = source.y + source.height / 2; // Bottom of source
        const endX   = target.x;
        const endY   = target.y - target.height / 2; // Top of target

        if (isToCoupleNode && !d.v.startsWith('fam_') && !d.v.startsWith('hub_')) {
            // === Parent → CoupleNode: marriage line ===
            if (window.coupleStraightLines) {
                const parentCenterY = source.y;
                const sideX = startX > endX
                    ? source.x - source.width / 2
                    : source.x + source.width / 2;
                return `M ${sideX} ${parentCenterY} L ${endX} ${parentCenterY} L ${endX} ${endY}`;
            } else {
                const midY = (startY + endY) / 2;
                return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
            }
        } else if (isFromCoupleNode && isToChildHub) {
            // === CoupleNode → ChildHub: straight vertical ===
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        } else if (isFromChildHub) {
            // === ChildHub → Child: elbow routing ===
            const midY = (startY + endY) / 2;
            return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
        } else if (isFromCoupleNode && !isToChildHub) {
            // === Single-parent family node → Child ===
            const midY = (startY + endY) / 2;
            return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
        }

        // Default orthogonal fallback
        const midY = (startY + endY) / 2;
        return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
    });
}

// ===== Post-Layout: Infertile / No-Children-By-Choice Symbols =====
// Drawn after layout so absolute SVG positions are known.
//   Infertile:            vertical line + double horizontal bar
//   No children by choice: vertical line + single horizontal bar
// For couples, symbol is drawn once at the couple midpoint.

function drawFertilitySymbols(svgGroup, g, families, sortedIndividuals) {
    const drawnFertilitySymbols = new Set();
    const fertNodeSize  = window.genogramSettings ? parseInt(window.genogramSettings.nodeSize) : 40;
    const halfBarWidth  = Math.max(fertNodeSize * 0.85, 20);
    const fertLineLength = 34;
    const doubleBarGap  = 4.5;

    sortedIndividuals.forEach(ind => {
        if (!ind.infertile && !ind.noChildrenByChoice) return;

        const node = g.node(ind.id);
        if (!node) return;

        const isInfertile = ind.infertile; // Infertile takes priority

        // Find if this person belongs to a couple family
        const fam = families.find(f =>
            (f.father === ind.id || f.mother === ind.id) && f.father && f.mother
        );

        let centerX, bottomY, symbolKey;

        if (fam) {
            symbolKey = fam.id;
            if (drawnFertilitySymbols.has(symbolKey)) return;
            drawnFertilitySymbols.add(symbolKey);

            const fatherNode = g.node(fam.father);
            const motherNode = g.node(fam.mother);
            if (!fatherNode || !motherNode) return;

            const coupleNode = g.node(fam.id);
            centerX = coupleNode
                ? coupleNode.x
                : (fatherNode.x + motherNode.x) / 2;
            bottomY = coupleNode
                ? coupleNode.y
                : Math.max(fatherNode.y + fatherNode.height / 2, motherNode.y + motherNode.height / 2);
        } else {
            symbolKey = ind.id;
            if (drawnFertilitySymbols.has(symbolKey)) return;
            drawnFertilitySymbols.add(symbolKey);
            centerX = node.x;
            bottomY = node.y + node.height / 2;
        }

        const lineEndY = bottomY + fertLineLength;

        // Vertical descent line
        svgGroup.append('line')
            .attr('x1', centerX).attr('y1', bottomY)
            .attr('x2', centerX).attr('y2', lineEndY)
            .style('stroke', '#000')
            .style('stroke-width', '1.5px');

        if (isInfertile) {
            // Double horizontal bar
            [lineEndY - doubleBarGap, lineEndY + doubleBarGap].forEach(barY => {
                svgGroup.append('line')
                    .attr('x1', centerX - halfBarWidth).attr('y1', barY)
                    .attr('x2', centerX + halfBarWidth).attr('y2', barY)
                    .style('stroke', '#000')
                    .style('stroke-width', '2.5px');
            });
        } else {
            // Single horizontal bar
            svgGroup.append('line')
                .attr('x1', centerX - halfBarWidth).attr('y1', lineEndY)
                .attr('x2', centerX + halfBarWidth).attr('y2', lineEndY)
                .style('stroke', '#000')
                .style('stroke-width', '2px');
        }
    });
}
