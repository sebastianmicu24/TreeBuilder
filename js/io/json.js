// ===== JSON Import/Export =====

function importJSON(text) {
    try {
        const data = JSON.parse(text);
        const individuals = {};
        
        if (Array.isArray(data)) {
            data.forEach(ind => {
                if (ind.id) {
                    individuals[ind.id] = {
                        id: ind.id,
                        sex: ind.sex || 'Unknown',
                        notes: ind.notes || '',
                        dead: !!ind.dead,
                        condition: ind.condition || 'None',
                        geneticTesting: !!ind.geneticTesting,
                        siblingOrder: ind.siblingOrder || 0,
                        infertile: !!ind.infertile,
                        noChildrenByChoice: !!ind.noChildrenByChoice,
                        wasAdopted: !!ind.wasAdopted,
                        roleStr: ind.roleStr || ''
                    };
                }
            });
        } else if (typeof data === 'object') {
            Object.values(data).forEach(ind => {
                if (ind.id) {
                    individuals[ind.id] = {
                        id: ind.id,
                        sex: ind.sex || 'Unknown',
                        notes: ind.notes || '',
                        dead: !!ind.dead,
                        condition: ind.condition || 'None',
                        geneticTesting: !!ind.geneticTesting,
                        siblingOrder: ind.siblingOrder || 0,
                        infertile: !!ind.infertile,
                        noChildrenByChoice: !!ind.noChildrenByChoice,
                        wasAdopted: !!ind.wasAdopted,
                        roleStr: ind.roleStr || ''
                    };
                }
            });
        }
        
        return individuals;
    } catch (e) {
        console.error("Failed to parse JSON", e);
        return null;
    }
}

function exportJSON(individuals) {
    return JSON.stringify(Object.values(individuals), null, 2);
}
