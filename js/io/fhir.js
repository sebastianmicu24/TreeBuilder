// ===== HL7 FHIR Import/Export =====

function importFHIR(text) {
    try {
        const bundle = JSON.parse(text);
        const individuals = {};
        
        if (bundle.resourceType === 'Bundle' && bundle.entry) {
            bundle.entry.forEach(entry => {
                if (entry.resource && entry.resource.resourceType === 'Patient') {
                    const patient = entry.resource;
                    const id = patient.id;
                    
                    let sex = 'Unknown';
                    if (patient.gender === 'male') sex = 'M';
                    else if (patient.gender === 'female') sex = 'F';
                    
                    let dead = false;
                    if (patient.deceasedBoolean || patient.deceasedDateTime) dead = true;
                    
                    let notes = '';
                    if (patient.text && patient.text.div) {
                        notes = patient.text.div.replace(/<[^>]*>?/gm, ''); // Strip HTML
                    }
                    
                    individuals[id] = {
                        id: id,
                        sex: sex,
                        notes: notes,
                        dead: dead,
                        condition: 'None', // Would need to parse Condition resources linked to this Patient
                        geneticTesting: false,
                        siblingOrder: 0,
                        infertile: false,
                        noChildrenByChoice: false,
                        wasAdopted: false,
                        roleStr: 'Patient' // Default role
                    };
                }
            });
        }
        
        return individuals;
    } catch (e) {
        console.error("Failed to parse FHIR JSON", e);
        return null;
    }
}

function exportFHIR(individuals) {
    const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: []
    };
    
    Object.values(individuals).forEach(ind => {
        const patient = {
            resourceType: "Patient",
            id: ind.id,
            gender: ind.sex === 'M' ? 'male' : (ind.sex === 'F' ? 'female' : 'unknown'),
            deceasedBoolean: ind.dead
        };
        
        if (ind.notes || ind.condition !== 'None') {
            let text = ind.notes || '';
            if (ind.condition !== 'None') {
                text += (text ? ' | ' : '') + `Condition: ${Array.isArray(ind.condition) ? ind.condition.join(',') : ind.condition}`;
            }
            patient.text = {
                status: "generated",
                div: `<div xmlns="http://www.w3.org/1999/xhtml">${text}</div>`
            };
        }
        
        bundle.entry.push({
            fullUrl: `urn:uuid:${ind.id}`,
            resource: patient
        });
    });
    
    return JSON.stringify(bundle, null, 2);
}
