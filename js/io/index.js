// ===== IO Manager =====

const IOManager = {
    importData: function(text, format) {
        switch (format) {
            case 'csv':
                return importCSV(text);
            case 'json':
                return importJSON(text);
            case 'gedcom':
                return importGEDCOM(text);
            case 'fhir':
                return importFHIR(text);
            case 'ped':
                return importPED(text);
            default:
                console.error("Unsupported import format:", format);
                return null;
        }
    },

    exportData: function(individuals, format) {
        switch (format) {
            case 'csv':
                return exportCSV(individuals);
            case 'json':
                return exportJSON(individuals);
            case 'gedcom':
                return exportGEDCOM(individuals);
            case 'fhir':
                return exportFHIR(individuals);
            case 'ped':
                return exportPED(individuals);
            case 'svg':
                return exportSVG();
            default:
                console.error("Unsupported export format:", format);
                return null;
        }
    },

    downloadFile: function(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        const url  = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
