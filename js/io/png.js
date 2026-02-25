// ===== PNG Export =====

function exportPNG(callback) {
    const sourceWithXml = exportSVG();
    
    const image  = new Image();
    image.src    = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sourceWithXml);

    image.onload = function() {
        // Parse the SVG string to get dimensions
        const parser = new DOMParser();
        const doc = parser.parseFromString(sourceWithXml, "image/svg+xml");
        const svgEl = doc.documentElement;
        
        const width = parseFloat(svgEl.getAttribute('width'));
        const height = parseFloat(svgEl.getAttribute('height'));

        const canvas  = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        const pngUrl = canvas.toDataURL('image/png');
        if (callback) callback(pngUrl);
    };
}
