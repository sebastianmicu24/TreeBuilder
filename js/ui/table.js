// ===== Table Management =====

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

    paddedData.forEach((text) => {
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
    deleteBtn.onclick = function() { tr.remove(); };
    actionTd.appendChild(deleteBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
}

function getTableData() {
    const individuals = {};
    const rows = document.querySelectorAll('#dataTable tbody tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 8) return;

        const roleStr             = cells[0].textContent.trim();
        const id                  = cells[1].textContent.trim();
        const sex                 = cells[2].textContent.trim();
        const notes               = cells[3].textContent.trim();
        const dead                = cells[4].textContent.trim();
        const condition           = cells[5].textContent.trim();
        const geneticTesting      = cells[6].textContent.trim();
        const siblingOrder        = cells[7].textContent.trim();
        const infertile           = cells[8]?.textContent.trim() || '0';
        const noChildrenByChoice  = cells[9]?.textContent.trim() || '0';
        const wasAdopted          = cells[10]?.textContent.trim() || '0';

        if (!id) return; // Skip empty rows

        // Parse conditions: split by comma if multiple conditions present
        let parsedCondition;
        if (condition && condition !== 'None' && condition !== '') {
            const conditionList = condition.split(',').map(c => c.trim()).filter(c => c !== '' && c !== 'None');
            parsedCondition = conditionList.length > 1 ? conditionList : (conditionList[0] || 'None');
        } else {
            parsedCondition = 'None';
        }

        individuals[id] = {
            id,
            sex,
            notes,
            dead: dead === '1',
            condition: parsedCondition,
            geneticTesting: geneticTesting === '1',
            siblingOrder: siblingOrder ? parseInt(siblingOrder) || 0 : 0,
            infertile: infertile === '1',
            noChildrenByChoice: noChildrenByChoice === '1',
            wasAdopted: wasAdopted === '1',
            roleStr
        };
    });

    return individuals;
}
