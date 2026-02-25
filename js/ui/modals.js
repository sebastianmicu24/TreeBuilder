// ===== Data Editor Modal =====

function openDataEditorModal() {
    document.getElementById('dataEditorModal').classList.add('active');
}

function closeDataEditorModal() {
    document.getElementById('dataEditorModal').classList.remove('active');
}

function saveDataEditor() {
    closeDataEditorModal();
    updateGraph();
}

// ===== Edit Modal =====

var currentEditingPerson = null;

function openEditModal(personId) {
    const rows = document.querySelectorAll('#dataTable tbody tr');
    let personData = null;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const id = cells[1]?.textContent.trim();
        if (id === personId) {
            personData = {
                role:               cells[0].textContent.trim(),
                id,
                sex:                cells[2].textContent.trim(),
                notes:              cells[3].textContent.trim(),
                dead:               cells[4].textContent.trim() === '1',
                condition:          cells[5].textContent.trim(),
                geneticTesting:     cells[6].textContent.trim() === '1',
                siblingOrder:       cells[7]?.textContent.trim() || '0',
                infertile:          cells[8]?.textContent.trim() === '1',
                noChildrenByChoice: cells[9]?.textContent.trim() === '1',
                wasAdopted:         cells[10]?.textContent.trim() === '1'
            };
        }
    });

    if (!personData) return;

    currentEditingPerson = personId;
    document.getElementById('editId').value                          = personData.id;
    document.getElementById('editSex').value                         = personData.sex;
    document.getElementById('editNotes').value                       = personData.notes;
    document.getElementById('editDead').checked                      = personData.dead;
    document.getElementById('editGeneticTesting').checked            = personData.geneticTesting;
    document.getElementById('editInfertile').checked                 = personData.infertile;
    document.getElementById('editNoChildrenByChoice').checked        = personData.noChildrenByChoice;
    document.getElementById('editWasAdopted').checked                = personData.wasAdopted;
    document.getElementById('editCondition').value                   = personData.condition;
    document.getElementById('editSiblingOrder').value                = personData.siblingOrder;

    updateStatusSummary('edit');
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
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
            if (cells[1]?.textContent.trim() === newId) idExists = true;
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
            if (cells[8])  cells[8].textContent  = document.getElementById('editInfertile').checked ? '1' : '0';
            if (cells[9])  cells[9].textContent  = document.getElementById('editNoChildrenByChoice').checked ? '1' : '0';
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

// ===== Add Related Modal =====

var currentAddRelationType = null;
var currentAddRelatedToPerson = null;

function addRelated(relationType) {
    if (!currentEditingPerson) return;

    currentAddRelationType = relationType;
    currentAddRelatedToPerson = currentEditingPerson;

    document.getElementById('addRelatedToName').textContent = currentEditingPerson;
    document.getElementById('addRelatedType').textContent   = relationType;

    // Reset form fields
    document.getElementById('addRelatedId').value                         = '';
    document.getElementById('addRelatedSex').value                        = relationType === 'Parent' ? 'M' : 'F';
    document.getElementById('addRelatedNotes').value                      = '';
    document.getElementById('addRelatedDead').checked                     = false;
    document.getElementById('addRelatedGeneticTesting').checked           = false;
    document.getElementById('addRelatedInfertile').checked                = false;
    document.getElementById('addRelatedNoChildrenByChoice').checked       = false;
    document.getElementById('addRelatedWasAdopted').checked               = false;
    document.getElementById('addRelatedCondition').value                  = 'None';
    document.getElementById('addRelatedSiblingOrder').value               = '0';

    updateStatusSummary('addRelated');
    document.getElementById('addRelatedModal').classList.add('active');
}

function closeAddRelatedModal() {
    document.getElementById('addRelatedModal').classList.remove('active');
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

    const sex              = document.getElementById('addRelatedSex').value;
    const notes            = document.getElementById('addRelatedNotes').value.trim() || '';
    const dead             = document.getElementById('addRelatedDead').checked ? '1' : '0';
    const geneticTesting   = document.getElementById('addRelatedGeneticTesting').checked ? '1' : '0';
    const infertile        = document.getElementById('addRelatedInfertile').checked ? '1' : '0';
    const noChildrenByChoice = document.getElementById('addRelatedNoChildrenByChoice').checked ? '1' : '0';
    const wasAdopted       = document.getElementById('addRelatedWasAdopted').checked ? '1' : '0';
    const condition        = document.getElementById('addRelatedCondition').value.trim() || 'None';
    const siblingOrder     = document.getElementById('addRelatedSiblingOrder').value || '0';

    let roleStr = '';
    switch (currentAddRelationType) {
        case 'Parent':  roleStr = `Parent("${currentAddRelatedToPerson}")`;  break;
        case 'Child':   roleStr = `Child("${currentAddRelatedToPerson}")`;   break;
        case 'Sibling': roleStr = `Sibling("${currentAddRelatedToPerson}")`; break;
        case 'Partner': roleStr = `Partner("${currentAddRelatedToPerson}")`; break;
    }

    addTableRow([roleStr, newId, sex, notes, dead, condition, geneticTesting, siblingOrder,
                 infertile, noChildrenByChoice, wasAdopted]);
    closeAddRelatedModal();
    closeEditModal();
    updateGraph();
}
