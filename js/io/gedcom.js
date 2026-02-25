// ===== GEDCOM Import/Export =====

function importGEDCOM(text) {
    const lines = text.split(/\r?\n/);
    const individuals = {};
    const families = {};
    
    let currentRecord = null;
    let currentType = null;
    
    // Basic GEDCOM parsing
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        const parts = line.split(' ');
        const level = parseInt(parts[0]);
        const tag = parts[1].startsWith('@') ? parts[2] : parts[1];
        const id = parts[1].startsWith('@') ? parts[1].replace(/@/g, '') : null;
        const value = parts.slice(parts[1].startsWith('@') ? 3 : 2).join(' ');
        
        if (level === 0) {
            if (tag === 'INDI') {
                currentType = 'INDI';
                currentRecord = {
                    id: id,
                    sex: 'Unknown',
                    notes: '',
                    dead: false,
                    condition: 'None',
                    geneticTesting: false,
                    siblingOrder: 0,
                    infertile: false,
                    noChildrenByChoice: false,
                    wasAdopted: false,
                    roleStr: '',
                    _fams: [],
                    _famc: null
                };
                individuals[id] = currentRecord;
            } else if (tag === 'FAM') {
                currentType = 'FAM';
                currentRecord = {
                    id: id,
                    husb: null,
                    wife: null,
                    chil: []
                };
                families[id] = currentRecord;
            } else {
                currentType = null;
            }
        } else if (currentType === 'INDI') {
            if (tag === 'SEX') {
                currentRecord.sex = value === 'M' ? 'M' : (value === 'F' ? 'F' : 'Unknown');
            } else if (tag === 'NOTE') {
                currentRecord.notes += (currentRecord.notes ? ' ' : '') + value;
            } else if (tag === 'DEAT') {
                currentRecord.dead = true;
            } else if (tag === 'FAMS') {
                currentRecord._fams.push(value.replace(/@/g, ''));
            } else if (tag === 'FAMC') {
                currentRecord._famc = value.replace(/@/g, '');
            }
        } else if (currentType === 'FAM') {
            if (tag === 'HUSB') {
                currentRecord.husb = value.replace(/@/g, '');
            } else if (tag === 'WIFE') {
                currentRecord.wife = value.replace(/@/g, '');
            } else if (tag === 'CHIL') {
                currentRecord.chil.push(value.replace(/@/g, ''));
            }
        }
    }
    
    // Reconstruct roles based on families
    // This is a simplified reconstruction. A full genogram reconstruction from GEDCOM is complex.
    // We'll try to find a root person (e.g., someone with no parents but has children)
    
    let rootId = null;
    for (const id in individuals) {
        if (!individuals[id]._famc && individuals[id]._fams.length > 0) {
            rootId = id;
            break;
        }
    }
    
    if (!rootId && Object.keys(individuals).length > 0) {
        rootId = Object.keys(individuals)[0];
    }
    
    if (rootId) {
        individuals[rootId].roleStr = 'Patient';
        
        // Very basic role assignment (just to have something)
        // In a real app, you'd need a robust graph traversal to assign roles relative to the Patient
        for (const famId in families) {
            const fam = families[famId];
            if (fam.husb && individuals[fam.husb]) {
                if (!individuals[fam.husb].roleStr) individuals[fam.husb].roleStr = 'Father';
            }
            if (fam.wife && individuals[fam.wife]) {
                if (!individuals[fam.wife].roleStr) individuals[fam.wife].roleStr = 'Mother';
            }
            fam.chil.forEach((childId, index) => {
                if (individuals[childId]) {
                    if (!individuals[childId].roleStr) individuals[childId].roleStr = 'Child';
                    individuals[childId].siblingOrder = index + 1;
                }
            });
        }
    }
    
    // Cleanup temporary fields
    for (const id in individuals) {
        delete individuals[id]._fams;
        delete individuals[id]._famc;
    }
    
    return individuals;
}

function exportGEDCOM(individuals) {
    let gedcom = "0 HEAD\n1 SOUR ClinicalGenogram\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n";
    
    // We need to reconstruct families from roles.
    // This is highly non-trivial without a proper graph structure.
    // For this basic implementation, we'll just export individuals.
    
    Object.values(individuals).forEach(ind => {
        gedcom += `0 @${ind.id}@ INDI\n`;
        if (ind.sex === 'M' || ind.sex === 'F') {
            gedcom += `1 SEX ${ind.sex}\n`;
        } else {
            gedcom += `1 SEX U\n`;
        }
        if (ind.dead) {
            gedcom += `1 DEAT Y\n`;
        }
        if (ind.notes || ind.condition !== 'None') {
            let note = ind.notes || '';
            if (ind.condition !== 'None') {
                note += (note ? ' | ' : '') + `Condition: ${Array.isArray(ind.condition) ? ind.condition.join(',') : ind.condition}`;
            }
            gedcom += `1 NOTE ${note}\n`;
        }
    });
    
    gedcom += "0 TRLR\n";
    return gedcom;
}
