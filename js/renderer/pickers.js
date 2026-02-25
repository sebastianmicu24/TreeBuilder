// ===== Pattern Picker Modal =====

window.showPatternPicker = function(condition, targetElement) {
    d3.select('#pattern-picker').remove();

    const currentPatternId = window.patternManager.getPatternForCondition(condition);

    const picker = d3.select('body').append('div')
        .attr('id', 'pattern-picker')
        .style('position',   'fixed')
        .style('background', 'white')
        .style('border',     '2px solid #333')
        .style('border-radius', '8px')
        .style('padding',    '15px')
        .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
        .style('z-index',    '10000')
        .style('max-width',  '400px')
        .style('max-height', '500px')
        .style('overflow-y', 'auto');

    const rect = targetElement.getBoundingClientRect();
    picker.style('right', (window.innerWidth - rect.left + 10) + 'px')
          .style('top',   rect.top + 'px');

    picker.append('div')
        .style('font-weight',   'bold')
        .style('margin-bottom', '10px')
        .style('font-size',     '14px')
        .text(`Select pattern for: ${condition}`);

    const grid = picker.append('div')
        .style('display',               'grid')
        .style('grid-template-columns', 'repeat(4, 1fr)')
        .style('gap',                   '8px');

    window.patternManager.availablePatterns.forEach(patternInfo => {
        const conditionUsingThis = window.patternManager.getConditionByPattern(patternInfo.id);
        const isCurrentPattern   = patternInfo.id === currentPatternId;
        const isInUse            = conditionUsingThis !== null && !isCurrentPattern;

        const patternContainer = grid.append('div')
            .style('display',        'flex')
            .style('flex-direction', 'column')
            .style('gap',            '4px');

        patternContainer.append('div')
            .style('border',       isCurrentPattern ? '3px solid #4CAF50' : '2px solid #000')
            .style('border-radius', '4px')
            .style('padding',       '0')
            .style('cursor',        'pointer')
            .style('position',      'relative')
            .style('background',    'white')
            .style('aspect-ratio',  '1')
            .style('overflow',      'hidden')
            .on('click', function() {
                window.patternManager.setPatternForCondition(condition, patternInfo.id);
                d3.select('#pattern-picker').remove();
                updateGraph();
            })
            .on('mouseenter', function() { d3.select(this).style('opacity', '0.8'); })
            .on('mouseleave', function() { d3.select(this).style('opacity', '1'); })
            .append('img')
                .attr('src', `data:image/png;base64,${patternInfo.base64}`)
                .attr('alt', patternInfo.name)
                .style('width',        '100%')
                .style('height',       '100%')
                .style('object-fit',   'cover')
                .style('display',      'block');

        if (isInUse) {
            patternContainer.append('div')
                .style('font-size',   '9px')
                .style('text-align',  'center')
                .style('color',       '#ff6f00')
                .style('font-weight', 'bold')
                .text(`Used by: ${conditionUsingThis}`);
        } else if (isCurrentPattern) {
            patternContainer.append('div')
                .style('font-size',   '9px')
                .style('text-align',  'center')
                .style('color',       '#4CAF50')
                .style('font-weight', 'bold')
                .text('Current');
        }
    });

    picker.append('button')
        .text('Close')
        .style('margin-top',    '10px')
        .style('width',         '100%')
        .style('padding',       '8px')
        .style('cursor',        'pointer')
        .style('background',    '#f44336')
        .style('color',         'white')
        .style('border',        'none')
        .style('border-radius', '4px')
        .style('font-weight',   'bold')
        .on('click', function() { d3.select('#pattern-picker').remove(); });

    d3.select('body').on('click.pattern-picker', function() {
        if (!picker.node().contains(d3.event.target) && !targetElement.contains(d3.event.target)) {
            d3.select('#pattern-picker').remove();
            d3.select('body').on('click.pattern-picker', null);
        }
    });
};

// ===== Color Picker Modal =====

window.showColorPicker = function(condition, targetElement) {
    d3.select('#color-picker').remove();

    const currentColor = window.patternManager.getColorForCondition(condition);

    const picker = d3.select('body').append('div')
        .attr('id', 'color-picker')
        .style('position',   'fixed')
        .style('background', 'white')
        .style('border',     '2px solid #333')
        .style('border-radius', '8px')
        .style('padding',    '15px')
        .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
        .style('z-index',    '10000')
        .style('max-width',  '400px')
        .style('max-height', '500px')
        .style('overflow-y', 'auto');

    const rect = targetElement.getBoundingClientRect();
    picker.style('right', (window.innerWidth - rect.left + 10) + 'px')
          .style('top',   rect.top + 'px');

    picker.append('div')
        .style('font-weight',   'bold')
        .style('margin-bottom', '10px')
        .style('font-size',     '14px')
        .text(`Select color for: ${condition}`);

    const grid = picker.append('div')
        .style('display',               'grid')
        .style('grid-template-columns', 'repeat(4, 1fr)')
        .style('gap',                   '8px');

    window.patternManager.availableColors.forEach(color => {
        const conditionUsingThis = window.patternManager.getConditionByColor(color);
        const isCurrentColor     = color === currentColor;
        const isInUse            = conditionUsingThis !== null && !isCurrentColor;

        const colorContainer = grid.append('div')
            .style('display',        'flex')
            .style('flex-direction', 'column')
            .style('gap',            '4px');

        colorContainer.append('div')
            .style('border',        isCurrentColor ? '3px solid #4CAF50' : '2px solid #000')
            .style('border-radius', '4px')
            .style('padding',       '0')
            .style('cursor',        'pointer')
            .style('position',      'relative')
            .style('background',    color)
            .style('aspect-ratio',  '1')
            .style('min-height',    '50px')
            .on('click', function() {
                window.patternManager.setColorForCondition(condition, color);
                d3.select('#color-picker').remove();
                updateGraph();
            })
            .on('mouseenter', function() { d3.select(this).style('opacity', '0.8'); })
            .on('mouseleave', function() { d3.select(this).style('opacity', '1'); });

        if (isInUse) {
            colorContainer.append('div')
                .style('font-size',   '9px')
                .style('text-align',  'center')
                .style('color',       '#ff6f00')
                .style('font-weight', 'bold')
                .text(`Used by: ${conditionUsingThis}`);
        } else if (isCurrentColor) {
            colorContainer.append('div')
                .style('font-size',   '9px')
                .style('text-align',  'center')
                .style('color',       '#4CAF50')
                .style('font-weight', 'bold')
                .text('Current');
        }
    });

    picker.append('button')
        .text('Close')
        .style('margin-top',    '10px')
        .style('width',         '100%')
        .style('padding',       '8px')
        .style('cursor',        'pointer')
        .style('background',    '#f44336')
        .style('color',         'white')
        .style('border',        'none')
        .style('border-radius', '4px')
        .style('font-weight',   'bold')
        .on('click', function() { d3.select('#color-picker').remove(); });

    d3.select('body').on('click.color-picker', function() {
        if (!picker.node().contains(d3.event.target) && !targetElement.contains(d3.event.target)) {
            d3.select('#color-picker').remove();
            d3.select('body').on('click.color-picker', null);
        }
    });
};
