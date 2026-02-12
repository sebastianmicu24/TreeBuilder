function parseCSVLine(line) {
    // Simple CSV parser that handles quoted fields containing delimiters
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
    
    // Remove surrounding quotes from fields
    return result.map(field => {
        if (field.startsWith('"') && field.endsWith('"')) {
            return field.substring(1, field.length - 1);
        }
        return field;
    });
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    // Skip header
    const individuals = {};
    
    // First pass: Create individuals map
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const row = parseCSVLine(lines[i]);
        if (row.length < 7) continue;

        const [roleStr, id, sex, notes, dead, condition, geneticTesting, siblingOrder] = row;
        
        // Parse conditions: split by comma if multiple conditions present
        let parsedCondition;
        if (condition && condition !== "None" && condition !== "") {
            // Check if comma-separated
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
            condition: parsedCondition, // Can be string or array of strings
            geneticTesting: geneticTesting === '1',
            siblingOrder: siblingOrder ? parseInt(siblingOrder) || 0 : 0,
            roleStr: roleStr // Store for second pass
        };
    }

    return individuals;
}