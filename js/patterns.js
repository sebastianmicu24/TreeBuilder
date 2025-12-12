// Pattern and Color Management for Clinical Genogram

class PatternManager {
    constructor() {
        // Define all available patterns (now using PNG images)
        this.availablePatterns = [
            { id: 'pattern-01', name: 'Top-Left Fill', type: 'quadrant', file: 'patterns/pattern-01.png' },
            { id: 'pattern-02', name: 'Top-Right Fill', type: 'quadrant', file: 'patterns/pattern-02.png' },
            { id: 'pattern-03', name: 'Bottom-Left Fill', type: 'quadrant', file: 'patterns/pattern-03.png' },
            { id: 'pattern-04', name: 'Bottom-Right Fill', type: 'quadrant', file: 'patterns/pattern-04.png' },
            { id: 'pattern-05', name: 'Dots', type: 'pattern', file: 'patterns/pattern-05.png' },
            { id: 'pattern-06', name: 'Horizontal Lines', type: 'pattern', file: 'patterns/pattern-06.png' },
            { id: 'pattern-07', name: 'Vertical Lines', type: 'pattern', file: 'patterns/pattern-07.png' },
            { id: 'pattern-08', name: 'Diagonal Right', type: 'pattern', file: 'patterns/pattern-08.png' },
            { id: 'pattern-09', name: 'Diagonal Left', type: 'pattern', file: 'patterns/pattern-09.png' },
            { id: 'pattern-10', name: 'Checkerboard', type: 'pattern', file: 'patterns/pattern-10.png' },
            { id: 'pattern-11', name: 'Cross-Hatch', type: 'pattern', file: 'patterns/pattern-11.png' },
            { id: 'pattern-12', name: 'Small Dots', type: 'pattern', file: 'patterns/pattern-12.png' },
            { id: 'pattern-13', name: 'Grid', type: 'pattern', file: 'patterns/pattern-13.png' },
            { id: 'pattern-14', name: 'Waves', type: 'pattern', file: 'patterns/pattern-14.png' },
            { id: 'pattern-15', name: 'Brick', type: 'pattern', file: 'patterns/pattern-15.png' },
            { id: 'pattern-16', name: 'Zigzag', type: 'pattern', file: 'patterns/pattern-16.png' }
        ];
        this.conditionPatternMap = {}; // Maps condition name to pattern id
        this.usedPatterns = new Set();
        this.colorScale = null;
        this.conditionColorMap = {}; // Maps condition name to custom color
        
        // Define a palette of bright, distinguishable colors
        this.availableColors = [
            '#FF6B6B', // Red
            '#4ECDC4', // Teal
            '#FFE66D', // Yellow
            '#95E1D3', // Mint
            '#FF8B94', // Pink
            '#A8E6CF', // Light Green
            '#FFD93D', // Gold
            '#6BCF7F', // Green
            '#95B8D1', // Blue
            '#E8A0BF', // Rose
            '#FFA07A', // Light Salmon
            '#98D8C8', // Seafoam
            '#F7B731', // Orange
            '#A29BFE', // Lavender
            '#FD79A8', // Hot Pink
            '#74B9FF', // Sky Blue
            '#55E6C1', // Turquoise
            '#FEA47F', // Peach
            '#B8E994', // Lime
            '#F8B500'  // Amber
        ];
    }

    // Initialize color scale
    initColorScale(conditions) {
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(conditions);
    }
    

    // Get or assign a pattern for a condition
    getPatternForCondition(condition) {
        if (!this.conditionPatternMap[condition]) {
            this.conditionPatternMap[condition] = this.assignRandomPattern();
            console.log(`[PatternManager] Assigned pattern "${this.conditionPatternMap[condition]}" to condition "${condition}"`);
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

    // Get condition currently using a specific pattern
    getConditionByPattern(patternId) {
        for (const [condition, pattern] of Object.entries(this.conditionPatternMap)) {
            if (pattern === patternId) {
                return condition;
            }
        }
        return null;
    }

    // Set a specific pattern for a condition
    setPatternForCondition(condition, newPatternId) {
        const currentPattern = this.conditionPatternMap[condition];
        const conditionUsingNewPattern = this.getConditionByPattern(newPatternId);

        if (conditionUsingNewPattern && conditionUsingNewPattern !== condition) {
            // Pattern is already in use - swap patterns
            console.log(`[PatternManager] Swapping patterns: "${condition}" ↔ "${conditionUsingNewPattern}"`);
            this.conditionPatternMap[conditionUsingNewPattern] = currentPattern;
            this.conditionPatternMap[condition] = newPatternId;
        } else {
            // Pattern is not in use - simply assign it
            console.log(`[PatternManager] Assigning unused pattern "${newPatternId}" to "${condition}"`);
            if (currentPattern) {
                this.usedPatterns.delete(currentPattern);
            }
            this.conditionPatternMap[condition] = newPatternId;
            this.usedPatterns.add(newPatternId);
        }
        
        return newPatternId;
    }
    // Create SVG pattern definition using PNG image
    createSVGPattern(defs, patternId) {
        const patternInfo = this.availablePatterns.find(p => p.id === patternId);
        if (!patternInfo) {
            console.error(`[PatternManager] Pattern not found: ${patternId}`);
            return;
        }

        console.log(`[PatternManager] Creating SVG pattern "${patternId}" with image: ${patternInfo.file}`);

        // Use objectBoundingBox to make pattern fill shape completely without tiling
        const pattern = defs.append("pattern")
            .attr("id", patternId)
            .attr("patternUnits", "objectBoundingBox")
            .attr("patternContentUnits", "objectBoundingBox")
            .attr("width", "1")
            .attr("height", "1")
            .attr("x", "0")
            .attr("y", "0");

        // Add the full 512x512 PNG image - it will scale to fill the shape
        pattern.append("image")
            .attr("href", patternInfo.file)
            .attr("x", "0")
            .attr("y", "0")
            .attr("width", "1")
            .attr("height", "1")
            .attr("preserveAspectRatio", "none");
        
        console.log(`[PatternManager] SVG pattern "${patternId}" created with objectBoundingBox (no tiling, fills shape)`);
    }

    // Get pattern image path for a given pattern ID
    getPatternImagePath(patternId) {
        const patternInfo = this.availablePatterns.find(p => p.id === patternId);
        return patternInfo ? patternInfo.file : null;
    }

    // Get pattern preview (returns image path for use in legend)
    getPatternPreview(patternId) {
        return this.getPatternImagePath(patternId);
    }

    // Get color for condition
    getColorForCondition(condition) {
        // Return custom color if set, otherwise use color scale
        if (this.conditionColorMap[condition]) {
            return this.conditionColorMap[condition];
        }
        return this.colorScale ? this.colorScale(condition) : '#fff';
    }
    
    // Set custom color for a condition
    setColorForCondition(condition, color) {
        console.log(`[PatternManager] Setting color "${color}" for condition "${condition}"`);
        this.conditionColorMap[condition] = color;
        return color;
    }
    
    // Get condition currently using a specific color
    getConditionByColor(color) {
        for (const [condition, assignedColor] of Object.entries(this.conditionColorMap)) {
            if (assignedColor === color) {
                return condition;
            }
        }
        return null;
    }

    // Reset all patterns
    reset() {
        this.conditionPatternMap = {};
        this.usedPatterns.clear();
    }
}

// Global instance
window.patternManager = new PatternManager();