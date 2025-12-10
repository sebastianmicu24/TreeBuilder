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
        addTableRow(['', '', '', '', '0', 'None', 'N/A']);
    });

    // Handle Settings Changes
    const settingsInputs = ['nodeSize', 'rankSep', 'nodeSep', 'fontSize', 'textDist'];
    settingsInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
            document.getElementById(id + 'Val').textContent = e.target.value;
            updateSettings();
            updateGraph();
        });
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

    // Initialize settings and modes
    window.grayscaleMode = false;
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
            addTableRow(['Patient', 'John', 'M', 'Patient', '0', 'None', 'N/A']);
            addTableRow(['Partner("John")', 'Mary', 'F', 'Wife', '0', 'None', 'N/A']);
            addTableRow(['Son("John")', 'Bob', 'M', 'Son', '0', 'None', 'N/A']);
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
            ind.condition,
            ind.value ? ind.value.toFixed(4) : 'N/A'
        ]);
    });
}

function addTableRow(data) {
    const tbody = document.querySelector('#dataTable tbody');
    const tr = document.createElement('tr');
    
    // Create cells - last cell (value) should be read-only
    data.forEach((text, index) => {
        const td = document.createElement('td');
        // Make value column (index 6) read-only
        if (index === 6) {
            td.contentEditable = false;
            td.style.backgroundColor = '#f8fafc';
            td.style.color = '#64748b';
        } else {
            td.contentEditable = true;
        }
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
        textDist: document.getElementById('textDist').value
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
    
    // Title
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.textContent = "Clinical Genogram";
    title.setAttribute("x", 0);
    title.setAttribute("y", 0);
    title.setAttribute("font-family", "sans-serif");
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
        textEl.setAttribute("font-family", "sans-serif");
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
        // Value is in cells[6] but we don't read it - it will be recalculated

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
    
    addTableRow([roleStr, newId, sex, notes, '0', 'None', 'N/A']);
    closeEditModal();
    updateGraph();
}
