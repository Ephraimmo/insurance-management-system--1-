When('I enter {string} in the {string} field', async function(value, fieldLabel) {
    // Try multiple selector strategies
    let input = null;
    
    // Strategy 1: Try finding by aria-label
    input = await this.page.$(`input[aria-label="${fieldLabel}"]`);
    
    // Strategy 2: Try finding by ID that matches the field label
    if (!input) {
        input = await this.page.$(`#${fieldLabel.toLowerCase().replace(/\s+/g, '')}`);
    }
    
    // Strategy 3: Try finding label and then associated input
    if (!input) {
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate(el => el.textContent);
            if (text?.trim() === fieldLabel) {
                const forAttribute = await label.evaluate(el => el.getAttribute('for'));
                if (forAttribute) {
                    input = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }
    }

    if (input) {
        // Clear the input first
        await input.evaluate(el => el.value = '');
        // Type the new value
        await input.type(value, { delay: 50 }); // Add a small delay between keystrokes
    } else {
        throw new Error(`Could not find input field with label "${fieldLabel}"`);
    }
});

When('I select date {string} in the {string} field', async function(dateStr, fieldLabel) {
    // Try multiple selector strategies
    let input = null;
    
    // Strategy 1: Try finding by aria-label
    input = await this.page.$(`input[aria-label="${fieldLabel}"]`);
    
    // Strategy 2: Try finding by ID that matches the field label
    if (!input) {
        input = await this.page.$(`#${fieldLabel.toLowerCase().replace(/\s+/g, '')}`);
    }
    
    // Strategy 3: Try finding label and then associated input
    if (!input) {
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate(el => el.textContent);
            if (text?.trim() === fieldLabel) {
                const forAttribute = await label.evaluate(el => el.getAttribute('for'));
                if (forAttribute) {
                    input = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }
    }

    if (!input) {
        throw new Error(`Could not find date input with label "${fieldLabel}"`);
    }

    // Parse the date string (assuming format DD/MM/YYYY)
    const [day, month, year] = dateStr.split('/');
    const formattedDate = `${year}-${month}-${day}`; // Convert to YYYY-MM-DD format

    // Clear the input first
    await input.evaluate(el => el.value = '');

    // Set the value and trigger all necessary events
    await input.evaluate((el, value) => {
        el.value = value;
        // Create and dispatch input event
        const inputEvent = new Event('input', { bubbles: true });
        el.dispatchEvent(inputEvent);
        // Create and dispatch change event
        const changeEvent = new Event('change', { bubbles: true });
        el.dispatchEvent(changeEvent);
        // Create and dispatch blur event
        const blurEvent = new Event('blur', { bubbles: true });
        el.dispatchEvent(blurEvent);
    }, formattedDate);

    // Wait for a moment to ensure the value is set
    await this.page.waitForTimeout(100);
});

// Step to click the Add Contact button
When('I click on {string} button', async function(buttonText) {
    const buttonSelector = `button:has-text("${buttonText}")`;
    const button = await this.page.$(buttonSelector);
    
    if (button) {
        await button.click();
    } else {
        throw new Error(`Could not find button with text "${buttonText}"`);
    }
});

// Step to enter contact details
When('I enter contact of type {string} with value {string}', async function(contactType, contactValue) {
    // Find and click the contact type select
    const selectTrigger = await this.page.$('button[role="combobox"]');
    if (!selectTrigger) {
        throw new Error('Could not find contact type select');
    }
    await selectTrigger.click();
    
    // Wait for the select content to be visible
    await this.page.waitForSelector('[role="option"]', { state: 'visible' });

    // Select the contact type using a valid selector
    const typeOption = await this.page.$(`[role="option"][data-value="${contactType}"]`);
    if (!typeOption) {
        // Try alternative selector if data-value is not found
        const options = await this.page.$$('[role="option"]');
        let found = false;
        for (const option of options) {
            const text = await option.evaluate(el => el.textContent);
            if (text?.trim() === contactType) {
                await option.click();
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error(`Could not find contact type option "${contactType}"`);
        }
    } else {
        await typeOption.click();
    }

    // Wait a moment for the select to close
    await this.page.waitForTimeout(100);

    // Find the last input field (most recently added contact)
    const inputs = await this.page.$$('input:not([type="file"])');
    const lastInput = inputs[inputs.length - 1];
    if (!lastInput) {
        throw new Error('Could not find contact value input');
    }

    // Clear and enter the contact value
    await lastInput.evaluate(el => el.value = '');
    await lastInput.type(contactValue, { delay: 50 });
});

// Step to verify contact details
Then('I should see contact of type {string} with value {string}', async function(contactType, contactValue) {
    // Find the contact row that contains both the type and value
    const contactExists = await this.page.evaluate(
        ([type, value]) => {
            const rows = Array.from(document.querySelectorAll('.flex.items-center'));
            return rows.some(row => {
                const hasType = row.textContent?.includes(type);
                const hasValue = row.querySelector(`input[value="${value}"]`);
                return hasType && hasValue;
            });
        },
        [contactType, contactValue]
    );

    if (!contactExists) {
        throw new Error(`Could not find contact with type "${contactType}" and value "${contactValue}"`);
    }
}); 