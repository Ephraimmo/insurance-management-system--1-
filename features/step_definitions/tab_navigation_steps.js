const { When } = require('@cucumber/cucumber');

// Step to click on a specific tab
When('I click on the {string} tab', async function(tabName) {
    // Find the tab by role and data-content
    const tabSelector = `[role="tab"][data-content="${tabName}"]`;
    const tab = await this.page.$(tabSelector);
    
    if (tab) {
        await tab.click();
        // Wait for the tab content to be visible
        await this.page.waitForSelector(`[role="tabpanel"]`, { state: 'visible' });
    } else {
        throw new Error(`Could not find tab with name "${tabName}"`);
    }
});

// Step to verify the current active tab
When('I should be on the {string} tab', async function(tabName) {
    // Check if the tab with the given name is selected/active
    const activeTabSelector = `[role="tab"][data-state="active"][data-content="${tabName}"]`;
    const activeTab = await this.page.$(activeTabSelector);
    
    if (!activeTab) {
        throw new Error(`The "${tabName}" tab is not currently active`);
    }
});

// Step to navigate through a sequence of tabs
When('I navigate through the following tabs:', async function(dataTable) {
    const tabs = dataTable.raw().map(row => row[0]);
    
    for (const tabName of tabs) {
        // Click on the tab
        const tabSelector = `[role="tab"][data-content="${tabName}"]`;
        const tab = await this.page.$(tabSelector);
        
        if (tab) {
            await tab.click();
            // Wait for the tab content to be visible
            await this.page.waitForSelector(`[role="tabpanel"]`, { state: 'visible' });
            // Add a small delay to allow animations to complete
            await this.page.waitForTimeout(500);
        } else {
            throw new Error(`Could not find tab with name "${tabName}"`);
        }
    }
});

// Step to verify all tabs are present
When('I should see the following tabs:', async function(dataTable) {
    const expectedTabs = dataTable.raw().map(row => row[0]);
    
    for (const tabName of expectedTabs) {
        const tabSelector = `[role="tab"][data-content="${tabName}"]`;
        const tab = await this.page.$(tabSelector);
        
        if (!tab) {
            throw new Error(`Tab "${tabName}" is not present`);
        }
    }
}); 