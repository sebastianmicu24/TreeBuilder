// ===== Legend Rendering =====

function renderLegend(conditions, isGrayscale) {
    const legend = d3.select('#legend');
    legend.html(''); // Clear existing

    if (isGrayscale) {
        conditions.forEach(cond => {
            const patternId       = window.patternManager.getPatternForCondition(cond);
            const patternImagePath = window.patternManager.getPatternPreview(patternId);

            const item = legend.append('div').attr('class', 'legend-item');

            // Clickable pattern icon
            const colorDiv = item.append('div')
                .attr('class', 'legend-color')
                .style('cursor',     'pointer')
                .style('position',   'relative')
                .style('transition', 'transform 0.2s, box-shadow 0.2s')
                .on('click', function() {
                    d3.event.stopPropagation();
                    if (typeof window.showPatternPicker === 'function') {
                        window.showPatternPicker(cond, this);
                    }
                })
                .on('mouseenter', function() {
                    d3.select(this)
                        .style('transform',  'scale(1.1)')
                        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .style('transform',  'scale(1)')
                        .style('box-shadow', 'none');
                });

            colorDiv.append('img')
                .attr('src', patternImagePath)
                .attr('alt', cond)
                .style('width',          '100%')
                .style('height',         '100%')
                .style('object-fit',     'cover')
                .style('display',        'block')
                .style('pointer-events', 'none'); // Prevent img from blocking clicks

            item.append('span').text(cond);
        });

        // "None/Healthy" entry
        const noneItem = legend.append('div').attr('class', 'legend-item');
        noneItem.append('div').attr('class', 'legend-color')
            .style('background-color', '#fff')
            .style('border', '1px solid #333');
        noneItem.append('span').text('None/Healthy');

    } else {
        conditions.forEach(cond => {
            const item = legend.append('div').attr('class', 'legend-item');

            // Clickable color box
            item.append('div')
                .attr('class', 'legend-color')
                .style('background-color', window.patternManager.getColorForCondition(cond))
                .style('cursor',           'pointer')
                .style('transition',       'transform 0.2s, box-shadow 0.2s')
                .on('click', function() {
                    d3.event.stopPropagation();
                    if (typeof window.showColorPicker === 'function') {
                        window.showColorPicker(cond, this);
                    }
                })
                .on('mouseenter', function() {
                    d3.select(this)
                        .style('transform',  'scale(1.1)')
                        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.3)');
                })
                .on('mouseleave', function() {
                    d3.select(this)
                        .style('transform',  'scale(1)')
                        .style('box-shadow', 'none');
                });

            item.append('span').text(cond);
        });

        // "None/Healthy" entry
        const noneItem = legend.append('div').attr('class', 'legend-item');
        noneItem.append('div').attr('class', 'legend-color')
            .style('background-color', '#fff')
            .style('border', '1px solid #333');
        noneItem.append('span').text('None/Healthy');
    }
}
