// ===== Setup Wizard =====

function openSetupWizard() {
    document.querySelectorAll('#setupWizardModal input[type="number"]').forEach(input => input.value = '');
    document.querySelector('input[name="detailLevel"][value="grandparents"]').checked = true;
    document.querySelector('input[name="patientSex"][value="M"]').checked = true;
    document.getElementById('setupWizardModal').classList.add('active');
}

function closeSetupWizard() {
    document.getElementById('setupWizardModal').classList.remove('active');
}

function wizardBuild() {
    const detailLevel = document.querySelector('input[name="detailLevel"]:checked').value;
    const patientSex  = document.querySelector('input[name="patientSex"]:checked').value;

    const patientBrothers       = parseInt(document.getElementById('wizPatientBrothers').value) || 0;
    const patientSisters        = parseInt(document.getElementById('wizPatientSisters').value) || 0;
    const patientUnknown        = parseInt(document.getElementById('wizPatientUnknown').value) || 0;

    const patientChildrenMale    = parseInt(document.getElementById('wizPatientChildrenMale').value) || 0;
    const patientChildrenFemale  = parseInt(document.getElementById('wizPatientChildrenFemale').value) || 0;
    const patientChildrenUnknown = parseInt(document.getElementById('wizPatientChildrenUnknown').value) || 0;

    const fatherBrothers = parseInt(document.getElementById('wizFatherBrothers').value) || 0;
    const fatherSisters  = parseInt(document.getElementById('wizFatherSisters').value) || 0;
    const fatherUnknown  = parseInt(document.getElementById('wizFatherUnknown').value) || 0;

    const motherBrothers = parseInt(document.getElementById('wizMotherBrothers').value) || 0;
    const motherSisters  = parseInt(document.getElementById('wizMotherSisters').value) || 0;
    const motherUnknown  = parseInt(document.getElementById('wizMotherUnknown').value) || 0;

    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    // Patient and parents (addTableRow auto-pads to 11 columns)
    addTableRow(['Patient',            'Patient', patientSex, 'Proband', '0', 'None', '0', '0']);
    addTableRow(['Parent("Patient")',  'Father',  'M',        'Father',  '0', 'None', '0', '0']);
    addTableRow(['Parent("Patient")',  'Mother',  'F',        'Mother',  '0', 'None', '0', '0']);

    // Patient's siblings
    let sibOrder = 2;
    for (let i = 1; i <= patientBrothers; i++) {
        addTableRow(['Sibling("Patient")', 'Brother' + i,  'M',       'Brother ' + i,  '0', 'None', '0', String(sibOrder++)]);
    }
    for (let i = 1; i <= patientSisters; i++) {
        addTableRow(['Sibling("Patient")', 'Sister' + i,   'F',       'Sister ' + i,   '0', 'None', '0', String(sibOrder++)]);
    }
    for (let i = 1; i <= patientUnknown; i++) {
        addTableRow(['Sibling("Patient")', 'Sibling' + i,  'Unknown', 'Sibling ' + i,  '0', 'None', '0', String(sibOrder++)]);
    }

    // Father's siblings
    let fSibOrder = 2;
    for (let i = 1; i <= fatherBrothers; i++) {
        addTableRow(['Sibling("Father")', 'Paternal Uncle' + i,   'M',       'Paternal Uncle ' + i,   '0', 'None', '0', String(fSibOrder++)]);
    }
    for (let i = 1; i <= fatherSisters; i++) {
        addTableRow(['Sibling("Father")', 'Paternal Aunt' + i,    'F',       'Paternal Aunt ' + i,    '0', 'None', '0', String(fSibOrder++)]);
    }
    for (let i = 1; i <= fatherUnknown; i++) {
        addTableRow(['Sibling("Father")', 'Paternal Sibling' + i, 'Unknown', 'Paternal Sibling ' + i, '0', 'None', '0', String(fSibOrder++)]);
    }

    // Mother's siblings
    let mSibOrder = 2;
    for (let i = 1; i <= motherBrothers; i++) {
        addTableRow(['Sibling("Mother")', 'Maternal Uncle' + i,   'M',       'Maternal Uncle ' + i,   '0', 'None', '0', String(mSibOrder++)]);
    }
    for (let i = 1; i <= motherSisters; i++) {
        addTableRow(['Sibling("Mother")', 'Maternal Aunt' + i,    'F',       'Maternal Aunt ' + i,    '0', 'None', '0', String(mSibOrder++)]);
    }
    for (let i = 1; i <= motherUnknown; i++) {
        addTableRow(['Sibling("Mother")', 'Maternal Sibling' + i, 'Unknown', 'Maternal Sibling ' + i, '0', 'None', '0', String(mSibOrder++)]);
    }

    // Patient's children
    let childOrder = 1;
    for (let i = 1; i <= patientChildrenMale; i++) {
        addTableRow(['Child("Patient")', 'Son' + i,      'M',       'Son ' + i,   '0', 'None', '0', String(childOrder++)]);
    }
    for (let i = 1; i <= patientChildrenFemale; i++) {
        addTableRow(['Child("Patient")', 'Daughter' + i, 'F',       'Daughter ' + i, '0', 'None', '0', String(childOrder++)]);
    }
    for (let i = 1; i <= patientChildrenUnknown; i++) {
        addTableRow(['Child("Patient")', 'Child' + i,    'Unknown', 'Child ' + i, '0', 'None', '0', String(childOrder++)]);
    }

    // Grandparents
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
