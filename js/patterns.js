// Pattern and Color Management for Clinical Genogram

class PatternManager {
    constructor() {
        // Define all available patterns
        this.availablePatterns = [
            { id: 'quadrant-tl', name: 'Top-Left Fill', type: 'quadrant' },
            { id: 'quadrant-tr', name: 'Top-Right Fill', type: 'quadrant' },
            { id: 'quadrant-bl', name: 'Bottom-Left Fill', type: 'quadrant' },
            { id: 'quadrant-br', name: 'Bottom-Right Fill', type: 'quadrant' },
            { id: 'dots', name: 'Dots', type: 'pattern' },
            { id: 'horizontal', name: 'Horizontal Lines', type: 'pattern' },
            { id: 'vertical', name: 'Vertical Lines', type: 'pattern' },
            { id: 'diagonal-right', name: 'Diagonal Right', type: 'pattern' },
            { id: 'diagonal-left', name: 'Diagonal Left', type: 'pattern' },
            { id: 'checkerboard', name: 'Checkerboard', type: 'pattern' },
            { id: 'cross-hatch', name: 'Cross-Hatch', type: 'pattern' },
            { id: 'dots-small', name: 'Small Dots', type: 'pattern' }
        ];
        
        this.conditionPatternMap = {}; // Maps condition name to pattern id
        this.usedPatterns = new Set();
        this.colorScale = null;
    }

    // Initialize color scale
    initColorScale(conditions) {
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(conditions);
    }

    // Get or assign a pattern for a condition
    getPatternForCondition(condition) {
        if (!this.conditionPatternMap[condition]) {
            this.conditionPatternMap[condition] = this.assignRandomPattern();
        }
        return this.conditionPatternMap[condition];
    }

    // Assign a random unused pattern
    assignRandomPattern() {
        const unused = this.availablePatterns.filter(p => !this.usedPatterns.has(p.id));
        if (unused.length === 0) {
            // If all patterns used, reset and start over
            this.usedPatterns.clear();
            return this.availablePatterns[0].id;
        }
        const selected = unused[Math.floor(Math.random() * unused.length)];
        this.usedPatterns.add(selected.id);
        return selected.id;
    }

    // Change pattern for a specific condition
    changePattern(condition) {
        const currentPattern = this.conditionPatternMap[condition];
        if (currentPattern) {
            this.usedPatterns.delete(currentPattern);
        }
        this.conditionPatternMap[condition] = this.assignRandomPattern();
        return this.conditionPatternMap[condition];
    }

    // Create SVG pattern definition
    createSVGPattern(defs, patternId) {
        const pattern = defs.append("pattern")
            .attr("id", patternId)
            .attr("patternUnits", "objectBoundingBox")
            .attr("width", "1")
            .attr("height", "1");

        switch(patternId) {
            case 'quadrant-tl':
                pattern.append("rect").attr("width", "1").attr("height", "1").attr("fill", "#fff");
                pattern.append("polygon")
                    .attr("points", "0,0 0.5,0 0,0.5")
                    .attr("fill", "#666");
                break;

            case 'quadrant-tr':
                pattern.append("rect").attr("width", "1").attr("height", "1").attr("fill", "#fff");
                pattern.append("polygon")
                    .attr("points", "0.5,0 1,0 1,0.5")
                    .attr("fill", "#666");
                break;

            case 'quadrant-bl':
                pattern.append("rect").attr("width", "1").attr("height", "1").attr("fill", "#fff");
                pattern.append("polygon")
                    .attr("points", "0,0.5 0,1 0.5,1")
                    .attr("fill", "#666");
                break;

            case 'quadrant-br':
                pattern.append("rect").attr("width", "1").attr("height", "1").attr("fill", "#fff");
                pattern.append("polygon")
                    .attr("points", "0.5,1 1,1 1,0.5")
                    .attr("fill", "#666");
                break;

            case 'dots':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 10).attr("height", 10);
                pattern.append("rect").attr("width", 10).attr("height", 10).attr("fill", "#fff");
                pattern.append("circle").attr("cx", 5).attr("cy", 5).attr("r", 2.5).attr("fill", "#666");
                break;

            case 'dots-small':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6);
                pattern.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#fff");
                pattern.append("circle").attr("cx", 3).attr("cy", 3).attr("r", 1.2).attr("fill", "#666");
                break;

            case 'horizontal':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 8).attr("height", 8);
                pattern.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
                pattern.append("rect").attr("x", 0).attr("y", 0).attr("width", 8).attr("height", 3).attr("fill", "#666");
                break;

            case 'vertical':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 8).attr("height", 8);
                pattern.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
                pattern.append("rect").attr("x", 0).attr("y", 0).attr("width", 3).attr("height", 8).attr("fill", "#666");
                break;

            case 'diagonal-right':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 8).attr("height", 8);
                pattern.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
                pattern.append("line")
                    .attr("x1", 0).attr("y1", 0)
                    .attr("x2", 8).attr("y2", 8)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                pattern.append("line")
                    .attr("x1", -4).attr("y1", 4)
                    .attr("x2", 4).attr("y2", 12)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                pattern.append("line")
                    .attr("x1", 4).attr("y1", -4)
                    .attr("x2", 12).attr("y2", 4)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                break;

            case 'diagonal-left':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 8).attr("height", 8);
                pattern.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
                pattern.append("line")
                    .attr("x1", 0).attr("y1", 8)
                    .attr("x2", 8).attr("y2", 0)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                pattern.append("line")
                    .attr("x1", -4).attr("y1", 4)
                    .attr("x2", 4).attr("y2", -4)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                pattern.append("line")
                    .attr("x1", 4).attr("y1", 12)
                    .attr("x2", 12).attr("y2", 4)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 2);
                break;

            case 'checkerboard':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 10).attr("height", 10);
                pattern.append("rect").attr("width", 10).attr("height", 10).attr("fill", "#fff");
                pattern.append("rect").attr("x", 0).attr("y", 0).attr("width", 5).attr("height", 5).attr("fill", "#666");
                pattern.append("rect").attr("x", 5).attr("y", 5).attr("width", 5).attr("height", 5).attr("fill", "#666");
                break;

            case 'cross-hatch':
                pattern.attr("patternUnits", "userSpaceOnUse").attr("width", 10).attr("height", 10);
                pattern.append("rect").attr("width", 10).attr("height", 10).attr("fill", "#fff");
                pattern.append("line")
                    .attr("x1", 0).attr("y1", 0)
                    .attr("x2", 10).attr("y2", 10)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 1.5);
                pattern.append("line")
                    .attr("x1", 10).attr("y1", 0)
                    .attr("x2", 0).attr("y2", 10)
                    .attr("stroke", "#666")
                    .attr("stroke-width", 1.5);
                break;
        }
    }

    // Get CSS preview for legend
    getPatternPreviewCSS(patternId) {
        switch(patternId) {
            case 'quadrant-tl':
                return "linear-gradient(to bottom right, #666 0%, #666 50%, #fff 50%, #fff 100%)";
            case 'quadrant-tr':
                return "linear-gradient(to bottom left, #666 0%, #666 50%, #fff 50%, #fff 100%)";
            case 'quadrant-bl':
                return "linear-gradient(to top right, #666 0%, #666 50%, #fff 50%, #fff 100%)";
            case 'quadrant-br':
                return "linear-gradient(to top left, #666 0%, #666 50%, #fff 50%, #fff 100%)";
            case 'dots':
                return "radial-gradient(circle at 50% 50%, #666 35%, #fff 35%), " +
                       "radial-gradient(circle at 50% 50%, #666 35%, #fff 35%)";
            case 'dots-small':
                return "radial-gradient(circle at 50% 50%, #666 20%, #fff 20%)";
            case 'horizontal':
                return "repeating-linear-gradient(0deg, #666 0px, #666 3px, #fff 3px, #fff 8px)";
            case 'vertical':
                return "repeating-linear-gradient(90deg, #666 0px, #666 3px, #fff 3px, #fff 8px)";
            case 'diagonal-right':
                return "repeating-linear-gradient(45deg, #666 0px, #666 3px, #fff 3px, #fff 8px)";
            case 'diagonal-left':
                return "repeating-linear-gradient(-45deg, #666 0px, #666 3px, #fff 3px, #fff 8px)";
            case 'checkerboard':
                return "conic-gradient(#666 0% 25%, #fff 25% 50%, #666 50% 75%, #fff 75% 100%)";
            case 'cross-hatch':
                return "repeating-linear-gradient(45deg, transparent 0px, transparent 4px, #666 4px, #666 5px), " +
                       "repeating-linear-gradient(-45deg, transparent 0px, transparent 4px, #666 4px, #666 5px)";
            default:
                return "#fff";
        }
    }

    // Get color for condition
    getColorForCondition(condition) {
        return this.colorScale ? this.colorScale(condition) : '#fff';
    }

    // Reset all patterns
    reset() {
        this.conditionPatternMap = {};
        this.usedPatterns.clear();
    }
}

// Global instance
window.patternManager = new PatternManager();