// ===== CSV Import/Export =====

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ';' && !inQuote) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    
    return result.map(field => {
        if (field.startsWith('"') && field.endsWith('"')) {
            return field.substring(1, field.length - 1);
        }
        return field;
    });
}

function importCSV(text) {
    const lines = text.trim().split('\n');
    const individuals = {};
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const row = parseCSVLine(lines[i]);
        if (row.length < 7) continue;

        const [roleStr, id, sex, notes, dead, condition, geneticTesting, siblingOrder,
               infertile, noChildrenByChoice, wasAdopted] = row;
        
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
    }

    return individuals;
}

function exportCSV(individuals) {
    let csvContent = 'Role;Id;Sex;Notes;Dead;Condition;GeneticTesting;SiblingOrder;Infertile;NoChildrenByChoice;WasAdopted\n';

    Object.values(individuals).forEach(ind => {
        const roleStr            = ind.roleStr || '';
        const id                 = ind.id || '';
        const sex                = ind.sex || '';
        const notes              = ind.notes || '';
        const dead               = ind.dead ? '1' : '0';
        const condition          = Array.isArray(ind.condition) ? ind.condition.join(',') : (ind.condition || 'None');
        const geneticTesting     = ind.geneticTesting ? '1' : '0';
        const siblingOrder       = ind.siblingOrder || '0';
        const infertile          = ind.infertile ? '1' : '0';
        const noChildrenByChoice = ind.noChildrenByChoice ? '1' : '0';
        const wasAdopted         = ind.wasAdopted ? '1' : '0';

        if (!id) return;

        const quotedRole      = roleStr.includes(';')    ? `"${roleStr}"`    : roleStr;
        const quotedId        = `"${id}"`;
        const quotedNotes     = `"${notes}"`;
        const quotedCondition = condition.includes(';')  ? `"${condition}"`  : condition;

        csvContent += `${quotedRole};${quotedId};${sex};${quotedNotes};${dead};${quotedCondition};${geneticTesting};${siblingOrder};${infertile};${noChildrenByChoice};${wasAdopted}\n`;
    });

    return csvContent;
}
