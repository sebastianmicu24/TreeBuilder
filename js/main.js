var currentData = null;
var updateTimeout = null;

// Debounce function to prevent rapid consecutive updates
function debounceUpdate() {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(function() {
        updateGraph();
    }, 150); // Wait 150ms after last change before updating
}

// ===== Status Dropdown =====
function toggleStatusDropdown(prefix) {
    const panel = document.getElementById(prefix + 'StatusPanel');
    const isOpen = panel.classList.contains('open');
    // Close all dropdowns first
    document.querySelectorAll('.status-dropdown-panel').forEach(p => p.classList.remove('open'));
    // Toggle this one
    if (!isOpen) panel.classList.add('open');
}

function updateStatusSummary(prefix) {
    const statuses = [];
    if (document.getElementById(prefix + 'Dead')?.checked) statuses.push('Dead');
    if (document.getElementById(prefix + 'GeneticTesting')?.checked) statuses.push('Genetic Testing');
    if (document.getElementById(prefix + 'Infertile')?.checked) statuses.push('Infertile');
    if (document.getElementById(prefix + 'NoChildrenByChoice')?.checked) statuses.push('No Children');
    if (document.getElementById(prefix + 'WasAdopted')?.checked) statuses.push('Adopted');

    const summary = document.getElementById(prefix + 'StatusSummary');
    if (summary) {
        summary.textContent = statuses.length > 0 ? statuses.join(', ') : 'No special status';
    }
}

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
        addTableRow(['', '', '', '', '0', 'None', '0', '0', '0', '0', '0']);
    });

    // Handle New Tree button
    document.getElementById('newTreeBtn').addEventListener('click', function() {
        openSetupWizard();
    });

    // Handle Settings Changes with debouncing
    const settingsInputs = ['nodeSize', 'rankSep', 'nodeSep', 'fontSize', 'textDist', 'noteMaxWidth', 'geneticTestOffset', 'geneticTestWidth'];
    settingsInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
            document.getElementById(id + 'Val').textContent = e.target.value;
            updateSettings();
            debounceUpdate(); // Use debounced update instead of immediate update
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

    // Handle Couple Line Style Toggle
    document.getElementById('coupleLineStyle').addEventListener('change', function(e) {
        window.coupleStraightLines = e.target.checked;
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

    // Status dropdown toggle buttons
    document.getElementById('editStatusBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStatusDropdown('edit');
    });

    document.getElementById('addRelatedStatusBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleStatusDropdown('addRelated');
    });

    // Status checkbox change handlers - update summary on change
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

    // Initialize settings and modes
    window.grayscaleMode = true; // Set grayscale as default
    document.getElementById('grayscaleMode').checked = true; // Update UI
    window.showNames = false;
    window.showNotes = false;
    window.showConditions = true;
    window.coupleStraightLines = false; // Default to angular lines
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
        let newWidth = e.clientX;
        if (newWidth < 250) newWidth = 250;
        if (newWidth > 600) newWidth = 600;
        
        sidebar.style.width = newWidth + 'px';
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

    // Open setup wizard on first load
    openSetupWizard();
});

async function processData(text) {
    const individuals = parseCSV(text);
    populateTable(individuals);
    const data = buildGraphData(individuals);
    currentData = data;
    await renderGenogram(data);
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
            ind.geneticTesting ? '1' : '0',
            ind.siblingOrder !== undefined ? String(ind.siblingOrder) : '0',
            ind.infertile ? '1' : '0',
            ind.noChildrenByChoice ? '1' : '0',
            ind.wasAdopted ? '1' : '0'
        ]);
    });
}

function addTableRow(data) {
    // Ensure we always have 11 data columns (pad with '0' if needed)
    const paddedData = data.slice();
    while (paddedData.length < 11) paddedData.push('0');

    const tbody = document.querySelector('#dataTable tbody');
    const tr = document.createElement('tr');
    
    // Create cells - all editable
    paddedData.forEach((text, index) => {
        const td = document.createElement('td');
        td.contentEditable = true;
        td.textContent = text;
        tr.appendChild(td);
    });

    // Add delete button
    const actionTd = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;';
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
        noteMaxWidth: document.getElementById('noteMaxWidth').value,
        geneticTestOffset: document.getElementById('geneticTestOffset').value,
        geneticTestWidth: document.getElementById('geneticTestWidth').value
    };
}

async function updateGraph() {
    const data = getTableData();
    const graphData = buildGraphData(data);
    currentData = graphData;
    await renderGenogram(graphData);
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
    const gap = 40;
    legendGroup.setAttribute("transform", `translate(${bbox.x}, ${bbox.y - legendHeight - gap})`);

    // --- Create Export SVG ---
    const exportSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const padding = 40;
    
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
        if (cells.length < 8) return;

        const roleStr = cells[0].textContent.trim();
        const id = cells[1].textContent.trim();
        const sex = cells[2].textContent.trim();
        const notes = cells[3].textContent.trim();
        const dead = cells[4].textContent.trim();
        const condition = cells[5].textContent.trim();
        const geneticTesting = cells[6].textContent.trim();
        const siblingOrder = cells[7].textContent.trim();
        const infertile = cells[8]?.textContent.trim() || '0';
        const noChildrenByChoice = cells[9]?.textContent.trim() || '0';
        const wasAdopted = cells[10]?.textContent.trim() || '0';

        if (!id) return; // Skip empty rows

        // Parse conditions: split by comma if multiple conditions present
        let parsedCondition;
        if (condition && condition !== "None" && condition !== "") {
            const conditionList = condition.split(',').map(c => c.trim()).filter(c => c !== '' && c !== 'None');
            parsedCondition = conditionList.length > 1 ? conditionList : (conditionList[0] || "None");
        } else {
            parsedCondition = "None";
        }
        
        individuals[id] = {
            id: id,
            sex: sex,
            notes: notes,
            dead: dead === '1',
            condition: parsedCondition,
            geneticTesting: geneticTesting === '1',
            siblingOrder: siblingOrder ? parseInt(siblingOrder) || 0 : 0,
            infertile: infertile === '1',
            noChildrenByChoice: noChildrenByChoice === '1',
            wasAdopted: wasAdopted === '1',
            roleStr: roleStr
        };
    });

    return individuals;
}

function downloadCsv() {
    const rows = document.querySelectorAll('#dataTable tbody tr');
    let csvContent = 'Role;Id;Sex;Notes;Dead;Condition;GeneticTesting;SiblingOrder;Infertile;NoChildrenByChoice;WasAdopted\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 8) return;
        
        const roleStr = cells[0].textContent.trim();
        const id = cells[1].textContent.trim();
        const sex = cells[2].textContent.trim();
        const notes = cells[3].textContent.trim();
        const dead = cells[4].textContent.trim();
        const condition = cells[5].textContent.trim();
        const geneticTesting = cells[6].textContent.trim();
        const siblingOrder = cells[7].textContent.trim();
        const infertile = cells[8]?.textContent.trim() || '0';
        const noChildrenByChoice = cells[9]?.textContent.trim() || '0';
        const wasAdopted = cells[10]?.textContent.trim() || '0';
        
        if (!id) return;
        
        const quotedRole = roleStr.includes(';') ? `"${roleStr}"` : roleStr;
        const quotedId = `"${id}"`;
        const quotedNotes = `"${notes}"`;
        const quotedCondition = condition.includes(';') ? `"${condition}"` : condition;
        
        csvContent += `${quotedRole};${quotedId};${sex};${quotedNotes};${dead};${quotedCondition};${geneticTesting};${siblingOrder};${infertile};${noChildrenByChoice};${wasAdopted}\n`;
    });
    
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
                condition: cells[5].textContent.trim(),
                geneticTesting: cells[6].textContent.trim() === '1',
                siblingOrder: cells[7]?.textContent.trim() || '0',
                infertile: cells[8]?.textContent.trim() === '1',
                noChildrenByChoice: cells[9]?.textContent.trim() === '1',
                wasAdopted: cells[10]?.textContent.trim() === '1'
            };
        }
    });
    
    if (!personData) return;
    
    currentEditingPerson = personId;
    document.getElementById('editId').value = personData.id;
    document.getElementById('editSex').value = personData.sex;
    document.getElementById('editNotes').value = personData.notes;
    document.getElementById('editDead').checked = personData.dead;
    document.getElementById('editGeneticTesting').checked = personData.geneticTesting;
    document.getElementById('editInfertile').checked = personData.infertile;
    document.getElementById('editNoChildrenByChoice').checked = personData.noChildrenByChoice;
    document.getElementById('editWasAdopted').checked = personData.wasAdopted;
    document.getElementById('editCondition').value = personData.condition;
    document.getElementById('editSiblingOrder').value = personData.siblingOrder;
    
    // Update status summary button text
    updateStatusSummary('edit');
    
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    // Close any open status dropdown
    document.querySelectorAll('.status-dropdown-panel').forEach(p => p.classList.remove('open'));
    currentEditingPerson = null;
}

function savePersonEdit() {
    if (!currentEditingPerson) return;
    
    const newId = document.getElementById('editId').value.trim();
    if (!newId) {
        alert('ID cannot be empty');
        return;
    }
    
    // Check uniqueness if ID changed
    if (newId !== currentEditingPerson) {
        const rows = document.querySelectorAll('#dataTable tbody tr');
        let idExists = false;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const existingId = cells[1]?.textContent.trim();
            if (existingId === newId) {
                idExists = true;
            }
        });
        if (idExists) {
            alert('ID "' + newId + '" already exists. Please choose a unique ID.');
            return;
        }
    }
    
    const rows = document.querySelectorAll('#dataTable tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const id = cells[1]?.textContent.trim();
        if (id === currentEditingPerson) {
            cells[1].textContent = newId;
            cells[2].textContent = document.getElementById('editSex').value;
            cells[3].textContent = document.getElementById('editNotes').value;
            cells[4].textContent = document.getElementById('editDead').checked ? '1' : '0';
            cells[5].textContent = document.getElementById('editCondition').value;
            cells[6].textContent = document.getElementById('editGeneticTesting').checked ? '1' : '0';
            cells[7].textContent = document.getElementById('editSiblingOrder').value || '0';
            if (cells[8]) cells[8].textContent = document.getElementById('editInfertile').checked ? '1' : '0';
            if (cells[9]) cells[9].textContent = document.getElementById('editNoChildrenByChoice').checked ? '1' : '0';
            if (cells[10]) cells[10].textContent = document.getElementById('editWasAdopted').checked ? '1' : '0';
        }
        
        // Update role references if ID changed
        if (newId !== currentEditingPerson) {
            const roleStr = cells[0]?.textContent.trim();
            if (roleStr && roleStr.includes('"' + currentEditingPerson + '"')) {
                cells[0].textContent = roleStr.replace(
                    new RegExp('"' + currentEditingPerson.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'g'),
                    '"' + newId + '"'
                );
            }
        }
    });
    
    closeEditModal();
    updateGraph();
}

var currentAddRelationType = null;
var currentAddRelatedToPerson = null;

function addRelated(relationType) {
    if (!currentEditingPerson) return;
    
    currentAddRelationType = relationType;
    currentAddRelatedToPerson = currentEditingPerson;
    
    // Update modal info
    document.getElementById('addRelatedToName').textContent = currentEditingPerson;
    document.getElementById('addRelatedType').textContent = relationType;
    
    // Reset form fields
    document.getElementById('addRelatedId').value = '';
    document.getElementById('addRelatedSex').value = relationType === 'Parent' ? 'M' : 'F';
    document.getElementById('addRelatedNotes').value = '';
    document.getElementById('addRelatedDead').checked = false;
    document.getElementById('addRelatedGeneticTesting').checked = false;
    document.getElementById('addRelatedInfertile').checked = false;
    document.getElementById('addRelatedNoChildrenByChoice').checked = false;
    document.getElementById('addRelatedWasAdopted').checked = false;
    document.getElementById('addRelatedCondition').value = 'None';
    document.getElementById('addRelatedSiblingOrder').value = '0';
    
    // Update status summary
    updateStatusSummary('addRelated');
    
    // Open the modal
    document.getElementById('addRelatedModal').classList.add('active');
}

function closeAddRelatedModal() {
    document.getElementById('addRelatedModal').classList.remove('active');
    // Close any open status dropdown
    document.querySelectorAll('.status-dropdown-panel').forEach(p => p.classList.remove('open'));
    currentAddRelationType = null;
    currentAddRelatedToPerson = null;
}

function saveAddRelated() {
    const newId = document.getElementById('addRelatedId').value.trim();
    
    if (!newId) {
        alert('Please enter an ID/Name for the new person');
        return;
    }
    
    const sex = document.getElementById('addRelatedSex').value;
    const notes = document.getElementById('addRelatedNotes').value.trim() || '';
    const dead = document.getElementById('addRelatedDead').checked ? '1' : '0';
    const geneticTesting = document.getElementById('addRelatedGeneticTesting').checked ? '1' : '0';
    const infertile = document.getElementById('addRelatedInfertile').checked ? '1' : '0';
    const noChildrenByChoice = document.getElementById('addRelatedNoChildrenByChoice').checked ? '1' : '0';
    const wasAdopted = document.getElementById('addRelatedWasAdopted').checked ? '1' : '0';
    const condition = document.getElementById('addRelatedCondition').value.trim() || 'None';
    const siblingOrder = document.getElementById('addRelatedSiblingOrder').value || '0';
    
    let roleStr = '';
    switch(currentAddRelationType) {
        case 'Parent':
            roleStr = `Parent("${currentAddRelatedToPerson}")`;
            break;
        case 'Child':
            roleStr = `Child("${currentAddRelatedToPerson}")`;
            break;
        case 'Sibling':
            roleStr = `Sibling("${currentAddRelatedToPerson}")`;
            break;
        case 'Partner':
            roleStr = `Partner("${currentAddRelatedToPerson}")`;
            break;
    }
    
    addTableRow([roleStr, newId, sex, notes, dead, condition, geneticTesting, siblingOrder,
                 infertile, noChildrenByChoice, wasAdopted]);
    closeAddRelatedModal();
    closeEditModal();
    updateGraph();
}

// ===== Setup Form =====
function openSetupWizard() {
    // Reset all inputs to empty
    document.querySelectorAll('#setupWizardModal input[type="number"]').forEach(input => input.value = '');
    document.querySelector('input[name="detailLevel"][value="parents"]').checked = true;
    document.querySelector('input[name="patientSex"][value="M"]').checked = true;
    document.getElementById('setupWizardModal').classList.add('active');
}

function closeSetupWizard() {
    document.getElementById('setupWizardModal').classList.remove('active');
}

function wizardBuild() {
    const detailLevel = document.querySelector('input[name="detailLevel"]:checked').value;
    const patientSex = document.querySelector('input[name="patientSex"]:checked').value;
    
    const patientBrothers = parseInt(document.getElementById('wizPatientBrothers').value) || 0;
    const patientSisters = parseInt(document.getElementById('wizPatientSisters').value) || 0;
    const patientUnknown = parseInt(document.getElementById('wizPatientUnknown').value) || 0;
    
    const patientChildrenMale = parseInt(document.getElementById('wizPatientChildrenMale').value) || 0;
    const patientChildrenFemale = parseInt(document.getElementById('wizPatientChildrenFemale').value) || 0;
    const patientChildrenUnknown = parseInt(document.getElementById('wizPatientChildrenUnknown').value) || 0;
    
    const fatherBrothers = parseInt(document.getElementById('wizFatherBrothers').value) || 0;
    const fatherSisters = parseInt(document.getElementById('wizFatherSisters').value) || 0;
    const fatherUnknown = parseInt(document.getElementById('wizFatherUnknown').value) || 0;
    
    const motherBrothers = parseInt(document.getElementById('wizMotherBrothers').value) || 0;
    const motherSisters = parseInt(document.getElementById('wizMotherSisters').value) || 0;
    const motherUnknown = parseInt(document.getElementById('wizMotherUnknown').value) || 0;
    
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';
    
    // Always add Patient and Parents (addTableRow auto-pads to 11 columns)
    addTableRow(['Patient', 'Patient', patientSex, 'Proband', '0', 'None', '0', '0']);
    addTableRow(['Parent("Patient")', 'Father', 'M', 'Father', '0', 'None', '0', '0']);
    addTableRow(['Parent("Patient")', 'Mother', 'F', 'Mother', '0', 'None', '0', '0']);
    
    // Patient's siblings
    let sibOrder = 2;
    for (let i = 1; i <= patientBrothers; i++) {
        const id = 'Brother' + i;
        addTableRow(['Sibling("Patient")', id, 'M', 'Brother ' + i, '0', 'None', '0', String(sibOrder++)]);
    }
    for (let i = 1; i <= patientSisters; i++) {
        const id = 'Sister' + i;
        addTableRow(['Sibling("Patient")', id, 'F', 'Sister ' + i, '0', 'None', '0', String(sibOrder++)]);
    }
    for (let i = 1; i <= patientUnknown; i++) {
        const id = 'Sibling' + i;
        addTableRow(['Sibling("Patient")', id, 'Unknown', 'Sibling ' + i, '0', 'None', '0', String(sibOrder++)]);
    }
    
    // Father's siblings
    let fSibOrder = 2;
    for (let i = 1; i <= fatherBrothers; i++) {
        const id = 'Paternal Uncle' + i;
        addTableRow(['Sibling("Father")', id, 'M', 'Paternal Uncle ' + i, '0', 'None', '0', String(fSibOrder++)]);
    }
    for (let i = 1; i <= fatherSisters; i++) {
        const id = 'Paternal Aunt' + i;
        addTableRow(['Sibling("Father")', id, 'F', 'Paternal Aunt ' + i, '0', 'None', '0', String(fSibOrder++)]);
    }
    for (let i = 1; i <= fatherUnknown; i++) {
        const id = 'Paternal Sibling' + i;
        addTableRow(['Sibling("Father")', id, 'Unknown', 'Paternal Sibling ' + i, '0', 'None', '0', String(fSibOrder++)]);
    }
    
    // Mother's siblings
    let mSibOrder = 2;
    for (let i = 1; i <= motherBrothers; i++) {
        const id = 'Maternal Uncle' + i;
        addTableRow(['Sibling("Mother")', id, 'M', 'Maternal Uncle ' + i, '0', 'None', '0', String(mSibOrder++)]);
    }
    for (let i = 1; i <= motherSisters; i++) {
        const id = 'Maternal Aunt' + i;
        addTableRow(['Sibling("Mother")', id, 'F', 'Maternal Aunt ' + i, '0', 'None', '0', String(mSibOrder++)]);
    }
    for (let i = 1; i <= motherUnknown; i++) {
        const id = 'Maternal Sibling' + i;
        addTableRow(['Sibling("Mother")', id, 'Unknown', 'Maternal Sibling ' + i, '0', 'None', '0', String(mSibOrder++)]);
    }
    
    // Patient's children
    let childOrder = 1;
    for (let i = 1; i <= patientChildrenMale; i++) {
        const id = 'Son' + i;
        addTableRow(['Child("Patient")', id, 'M', 'Son ' + i, '0', 'None', '0', String(childOrder++)]);
    }
    for (let i = 1; i <= patientChildrenFemale; i++) {
        const id = 'Daughter' + i;
        addTableRow(['Child("Patient")', id, 'F', 'Daughter ' + i, '0', 'None', '0', String(childOrder++)]);
    }
    for (let i = 1; i <= patientChildrenUnknown; i++) {
        const id = 'Child' + i;
        addTableRow(['Child("Patient")', id, 'Unknown', 'Child ' + i, '0', 'None', '0', String(childOrder++)]);
    }
    
    // Grandparents (if detail level includes them)
    if (detailLevel === 'grandparents' || detailLevel === 'greatgrandparents') {
        addTableRow(['Parent("Father")', 'GF_P', 'M', 'Paternal Grandfather', '0', 'None', '0', '0']);
        addTableRow(['Parent("Father")', 'GM_P', 'F', 'Paternal Grandmother', '0', 'None', '0', '0']);
        addTableRow(['Parent("Mother")', 'GF_M', 'M', 'Maternal Grandfather', '0', 'None', '0', '0']);
        addTableRow(['Parent("Mother")', 'GM_M', 'F', 'Maternal Grandmother', '0', 'None', '0', '0']);
    }
    
    // Great-grandparents
    if (detailLevel === 'greatgrandparents') {
        addTableRow(['Parent("GF_P")', 'GGF_PP', 'M', 'Great-Grandfather (PP)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GF_P")', 'GGM_PP', 'F', 'Great-Grandmother (PP)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GM_P")', 'GGF_PM', 'M', 'Great-Grandfather (PM)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GM_P")', 'GGM_PM', 'F', 'Great-Grandmother (PM)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GF_M")', 'GGF_MP', 'M', 'Great-Grandfather (MP)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GF_M")', 'GGM_MP', 'F', 'Great-Grandmother (MP)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GM_M")', 'GGF_MM', 'M', 'Great-Grandfather (MM)', '0', 'None', '0', '0']);
        addTableRow(['Parent("GM_M")', 'GGM_MM', 'F', 'Great-Grandmother (MM)', '0', 'None', '0', '0']);
    }
    
    closeSetupWizard();
    updateGraph();
}
