// ===== PED Import/Export =====

function importPED(text) {
    const lines = text.trim().split('\n');
    const individuals = {};
    
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        const parts = line.split(/\s+/);
        if (parts.length < 6) continue;
        
        const familyId = parts[0];
        const id = parts[1];
        const fatherId = parts[2] === '0' ? null : parts[2];
        const motherId = parts[3] === '0' ? null : parts[3];
        const sexCode = parts[4];
        const phenotypeCode = parts[5];
        
        let sex = 'Unknown';
        if (sexCode === '1') sex = 'M';
        else if (sexCode === '2') sex = 'F';
        
        let condition = 'None';
        if (phenotypeCode === '2') condition = 'Affected';
        
        individuals[id] = {
            id: id,
            sex: sex,
            notes: `Family: ${familyId}`,
            dead: false,
            condition: condition,
            geneticTesting: false,
            siblingOrder: 0,
            infertile: false,
            noChildrenByChoice: false,
            wasAdopted: false,
            roleStr: 'Patient', // Default role
            _fatherId: fatherId,
            _motherId: motherId
        };
    }
    
    // Basic role assignment based on parent links
    for (const id in individuals) {
        const ind = individuals[id];
        if (ind._fatherId && individuals[ind._fatherId]) {
            individuals[ind._fatherId].roleStr = 'Father';
        }
        if (ind._motherId && individuals[ind._motherId]) {
            individuals[ind._motherId].roleStr = 'Mother';
        }
    }
    
    // Cleanup
    for (const id in individuals) {
        delete individuals[id]._fatherId;
        delete individuals[id]._motherId;
    }
    
    return individuals;
}

function exportPED(individuals) {
    let ped = "";
    
    // We need to reconstruct parent links from roles.
    // This is highly non-trivial without a proper graph structure.
    // For this basic implementation, we'll just export individuals with 0 for parents.
    
    Object.values(individuals).forEach(ind => {
        const familyId = "FAM1"; // Default family ID
        const id = ind.id;
        const fatherId = "0";
        const motherId = "0";
        
        let sexCode = "0";
        if (ind.sex === 'M') sexCode = "1";
        else if (ind.sex === 'F') sexCode = "2";
        
        let phenotypeCode = "1"; // Unaffected
        if (ind.condition !== 'None') phenotypeCode = "2"; // Affected
        
        ped += `${familyId} ${id} ${fatherId} ${motherId} ${sexCode} ${phenotypeCode}\n`;
    });
    
    return ped;
}
