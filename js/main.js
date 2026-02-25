// ===== Application Entry Point =====
// Coordinates: event listeners, settings, and graph update lifecycle.
// Table, modal, wizard and export logic live in their own submodules.

var currentData   = null;
var updateTimeout = null;

// Debounce rapid slider changes (150 ms wait before redrawing)
function debounceUpdate() {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(function() { updateGraph(); }, 150);
}

// ===== Status Dropdown =====

function toggleStatusDropdown(prefix) {
    const panel  = document.getElementById(prefix + 'StatusPanel');
    const isOpen = panel.classList.contains('open');
    document.querySelectorAll('.status-dropdown-panel').forEach(p => p.classList.remove('open'));
    if (!isOpen) panel.classList.add('open');
}

function updateStatusSummary(prefix) {
    const statuses = [];
    if (document.getElementById(prefix + 'Dead')?.checked)               statuses.push('Dead');
    if (document.getElementById(prefix + 'GeneticTesting')?.checked)     statuses.push('Genetic Testing');
    if (document.getElementById(prefix + 'Infertile')?.checked)          statuses.push('Infertile');
    if (document.getElementById(prefix + 'NoChildrenByChoice')?.checked) statuses.push('No Children');
    if (document.getElementById(prefix + 'WasAdopted')?.checked)         statuses.push('Adopted');

    const summary = document.getElementById(prefix + 'StatusSummary');
    if (summary) {
        summary.textContent = statuses.length > 0 ? statuses.join(', ') : 'No special status';
    }
}

// ===== Core Data Flow =====

async function processData(text) {
    const individuals = IOManager.importData(text, 'csv');
    if (individuals) {
        populateTable(individuals);
        const data = buildGraphData(individuals);
        currentData = data;
        await renderGenogram(data);
    }
}

function updateSettings() {
    window.genogramSettings = {
        nodeSize:           document.getElementById('nodeSize').value,
        rankSep:            document.getElementById('rankSep').value,
        nodeSep:            document.getElementById('nodeSep').value,
        fontSize:           document.getElementById('fontSize').value,
        textDist:           document.getElementById('textDist').value,
        fontFamily:         document.getElementById('fontFamily').value,
        noteMaxWidth:       document.getElementById('noteMaxWidth').value,
        geneticTestOffset:  document.getElementById('geneticTestOffset').value,
        geneticTestWidth:   document.getElementById('geneticTestWidth').value
    };
    saveSettings();
}

function saveSettings() {
    const settings = {
        ...window.genogramSettings,
        grayscaleMode: window.grayscaleMode,
        showNames: window.showNames,
        showNotes: window.showNotes,
        showConditions: window.showConditions,
        coupleStraightLines: window.coupleStraightLines
    };
    localStorage.setItem('genogramSettings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('genogramSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            
            // Restore display toggles
            if (settings.grayscaleMode !== undefined) {
                window.grayscaleMode = settings.grayscaleMode;
                document.getElementById('grayscaleMode').checked = settings.grayscaleMode;
            }
            if (settings.showNames !== undefined) {
                window.showNames = settings.showNames;
                document.getElementById('showNames').checked = settings.showNames;
            }
            if (settings.showNotes !== undefined) {
                window.showNotes = settings.showNotes;
                document.getElementById('showNotes').checked = settings.showNotes;
            }
            if (settings.showConditions !== undefined) {
                window.showConditions = settings.showConditions;
                document.getElementById('showConditions').checked = settings.showConditions;
            }
            if (settings.coupleStraightLines !== undefined) {
                window.coupleStraightLines = settings.coupleStraightLines;
                document.getElementById('coupleLineStyle').checked = settings.coupleStraightLines;
            }

            // Restore sliders and selects
            const inputs = ['nodeSize', 'rankSep', 'nodeSep', 'fontSize', 'textDist', 'fontFamily', 'noteMaxWidth', 'geneticTestOffset', 'geneticTestWidth'];
            inputs.forEach(id => {
                if (settings[id] !== undefined) {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = settings[id];
                        const valEl = document.getElementById(id + 'Val');
                        if (valEl) valEl.textContent = settings[id];
                    }
                }
            });
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }
}

async function updateGraph() {
    const data = getTableData();
    const graphData = buildGraphData(data);
    currentData = graphData;
    await renderGenogram(graphData);
}

// ===== DOMContentLoaded: Wire Up All UI Events =====

document.addEventListener('DOMContentLoaded', function() {

    // --- Import File Upload ---
    document.getElementById('importFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const format = document.getElementById('importFormat').value;
        const reader = new FileReader();
        reader.onload = function(e) {
            const individuals = IOManager.importData(e.target.result, format);
            if (individuals) {
                populateTable(individuals);
                const data = buildGraphData(individuals);
                currentData = data;
                renderGenogram(data);
            } else {
                alert("Failed to import data. Please check the file format.");
            }
        };
        reader.readAsText(file);
        // Reset input so the same file can be selected again
        e.target.value = '';
    });

    // --- Table Controls ---
    document.getElementById('updateBtn').addEventListener('click', function() {
        updateGraph();
    });

    document.getElementById('openDataEditorBtn').addEventListener('click', function() {
        openDataEditorModal();
    });

    document.getElementById('addRowBtn').addEventListener('click', function() {
        addTableRow(['', '', '', '', '0', 'None', '0', '0', '0', '0', '0']);
    });

    // --- New Tree Button ---
    document.getElementById('newTreeBtn').addEventListener('click', function() {
        openSetupWizard();
    });

    // --- Settings Sliders (debounced) ---
    const settingsInputs = ['nodeSize', 'rankSep', 'nodeSep', 'fontSize', 'textDist',
                            'noteMaxWidth', 'geneticTestOffset', 'geneticTestWidth'];
    settingsInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
            document.getElementById(id + 'Val').textContent = e.target.value;
            updateSettings();
            debounceUpdate();
        });
    });

    document.getElementById('fontFamily').addEventListener('change', function() {
        updateSettings();
        updateGraph();
    });

    // --- Export / Download ---
    document.getElementById('exportBtn').addEventListener('click', function() {
        const format = document.getElementById('exportFormat').value;
        const individuals = getTableData();
        
        if (format === 'png') {
            exportPNG(function(pngUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = 'genogram.png';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            });
        } else if (format === 'svg') {
            const svgContent = IOManager.exportData(individuals, 'svg');
            IOManager.downloadFile(svgContent, 'genogram.svg', 'image/svg+xml;charset=utf-8;');
        } else {
            const content = IOManager.exportData(individuals, format);
            if (content) {
                let mimeType = 'text/plain;charset=utf-8;';
                let ext = format;
                if (format === 'csv') mimeType = 'text/csv;charset=utf-8;';
                if (format === 'json' || format === 'fhir') mimeType = 'application/json;charset=utf-8;';
                if (format === 'gedcom') ext = 'ged';
                
                IOManager.downloadFile(content, `genogram.${ext}`, mimeType);
            }
        }
    });

    // --- Display Mode Toggles ---
    document.getElementById('grayscaleMode').addEventListener('change', function(e) {
        window.grayscaleMode = e.target.checked;
        saveSettings();
        updateGraph();
    });

    document.getElementById('showNames').addEventListener('change', function(e) {
        window.showNames = e.target.checked;
        saveSettings();
        updateGraph();
    });

    document.getElementById('showNotes').addEventListener('change', function(e) {
        window.showNotes = e.target.checked;
        saveSettings();
        updateGraph();
    });

    document.getElementById('showConditions').addEventListener('change', function(e) {
        window.showConditions = e.target.checked;
        saveSettings();
        updateGraph();
    });

    document.getElementById('coupleLineStyle').addEventListener('change', function(e) {
        window.coupleStraightLines = e.target.checked;
        saveSettings();
        updateGraph();
    });

    // --- Zoom Controls ---
    document.getElementById('zoomIn').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg) {
            window.currentSvg.transition().duration(300).call(window.currentZoom.scaleBy, 1.3);
        }
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg) {
            window.currentSvg.transition().duration(300).call(window.currentZoom.scaleBy, 0.77);
        }
    });

    document.getElementById('zoomReset').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg && window.initialTransform) {
            window.currentSvg.transition().duration(500)
                .call(window.currentZoom.transform, window.initialTransform);
        }
    });

    // --- Status Dropdown Buttons ---
    document.getElementById('editStatusBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStatusDropdown('edit');
    });

    document.getElementById('addRelatedStatusBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStatusDropdown('addRelated');
    });

    // Status checkbox → update summary text
    ['Dead', 'GeneticTesting', 'Infertile', 'NoChildrenByChoice', 'WasAdopted'].forEach(field => {
        const editEl = document.getElementById('edit' + field);
        if (editEl) editEl.addEventListener('change', () => updateStatusSummary('edit'));

        const addEl = document.getElementById('addRelated' + field);
        if (addEl) addEl.addEventListener('change', () => updateStatusSummary('addRelated'));
    });

    // Close status dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.status-dropdown-container')) {
            document.querySelectorAll('.status-dropdown-panel').forEach(p => p.classList.remove('open'));
        }
    });

    // --- Sidebar Resizing ---
    const sidebar   = document.querySelector('.sidebar');
    const resizer   = document.getElementById('sidebarResizer');
    let isResizing  = false;

    resizer.addEventListener('mousedown', function() {
        if (sidebar.classList.contains('collapsed')) return;
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        let newWidth = Math.min(Math.max(e.clientX, 250), 600);
        sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor     = '';
            document.body.style.userSelect = '';
            updateGraph(); // Re-center graph after resize
        }
    });

    // --- Sidebar Navigation ---
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            if (sidebar.classList.contains('collapsed')) {
                sidebar.style.width = ''; // Reset inline width
            } else {
                sidebar.style.width = '400px'; // Default expanded width
            }
            setTimeout(updateGraph, 300); // Re-center graph after animation
        });
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            // If collapsed, expand it
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                sidebar.style.width = '400px';
                setTimeout(updateGraph, 300);
            }

            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Show target panel
            const targetId = this.getAttribute('data-target');
            document.querySelectorAll('.nav-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Collapsible Panels ---
    document.querySelectorAll('.panel.collapsible > h2, .panel.collapsible > .panel-header')
        .forEach(header => {
            header.addEventListener('click', function() {
                this.parentElement.classList.toggle('collapsed');
            });
        });

    // --- Mobile Menu ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    function toggleMobileMenu() {
        sidebar.classList.toggle('open');
        mobileOverlay.classList.toggle('active');
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleMobileMenu);
    if (mobileOverlay) mobileOverlay.addEventListener('click', toggleMobileMenu);

    // --- Initialise Defaults ---
    window.grayscaleMode      = true;
    window.showNames          = false;
    window.showNotes          = false;
    window.showConditions     = true;
    window.coupleStraightLines = true;

    document.getElementById('grayscaleMode').checked = true;
    document.getElementById('coupleLineStyle').checked = true;
    
    loadSettings();
    updateSettings();

    // Open the setup wizard on first load
    openSetupWizard();
});
