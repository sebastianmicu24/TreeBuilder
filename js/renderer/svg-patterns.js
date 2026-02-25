// ===== SVG Pattern Definitions =====
// Creates <defs> patterns for grayscale mode. No-op in color mode.

async function createSVGPatternDefs(defs, conditions, sortedIndividuals, isGrayscale) {
    if (!isGrayscale) return;

    // 1. Create all base patterns (async - images need to load)
    const patternPromises = conditions.map(cond => {
        const patternId = window.patternManager.getPatternForCondition(cond);
        return window.patternManager.createSVGPattern(defs, patternId);
    });
    await Promise.all(patternPromises);

    // 2. Wrapper patterns: white background + base pattern overlay
    //    Used for single-condition nodes so the pattern sits on white, not transparent.
    conditions.forEach(cond => {
        const basePatternId = window.patternManager.getPatternForCondition(cond);
        const wrapperId     = `${basePatternId}-with-bg`;

        const wrapperPattern = defs.append('pattern')
            .attr('id',                  wrapperId)
            .attr('patternUnits',        'objectBoundingBox')
            .attr('patternContentUnits', 'objectBoundingBox')
            .attr('width',  '1')
            .attr('height', '1');

        // White background layer
        wrapperPattern.append('rect')
            .attr('x', '0').attr('y', '0')
            .attr('width', '1').attr('height', '1')
            .attr('fill', 'white')
            .attr('fill-opacity', '1');

        // Pattern overlay on top
        wrapperPattern.append('rect')
            .attr('x', '0').attr('y', '0')
            .attr('width', '1').attr('height', '1')
            .attr('fill', `url(#${basePatternId})`);
    });

    // 3. Composite patterns: white bg + each condition's pattern stacked
    //    Used for nodes that have multiple conditions.
    sortedIndividuals.forEach(ind => {
        if (!ind._compositePatternId || !ind._validConditions || ind._validConditions.length < 2) return;

        const compositePattern = defs.append('pattern')
            .attr('id',                  ind._compositePatternId)
            .attr('patternUnits',        'objectBoundingBox')
            .attr('patternContentUnits', 'objectBoundingBox')
            .attr('width',  '1')
            .attr('height', '1');

        // White background layer
        compositePattern.append('rect')
            .attr('x', '0').attr('y', '0')
            .attr('width', '1').attr('height', '1')
            .attr('fill', 'white')
            .attr('fill-opacity', '1');

        // Overlay each condition's pattern on top
        ind._validConditions.forEach(cond => {
            const patternId = window.patternManager.getPatternForCondition(cond);
            compositePattern.append('rect')
                .attr('x', '0').attr('y', '0')
                .attr('width', '1').attr('height', '1')
                .attr('fill', `url(#${patternId})`);
        });
    });
}
