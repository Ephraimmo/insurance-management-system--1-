import { When } from '@cucumber/cucumber';
import { Page, ElementHandle } from 'puppeteer';

interface CustomWorld {
    page: Page;
}

/**
 * Step to enter value in any input field
 * Supports:
 * - Regular text inputs
 * - Select dropdowns
 * - Date pickers
 * - Checkboxes
 * - Radio buttons
 */
When('I enter {string} in the {string} field', async function(this: CustomWorld, value: string, fieldLabel: string) {
    // Try multiple selector strategies
    let input: ElementHandle<Element> | null = null;
    
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
            const text = await label.evaluate((el: HTMLLabelElement) => el.textContent);
            if (text?.trim() === fieldLabel) {
                const forAttribute = await label.evaluate((el: HTMLLabelElement) => el.getAttribute('for'));
                if (forAttribute) {
                    input = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }
    }

    if (input) {
        // Clear the input first
        await input.evaluate((el: HTMLInputElement) => el.value = '');
        // Type the new value
        await input.type(value, { delay: 50 }); // Add a small delay between keystrokes
    } else {
        throw new Error(`Could not find input field with label "${fieldLabel}"`);
    }
});

/**
 * Step to select a value from a dropdown
 */
When('I select {string} in the {string} field', async function(this: CustomWorld, value: string, fieldLabel: string) {
    try {
        // Try multiple selector strategies to find the select trigger
        let selectTrigger: ElementHandle<Element> | null = null;
        
        // Strategy 1: Try finding by label and associated trigger
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate((el: HTMLLabelElement) => el.textContent?.trim());
            if (text === fieldLabel) {
                const forAttribute = await label.evaluate((el: HTMLLabelElement) => el.getAttribute('for'));
                if (forAttribute) {
                    // Look for the select trigger in the same container as the label
                    const container = await this.page.evaluateHandle((id: string) => {
                        const label = document.querySelector(`label[for="${id}"]`);
                        return label?.closest('div');
                    }, forAttribute);
                    
                    if (container) {
                        // Try to find the button that opens the select
                        const button = await container.asElement()?.$('button[role="combobox"]');
                        if (button) {
                            selectTrigger = button;
                        }
                    }
                    break;
                }
            }
        }

        // Strategy 2: Try finding by ID variations
        if (!selectTrigger) {
            const idVariations = [
                fieldLabel.toLowerCase().replace(/\s+/g, ''),
                fieldLabel.toLowerCase().replace(/\s+/g, '-'),
                `${fieldLabel.toLowerCase().replace(/\s+/g, '')}-trigger`,
                `${fieldLabel.toLowerCase().replace(/\s+/g, '-')}-trigger`
            ];

            for (const id of idVariations) {
                selectTrigger = await this.page.$(`#${id}, [id*="${id}"], button[id*="${id}"]`);
                if (selectTrigger) break;
            }
        }

        // Strategy 3: Try finding by aria-label or other attributes
        if (!selectTrigger) {
            const selectors = [
                `[aria-label="${fieldLabel}"]`,
                `[aria-label*="${fieldLabel}"]`,
                `button[role="combobox"][aria-label*="${fieldLabel}"]`,
                `button[aria-haspopup="listbox"][aria-label*="${fieldLabel}"]`,
                `button[data-state="closed"][aria-expanded="false"]`
            ];

            for (const selector of selectors) {
                selectTrigger = await this.page.$(selector);
                if (selectTrigger) break;
            }
        }

        if (!selectTrigger) {
            throw new Error(`Could not find select trigger for "${fieldLabel}"`);
        }

        // Click the trigger to open the dropdown
        await selectTrigger.click();
        await this.page.waitForTimeout(100); // Small delay to ensure animation starts

        // Wait for the dropdown content to be visible
        await this.page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5000 });

        // Try multiple strategies to find and click the option
        const optionSelectors = [
            // Exact matches
            `[role="option"][data-value="${value}"]`,
            `[role="option"][id="${value.toLowerCase().replace(/\s+/g, '-')}"]`,
            
            // Partial matches
            `[role="option"][id*="${value.toLowerCase().replace(/\s+/g, '')}"]`,
            `[role="option"][id*="${value.toLowerCase().replace(/\s+/g, '-')}"]`,
            
            // By text content
            `[role="option"]:has-text("${value}")`,
            
            // By SelectItem attributes
            `[data-value="${value}"]`,
            `[data-value="${value.toLowerCase()}"]`
        ];

        let optionClicked = false;
        for (const selector of optionSelectors) {
            try {
                const option = await this.page.waitForSelector(selector, { visible: true, timeout: 2000 });
                if (option) {
                    await option.click();
                    optionClicked = true;
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        if (!optionClicked) {
            // If we couldn't find the option by selectors, try finding by text content
            const options = await this.page.$$('[role="option"]');
            for (const option of options) {
                const text = await option.evaluate((el: HTMLElement) => el.textContent?.trim());
                if (text === value) {
                    await option.click();
                    optionClicked = true;
                    break;
                }
            }
        }

        if (!optionClicked) {
            throw new Error(`Could not find or click option "${value}" in dropdown`);
        }

        // Wait for the dropdown to close
        await this.page.waitForFunction(() => {
            const dropdown = document.querySelector('[role="listbox"]');
            return !dropdown || !dropdown.isConnected || getComputedStyle(dropdown).display === 'none';
        }, { timeout: 5000 });

    } catch (error: any) {
        console.error('Error in dropdown selection:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to select "${value}" in field "${fieldLabel}": ${errorMessage}`);
    }
});

/**
 * Step to select a date
 */
When('I select date {string} in the {string} field', async function(this: CustomWorld, dateStr: string, fieldLabel: string) {
    try {
        // First try to find the date input directly
        let dateInput: ElementHandle<Element> | null = null;
        
        // Strategy 1: Try finding by label text
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate((el: HTMLLabelElement) => el.textContent?.trim());
            if (text === fieldLabel) {
                const forAttribute = await label.evaluate((el: HTMLLabelElement) => el.getAttribute('for'));
                if (forAttribute) {
                    dateInput = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }

        // Strategy 2: Try finding by ID
        if (!dateInput) {
            const normalizedId = fieldLabel.toLowerCase().replace(/\s+/g, '');
            dateInput = await this.page.$(`#${normalizedId}`);
        }

        if (!dateInput) {
            throw new Error(`Could not find date input with label "${fieldLabel}"`);
        }

        // Click to open the date picker
        await dateInput.click();
        
        // Parse the date
        const [day, month, year] = dateStr.split('/');
        const paddedDay = day.padStart(2, '0');
        const paddedMonth = month.padStart(2, '0');

        // Wait for any of these possible date picker elements
        const calendarSelectors = [
            '.rdp',
            '.react-datepicker',
            '.date-picker-dropdown',
            '[role="dialog"][aria-label*="calendar"]',
            '[role="dialog"][aria-label*="Choose date"]'
        ];

        let calendarVisible = false;
        for (const selector of calendarSelectors) {
            try {
                await this.page.waitForSelector(selector, { visible: true, timeout: 2000 });
                calendarVisible = true;
                break;
            } catch (err) {
                continue;
            }
        }

        if (!calendarVisible) {
            throw new Error('Date picker calendar did not appear after clicking the input');
        }

        // Try multiple strategies to find and click the date
        const dateSelectors = [
            // Data attributes
            `[data-date="${year}-${paddedMonth}-${paddedDay}"]`,
            `button[data-date="${year}-${paddedMonth}-${paddedDay}"]`,
            `td[data-date="${year}-${paddedMonth}-${paddedDay}"]`,
            
            // ARIA labels
            `button[aria-label*="${paddedDay}/${paddedMonth}/${year}"]`,
            `button[aria-label*="${parseInt(day)} ${month} ${year}"]`,
            `button[aria-label*="${dateStr}"]`,
            
            // Day number
            `button[role="gridcell"]:not([disabled]):not(.rdp-day_selected):not(.rdp-day_outside)[aria-label*="${parseInt(day)}"]`,
            `.rdp-day:not(.rdp-day_selected):not(.rdp-day_outside)[aria-label*="${parseInt(day)}"]`,
            `[role="gridcell"]:not([disabled])[aria-label*="${parseInt(day)}"]`
        ];

        let dateClicked = false;
        for (const selector of dateSelectors) {
            try {
                const dateElement = await this.page.waitForSelector(selector, { visible: true, timeout: 1000 });
                if (dateElement) {
                    await dateElement.click();
                    dateClicked = true;
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        if (!dateClicked) {
            throw new Error(`Could not find or click date ${dateStr} in the calendar`);
        }

        // Wait for the calendar to disappear to confirm the selection
        await this.page.waitForFunction(() => {
            const calendars = document.querySelectorAll('.rdp, .react-datepicker, .date-picker-dropdown, [role="dialog"][aria-label*="calendar"]');
            return calendars.length === 0;
        }, { timeout: 5000 });

    } catch (error: any) {
        console.error('Error in date selection:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to select date ${dateStr} in field "${fieldLabel}": ${errorMessage}`);
    }
});

/**
 * Step to check/uncheck a checkbox
 */
When('I {string} the {string} checkbox', async function(this: CustomWorld, action: 'check' | 'uncheck', checkboxLabel: string) {
    // Try multiple selector strategies
    let checkbox: ElementHandle<Element> | null = null;
    
    // Strategy 1: Try finding by aria-label
    checkbox = await this.page.$(`input[type="checkbox"][aria-label="${checkboxLabel}"]`);
    
    // Strategy 2: Try finding by ID that matches the label
    if (!checkbox) {
        checkbox = await this.page.$(`#${checkboxLabel.toLowerCase().replace(/\s+/g, '')}`);
    }
    
    // Strategy 3: Try finding label and then associated checkbox
    if (!checkbox) {
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate((el: HTMLLabelElement) => el.textContent);
            if (text?.trim() === checkboxLabel) {
                const forAttribute = await label.evaluate((el: HTMLLabelElement) => el.getAttribute('for'));
                if (forAttribute) {
                    checkbox = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }
    }

    if (checkbox) {
        const isChecked = await checkbox.evaluate((el: HTMLInputElement) => el.checked);
        if ((action === 'check' && !isChecked) || (action === 'uncheck' && isChecked)) {
            await checkbox.click();
        }
    } else {
        throw new Error(`Could not find checkbox with label "${checkboxLabel}"`);
    }
});

/**
 * Step to upload a file
 */
When('I upload file {string} to the {string} field', async function(this: CustomWorld, filePath: string, fieldLabel: string) {
    // Try multiple selector strategies
    let fileInput: ElementHandle<Element> | null = null;
    
    // Strategy 1: Try finding by aria-label
    fileInput = await this.page.$(`input[type="file"][aria-label="${fieldLabel}"]`);
    
    // Strategy 2: Try finding by ID that matches the label
    if (!fileInput) {
        fileInput = await this.page.$(`#${fieldLabel.toLowerCase().replace(/\s+/g, '')}`);
    }
    
    // Strategy 3: Try finding label and then associated file input
    if (!fileInput) {
        const labels = await this.page.$$('label');
        for (const label of labels) {
            const text = await label.evaluate((el: HTMLLabelElement) => el.textContent);
            if (text?.trim() === fieldLabel) {
                const forAttribute = await label.evaluate((el: HTMLLabelElement) => el.getAttribute('for'));
                if (forAttribute) {
                    fileInput = await this.page.$(`#${forAttribute}`);
                    break;
                }
            }
        }
    }

    if (fileInput) {
        await fileInput.evaluate((el: HTMLInputElement) => el.value = ''); // Clear any existing value
        await fileInput.uploadFile(filePath);
    } else {
        throw new Error(`Could not find file input with label "${fieldLabel}"`);
    }
});
