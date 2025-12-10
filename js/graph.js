function buildGraphData(individuals) {
    const families = []; // List of { father: id, mother: id, children: [id], childrenBirthOrder: [] }
    
    // Helper to find or create a family for a couple
    const getFamily = (p1, p2) => {
        // Try to find exact match first
        let family = families.find(f => 
            (f.father === p1 && f.mother === p2) || 
            (f.father === p2 && f.mother === p1)
        );

        // Determine father and mother based on sex
        let father = null;
        let mother = null;
        
        const ind1 = individuals[p1];
        const ind2 = individuals[p2];
        
        if (ind1 && ind1.sex === 'M') father = p1;
        else if (ind1 && ind1.sex === 'F') mother = p1;
        
        if (ind2 && ind2.sex === 'M') father = p2;
        else if (ind2 && ind2.sex === 'F') mother = p2;
        
        // Fallback
        if (!father && !mother) { father = p1; mother = p2; }
        else if (!father) father = (mother === p1 ? p2 : p1);
        else if (!mother) mother = (father === p1 ? p2 : p1);

        if (!family) {
            // Check for partial families to merge
            // If we have a partial family for the father (with no mother), use it
            if (father) {
                const partial = families.find(f => f.father === father && !f.mother);
                if (partial) {
                    partial.mother = mother;
                    partial.id = `fam_${father}_${mother}`; // Update ID
                    return partial;
                }
            }
            // If we have a partial family for the mother (with no father), use it
            if (mother) {
                const partial = families.find(f => f.mother === mother && !f.father);
                if (partial) {
                    partial.father = father;
                    partial.id = `fam_${father}_${mother}`; // Update ID
                    if (!partial.swapped) partial.swapped = false;
                    return partial;
                }
            }

            // Create new if no partial found
            family = { id: `fam_${father}_${mother}`, father, mother, children: [], childrenBirthOrder: [], swapped: false };
            families.push(family);
        }
        return family;
    };

    // Helper to add child to parent's family
    const addChildToParent = (childId, parentId) => {
        // First, check if the child is already in a family
        // If so, check if that family is missing the parent slot we can fill
        const parent = individuals[parentId];
        const isFather = parent && parent.sex === 'M';
        
        let existingFamily = families.find(f => f.children.includes(childId));
        
        if (existingFamily) {
            if (isFather && !existingFamily.father) {
                existingFamily.father = parentId;
                existingFamily.id = `fam_${parentId}_${existingFamily.mother || 'unknown'}`;
                if (!existingFamily.swapped) existingFamily.swapped = false;
                return;
            }
            if (!isFather && !existingFamily.mother) {
                existingFamily.mother = parentId;
                existingFamily.id = `fam_${existingFamily.father || 'unknown'}_${parentId}`;
                if (!existingFamily.swapped) existingFamily.swapped = false;
                return;
            }
            // If family already has this parent, do nothing
            if ((isFather && existingFamily.father === parentId) || (!isFather && existingFamily.mother === parentId)) {
                return;
            }
        }

        // Find a family where parentId is a parent
        let family = families.find(f => f.father === parentId || f.mother === parentId);
        if (!family) {
            // Create a partial family
            if (isFather) {
                family = { id: `fam_${parentId}_unknown`, father: parentId, mother: null, children: [], childrenBirthOrder: [] };
            } else {
                family = { id: `fam_unknown_${parentId}`, father: null, mother: parentId, children: [], childrenBirthOrder: [] };
            }
            families.push(family);
        }
        if (!family.children.includes(childId)) {
            family.children.push(childId);
        }
    };

    Object.values(individuals).forEach(ind => {
        // Regex to match Role and optional Target ID (with or without quotes)
        // Matches: Parent("John"), Parent(John), Parent ( "John" )
        const roleMatch = ind.roleStr.match(/([a-zA-Z]+)(?:\s*\(\s*["']?([^"'\)]+)["']?\s*\))?/);
        
        if (!roleMatch) {
            console.warn(`Could not parse role string: ${ind.roleStr}`);
            return;
        }
        
        const roleType = roleMatch[1];
        const targetId = roleMatch[2]; // The ID inside ()

        console.log(`Processing ${ind.id}: Role=${roleType}, Target=${targetId}`);

        if (roleType === 'Patient') {
            ind.isPatient = true;
        } else if (targetId) {
            // Ensure target exists in individuals map, if not create a dummy
            if (!individuals[targetId]) {
                console.warn(`Target ID ${targetId} not found in data. Creating dummy.`);
                individuals[targetId] = {
                    id: targetId,
                    sex: 'Unknown',
                    notes: 'Auto-generated',
                    dead: false,
                    condition: 'None',
                    roleStr: 'Unknown'
                };
            }

            if (roleType === 'Parent') {
                // ind is Parent of targetId
                addChildToParent(targetId, ind.id);
            } else if (roleType === 'Son' || roleType === 'Daughter' || roleType === 'Child') {
                // ind is Child of targetId
                addChildToParent(ind.id, targetId);
            } else if (roleType === 'Partner') {
                // ind is Partner of targetId
                getFamily(ind.id, targetId);
            } else if (roleType === 'Sibling') {
                // ind is Sibling of targetId
                // We need to find targetId's family and add ind to it
                // If targetId has no family yet, we create a dummy one for their parents
                let family = families.find(f => f.children.includes(targetId));
                if (!family) {
                    family = { id: `fam_parents_of_${targetId}`, father: null, mother: null, children: [targetId], childrenBirthOrder: [1] };
                    families.push(family);
                }
                if (!family.children.includes(ind.id)) {
                    family.children.push(ind.id);
                }
            }
        }
    });

    // ==================== VALUE CALCULATION SYSTEM ====================
    // Initialize all values to null
    Object.values(individuals).forEach(ind => {
        ind.value = null;
    });

    // Find the patient and set initial value to 1
    const patient = Object.values(individuals).find(ind => ind.isPatient);
    if (patient) {
        patient.value = 1;
    }

    // Helper function to calculate parent value from child
    const calculateParentValue = (childValue, isFather) => {
        if (childValue === null) return null;
        if (isFather) {
            return 2 * childValue * childValue; // Father: 2 × x²
        } else {
            return 0.5 * childValue * childValue; // Mother: 0.5 × x²
        }
    };

    // Helper function to calculate child value from parents
    const calculateChildValue = (fatherValue, motherValue, birthOrder) => {
        // If both parents have values, use the formula
        if (fatherValue !== null && motherValue !== null) {
            return Math.sqrt(fatherValue * motherValue) * (1.0 + 0.1 * birthOrder);
        }
        // If only one parent has a value, estimate the other
        if (fatherValue !== null && motherValue === null) {
            // Estimate mother's value from father (reverse of father calculation)
            // If father = 2 × x², then x² = father/2, so x = sqrt(father/2)
            // Then mother = 0.5 × x² = 0.5 × (father/2) = father/4
            const estimatedMotherValue = fatherValue / 4;
            return Math.sqrt(fatherValue * estimatedMotherValue) * (1.0 + 0.1 * birthOrder);
        }
        if (motherValue !== null && fatherValue === null) {
            // Estimate father's value from mother (reverse of mother calculation)
            // If mother = 0.5 × x², then x² = mother/0.5 = 2×mother
            // Then father = 2 × x² = 2 × (2×mother) = 4×mother
            const estimatedFatherValue = motherValue * 4;
            return Math.sqrt(estimatedFatherValue * motherValue) * (1.0 + 0.1 * birthOrder);
        }
        return null;
    };

    // Propagation function - iteratively calculate values
    const propagateValues = () => {
        let changed = true;
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops

        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;

            // UPWARD propagation: Calculate parent values from children
            families.forEach(fam => {
                // Check if any child has a value
                const childrenWithValues = fam.children
                    .map(childId => individuals[childId])
                    .filter(child => child && child.value !== null);

                if (childrenWithValues.length > 0) {
                    // Use the first child with a value to calculate parent values
                    const childValue = childrenWithValues[0].value;

                    // Calculate father value if not set
                    if (fam.father && individuals[fam.father] && individuals[fam.father].value === null) {
                        const fatherValue = calculateParentValue(childValue, true);
                        individuals[fam.father].value = fatherValue;
                        changed = true;
                    }

                    // Calculate mother value if not set
                    if (fam.mother && individuals[fam.mother] && individuals[fam.mother].value === null) {
                        const motherValue = calculateParentValue(childValue, false);
                        individuals[fam.mother].value = motherValue;
                        changed = true;
                    }
                }
            });

            // PARTNER propagation: Calculate partner values from each other
            families.forEach(fam => {
                const father = fam.father ? individuals[fam.father] : null;
                const mother = fam.mother ? individuals[fam.mother] : null;
                
                // If one partner has a value and the other doesn't, calculate it
                if (father && mother) {
                    if (father.value !== null && mother.value === null) {
                        // Calculate mother from father using reverse formula
                        // Father = 2x², Mother = 0.5x², so Mother = Father/4
                        mother.value = father.value / 4;
                        changed = true;
                    } else if (mother.value !== null && father.value === null) {
                        // Calculate father from mother
                        // Mother = 0.5x², Father = 2x², so Father = Mother × 4
                        father.value = mother.value * 4;
                        changed = true;
                    }
                }
            });

            // DOWNWARD propagation: Calculate children values from parents
            families.forEach(fam => {
                const father = fam.father ? individuals[fam.father] : null;
                const mother = fam.mother ? individuals[fam.mother] : null;
                const fatherValue = father ? father.value : null;
                const motherValue = mother ? mother.value : null;

                // Calculate children if at least one parent has a value
                if (fatherValue !== null || motherValue !== null) {
                    fam.children.forEach((childId, index) => {
                        const child = individuals[childId];
                        if (child && child.value === null) {
                            // Birth order starts at 1
                            const birthOrder = index + 1;
                            const childValue = calculateChildValue(fatherValue, motherValue, birthOrder);
                            if (childValue !== null) {
                                child.value = childValue;
                                changed = true;
                            }
                        }
                    });
                }
            });
        }
    };

    // Run value propagation
    propagateValues();

    // Sort children within each family by their calculated values (descending: higher values first = left to right)
    families.forEach(fam => {
        fam.children.sort((aId, bId) => {
            const aValue = individuals[aId]?.value ?? 0;
            const bValue = individuals[bId]?.value ?? 0;
            // Sort descending (higher values = males on left)
            return bValue - aValue;
        });
    });

    // Log values for debugging
    console.log("Calculated values:");
    Object.values(individuals).forEach(ind => {
        console.log(`${ind.id}: ${ind.value}`);
    });

    return { individuals, families };
}