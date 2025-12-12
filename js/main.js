var currentData = null;

document.addEventListener('DOMContentLoaded', function() {
    // Handle file upload
    const fileInput = document.getElementById('csvFile');
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            processData(text);
        };
        reader.readAsText(file);
    });

    // Handle manual update from table
    document.getElementById('updateBtn').addEventListener('click', function() {
        updateGraph();
    });

    // Handle Add Row
    document.getElementById('addRowBtn').addEventListener('click', function() {
        addTableRow(['', '', '', '', '0', 'None']);
    });

    // Handle Tree Presets
    document.getElementById('presetPatientBtn').addEventListener('click', function() {
        loadPresetTree('patient');
    });
    
    document.getElementById('presetGrandparentsBtn').addEventListener('click', function() {
        loadPresetTree('grandparents');
    });
    
    document.getElementById('presetGreatGrandparentsBtn').addEventListener('click', function() {
        loadPresetTree('greatgrandparents');
    });

    // Handle Settings Changes
    const settingsInputs = ['nodeSize', 'rankSep', 'nodeSep', 'fontSize', 'textDist', 'noteMaxWidth'];
    settingsInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
            document.getElementById(id + 'Val').textContent = e.target.value;
            updateSettings();
            updateGraph();
        });
    });

    // Handle Font Family Change
    document.getElementById('fontFamily').addEventListener('change', function(e) {
        updateSettings();
        updateGraph();
    });

    // Handle Export PNG
    document.getElementById('exportBtn').addEventListener('click', function() {
        exportToPng();
    });

    // Handle Download CSV
    document.getElementById('downloadCsvBtn').addEventListener('click', function() {
        downloadCsv();
    });

    // Handle Grayscale Mode Toggle
    document.getElementById('grayscaleMode').addEventListener('change', function(e) {
        window.grayscaleMode = e.target.checked;
        updateGraph();
    });

    // Handle Display Options
    document.getElementById('showNames').addEventListener('change', function(e) {
        window.showNames = e.target.checked;
        updateGraph();
    });

    document.getElementById('showNotes').addEventListener('change', function(e) {
        window.showNotes = e.target.checked;
        updateGraph();
    });

    document.getElementById('showConditions').addEventListener('change', function(e) {
        window.showConditions = e.target.checked;
        updateGraph();
    });

    // Handle Zoom Controls
    document.getElementById('zoomIn').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg) {
            window.currentSvg.transition().duration(300).call(
                window.currentZoom.scaleBy, 1.3
            );
        }
    });

    document.getElementById('zoomOut').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg) {
            window.currentSvg.transition().duration(300).call(
                window.currentZoom.scaleBy, 0.77
            );
        }
    });

    document.getElementById('zoomReset').addEventListener('click', function() {
        if (window.currentZoom && window.currentSvg && window.initialTransform) {
            window.currentSvg.transition().duration(500).call(
                window.currentZoom.transform, window.initialTransform
            );
        }
    });

    // Initialize settings and modes
    window.grayscaleMode = true; // Set grayscale as default
    document.getElementById('grayscaleMode').checked = true; // Update UI
    window.showNames = false;
    window.showNotes = false;
    window.showConditions = true;
    updateSettings();

    // Handle Sidebar Resizing
    const sidebar = document.querySelector('.sidebar');
    const resizer = document.getElementById('sidebarResizer');
    let isResizing = false;

    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        // Calculate new width
        // e.clientX is the mouse position
        // We want to limit the width between min and max
        let newWidth = e.clientX;
        if (newWidth < 250) newWidth = 250;
        if (newWidth > 600) newWidth = 600;
        
        sidebar.style.width = newWidth + 'px';
        
        // Trigger graph resize/center if needed (optional, but good for responsiveness)
        // Since the SVG is responsive (width: 100%), we might want to re-center the graph
        // But doing it on every mousemove is expensive. Maybe on mouseup.
    });

    document.addEventListener('mouseup', function(e) {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Re-center graph after resize
            updateGraph();
        }
    });

    // Handle Collapsible Panels
    document.querySelectorAll('.panel.collapsible > h2, .panel.collapsible > .panel-header').forEach(header => {
        header.addEventListener('click', function() {
            this.parentElement.classList.toggle('collapsed');
        });
    });

    // Try to load default data.csv (will fail if CORS is blocked, e.g. file:// protocol)
    fetch("data.csv")
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.text();
        })
        .then(text => {
            processData(text);
        })
        .catch(error => {
            console.log("Could not load default data.csv (likely CORS or file not found). Please use file upload.");
            // Initialize empty table if load fails
            addTableRow(['Patient', 'John', 'M', 'Patient', '0', 'None']);
            addTableRow(['Partner("John")', 'Mary', 'F', 'Wife', '0', 'None']);
            addTableRow(['Child("John")', 'Bob', 'M', 'Son', '0', 'None']);
        });
});

function processData(text) {
    const individuals = parseCSV(text);
    populateTable(individuals);
    const data = buildGraphData(individuals);
    currentData = data;
    renderGenogram(data);
}

function populateTable(individuals) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    
    Object.values(individuals).forEach(ind => {
        addTableRow([
            ind.roleStr,
            ind.id,
            ind.sex,
            ind.notes,
            ind.dead ? '1' : '0',
            ind.condition
        ]);
    });
}

function addTableRow(data) {
    const tbody = document.querySelector('#dataTable tbody');
    const tr = document.createElement('tr');
    
    // Create cells - all editable
    data.forEach((text, index) => {
        const td = document.createElement('td');
        td.contentEditable = true;
        td.textContent = text;
        tr.appendChild(td);
    });

    // Add delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;'; // Use HTML entity for multiplication sign (X)
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Remove row';
    deleteBtn.onclick = function() {
        tr.remove();
    };
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
}

function updateSettings() {
    window.genogramSettings = {
        nodeSize: document.getElementById('nodeSize').value,
        rankSep: document.getElementById('rankSep').value,
        nodeSep: document.getElementById('nodeSep').value,
        fontSize: document.getElementById('fontSize').value,
        textDist: document.getElementById('textDist').value,
        fontFamily: document.getElementById('fontFamily').value,
        noteMaxWidth: document.getElementById('noteMaxWidth').value
    };
}

function updateGraph() {
    const data = getTableData();
    const graphData = buildGraphData(data);
    currentData = graphData;
    renderGenogram(graphData);
}

function exportToPng() {
    const svg = document.querySelector('#genogram');
    const contentGroup = svg.querySelector('g');
    
    // Get the bounding box of the content (untransformed)
    const bbox = contentGroup.getBBox();
    
    // Clone the content to manipulate it for export
    const clone = contentGroup.cloneNode(true);
    clone.setAttribute('transform', ''); // Reset transform
    
    // --- Build Legend SVG ---
    const legendGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const legendItems = document.querySelectorAll('#legend .legend-item');
    let legendHeight = 0;
    const legendWidth = 200; // Estimated width
    
    // Get current font family setting
    const exportFontFamily = window.genogramSettings ? window.genogramSettings.fontFamily : 'Inter';
    
    // Title
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.textContent = "Clinical Genogram";
    title.setAttribute("x", 0);
    title.setAttribute("y", 0);
    title.setAttribute("font-family", exportFontFamily);
    title.setAttribute("font-size", "18px");
    title.setAttribute("font-weight", "bold");
    title.setAttribute("fill", "#1e293b");
    legendGroup.appendChild(title);
    legendHeight += 30;

    let yOffset = legendHeight;
    legendItems.forEach(item => {
        const colorDiv = item.querySelector('.legend-color');
        const textSpan = item.querySelector('span');
        const color = colorDiv.style.backgroundColor;
        const text = textSpan.textContent;
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", 0);
        rect.setAttribute("y", yOffset - 10);
        rect.setAttribute("width", 12);
        rect.setAttribute("height", 12);
        rect.setAttribute("fill", color);
        rect.setAttribute("stroke", "#333");
        rect.setAttribute("stroke-width", "1");
        
        const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textEl.textContent = text;
        textEl.setAttribute("x", 20);
        textEl.setAttribute("y", yOffset);
        textEl.setAttribute("font-family", exportFontFamily);
        textEl.setAttribute("font-size", "12px");
        textEl.setAttribute("fill", "#333");
        
        legendGroup.appendChild(rect);
        legendGroup.appendChild(textEl);
        
        yOffset += 20;
    });
    legendHeight = yOffset;

    // Position legend above the graph
    // We'll place the legend at (bbox.x, bbox.y - legendHeight - gap)
    const gap = 40;
    legendGroup.setAttribute("transform", `translate(${bbox.x}, ${bbox.y - legendHeight - gap})`);

    // --- Create Export SVG ---
    const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const padding = 40;
    
    // Calculate total bounds
    // Top-left is now (bbox.x, bbox.y - legendHeight - gap)
    // Bottom-right is (bbox.x + bbox.width, bbox.y + bbox.height)
    // Width is max(bbox.width, legendWidth)
    
    const minX = bbox.x;
    const minY = bbox.y - legendHeight - gap;
    const width = Math.max(bbox.width, legendWidth);
    const height = (bbox.y + bbox.height) - minY;
    
    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;
    const viewBoxW = width + padding * 2;
    const viewBoxH = height + padding * 2;
    
    exportSvg.setAttribute("width", viewBoxW);
    exportSvg.setAttribute("height", viewBoxH);
    exportSvg.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`);
    
    exportSvg.appendChild(legendGroup);
    exportSvg.appendChild(clone);
    
    // Serialize
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(exportSvg);
    
    // Add XML declaration
    const sourceWithXml = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    
    // Convert SVG string to data URL
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sourceWithXml);
    
    image.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = viewBoxW;
        canvas.height = viewBoxH;
        
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw image
        context.drawImage(image, 0, 0);
        
        const pngUrl = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'genogram.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };
}

function getTableData() {
    const individuals = {};
    const rows = document.querySelectorAll('#dataTable tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;

        const roleStr = cells[0].textContent.trim();
        const id = cells[1].textContent.trim();
        const sex = cells[2].textContent.trim();
        const notes = cells[3].textContent.trim();
        const dead = cells[4].textContent.trim();
        const condition = cells[5].textContent.trim();

        if (!id) return; // Skip empty rows

        individuals[id] = {
            id: id,
            sex: sex,
            notes: notes,
            dead: dead === '1',
            condition: condition || "None",
            roleStr: roleStr
        };
    });

    return individuals;
}
function downloadCsv() {
    const rows = document.querySelectorAll('#dataTable tbody tr');
    let csvContent = 'Role;Id;Sex;Notes;Dead;Condition\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;
        
        const roleStr = cells[0].textContent.trim();
        const id = cells[1].textContent.trim();
        const sex = cells[2].textContent.trim();
        const notes = cells[3].textContent.trim();
        const dead = cells[4].textContent.trim();
        const condition = cells[5].textContent.trim();
        
        if (!id) return; // Skip empty rows
        
        // Quote fields that might contain semicolons
        const quotedRole = roleStr.includes(';') ? `"${roleStr}"` : roleStr;
        const quotedId = `"${id}"`;
        const quotedNotes = notes.includes(';') ? `"${notes}"` : `"${notes}"`;
        const quotedCondition = condition.includes(';') ? `"${condition}"` : condition;
        
        csvContent += `${quotedRole};${quotedId};${sex};${quotedNotes};${dead};${quotedCondition}\n`;
    });
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'genogram_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
var currentEditingPerson = null;

function openEditModal(personId) {
    const rows = document.querySelectorAll('#dataTable tbody tr');
    let personData = null;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const id = cells[1]?.textContent.trim();
        if (id === personId) {
            personData = {
                role: cells[0].textContent.trim(),
                id: id,
                sex: cells[2].textContent.trim(),
                notes: cells[3].textContent.trim(),
                dead: cells[4].textContent.trim() === '1',
                condition: cells[5].textContent.trim()
            };
        }
    });
    
    if (!personData) return;
    
    currentEditingPerson = personId;
    document.getElementById('editId').value = personData.id;
    document.getElementById('editSex').value = personData.sex;
    document.getElementById('editNotes').value = personData.notes;
    document.getElementById('editDead').checked = personData.dead;
    document.getElementById('editCondition').value = personData.condition;
    document.getElementById('editRole').value = personData.role;
    
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditingPerson = null;
}

function savePersonEdit() {
    if (!currentEditingPerson) return;
    
    const rows = document.querySelectorAll('#dataTable tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const id = cells[1]?.textContent.trim();
        if (id === currentEditingPerson) {
            cells[2].textContent = document.getElementById('editSex').value;
            cells[3].textContent = document.getElementById('editNotes').value;
            cells[4].textContent = document.getElementById('editDead').checked ? '1' : '0';
            cells[5].textContent = document.getElementById('editCondition').value;
        }
    });
    
    closeEditModal();
    updateGraph();
}

function addRelated(relationType) {
    if (!currentEditingPerson) return;
    
    const newId = prompt(`Enter ID for new ${relationType}:`);
    if (!newId) return;
    
    const sex = prompt('Enter sex (M/F/Unknown):', relationType === 'Parent' ? 'M' : 'F');
    const notes = prompt('Enter notes:', '');
    
    let roleStr = '';
    switch(relationType) {
        case 'Parent':
            roleStr = `Parent("${currentEditingPerson}")`;
            break;
        case 'Child':
            roleStr = `Child("${currentEditingPerson}")`;
            break;
        case 'Sibling':
            roleStr = `Sibling("${currentEditingPerson}")`;
            break;
        case 'Partner':
            roleStr = `Partner("${currentEditingPerson}")`;
            break;
    }
    
    addTableRow([roleStr, newId, sex, notes, '0', 'None']);
    closeEditModal();
    updateGraph();
}

function loadPresetTree(presetType) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    
    if (presetType === 'patient') {
        // Only patient
        addTableRow(['Patient', 'Patient', 'M', 'Proband', '0', 'None']);
    } else if (presetType === 'grandparents') {
        // Patient, parents, and 4 grandparents
        addTableRow(['Patient', 'Patient', 'M', 'Proband', '0', 'None']);
        
        // Parents
        addTableRow(['Parent("Patient")', 'Father', 'M', 'Father', '0', 'None']);
        addTableRow(['Parent("Patient")', 'Mother', 'F', 'Mother', '0', 'None']);
        
        // Paternal grandparents
        addTableRow(['Parent("Father")', 'GF_P', 'M', 'Paternal Grandfather', '0', 'None']);
        addTableRow(['Parent("Father")', 'GM_P', 'F', 'Paternal Grandmother', '0', 'None']);
        
        // Maternal grandparents
        addTableRow(['Parent("Mother")', 'GF_M', 'M', 'Maternal Grandfather', '0', 'None']);
        addTableRow(['Parent("Mother")', 'GM_M', 'F', 'Maternal Grandmother', '0', 'None']);
    } else if (presetType === 'greatgrandparents') {
        // Patient, parents, 4 grandparents, and 8 great-grandparents
        addTableRow(['Patient', 'Patient', 'M', 'Proband', '0', 'None']);
        
        // Parents
        addTableRow(['Parent("Patient")', 'Father', 'M', 'Father', '0', 'None']);
        addTableRow(['Parent("Patient")', 'Mother', 'F', 'Mother', '0', 'None']);
        
        // Paternal grandparents
        addTableRow(['Parent("Father")', 'GF_P', 'M', 'Paternal Grandfather', '0', 'None']);
        addTableRow(['Parent("Father")', 'GM_P', 'F', 'Paternal Grandmother', '0', 'None']);
        
        // Maternal grandparents
        addTableRow(['Parent("Mother")', 'GF_M', 'M', 'Maternal Grandfather', '0', 'None']);
        addTableRow(['Parent("Mother")', 'GM_M', 'F', 'Maternal Grandmother', '0', 'None']);
        
        // Paternal great-grandparents (father's side)
        addTableRow(['Parent("GF_P")', 'GGF_PP', 'M', 'Great-Grandfather (PP)', '0', 'None']);
        addTableRow(['Parent("GF_P")', 'GGM_PP', 'F', 'Great-Grandmother (PP)', '0', 'None']);
        addTableRow(['Parent("GM_P")', 'GGF_PM', 'M', 'Great-Grandfather (PM)', '0', 'None']);
        addTableRow(['Parent("GM_P")', 'GGM_PM', 'F', 'Great-Grandmother (PM)', '0', 'None']);
        
        // Maternal great-grandparents (mother's side)
        addTableRow(['Parent("GF_M")', 'GGF_MP', 'M', 'Great-Grandfather (MP)', '0', 'None']);
        addTableRow(['Parent("GF_M")', 'GGM_MP', 'F', 'Great-Grandmother (MP)', '0', 'None']);
        addTableRow(['Parent("GM_M")', 'GGF_MM', 'M', 'Great-Grandfather (MM)', '0', 'None']);
        addTableRow(['Parent("GM_M")', 'GGM_MM', 'F', 'Great-Grandmother (MM)', '0', 'None']);
    }
    
    updateGraph();
}
