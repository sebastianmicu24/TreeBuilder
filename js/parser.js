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
        if (row.length < 6) continue;

        const [roleStr, id, sex, notes, dead, condition] = row;
        
        individuals[id] = {
            id: id,
            sex: sex,
            notes: notes,
            dead: dead === '1',
            condition: condition || "None",
            roleStr: roleStr // Store for second pass
        };
    }

    return individuals;
}