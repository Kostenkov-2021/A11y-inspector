/**
 * Background service worker for the Accessibility Inspector extension
 * Handles accessibility checks and communication between popup and content scripts
 */

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAccessibility') {
    handleAccessibilityCheck(request.url, request.format)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Indicates async response
  }
});

/**
 * Main function to handle accessibility checking process
 * @param {string} url - URL to check
 * @param {string} format - Report format (json, html, text)
 */
async function handleAccessibilityCheck(url, format) {
  // Check if scripting API is available
  if (!chrome.scripting) {
    throw new Error('Scripting API is not available. Check manifest permissions.');
  }

  let tab;
  try {
    console.log('Creating tab for URL:', url);
    
    // Validate URL format
    if (!isValidHttpUrl(url)) {
      throw new Error('Invalid URL format. Please use http:// or https://');
    }

    // Create a new tab for checking
    tab = await chrome.tabs.create({ url, active: false });
    
    // Wait for the page to load completely
    await waitForTabLoad(tab.id);

    console.log('Page loaded, injecting content scripts...');

    // Inject all necessary content scripts
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'utils/color-utils.js',
        'utils/a11y-rules.js',
        'utils/report-generator.js',
        'content-script.js'
      ]
    });

    console.log('Content scripts injected, waiting for initialization...');

    // Wait for content script to be ready
    await waitForContentScript(tab.id);

    console.log('Content script ready, executing checks...');

    // Execute accessibility checks and get raw data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: performAccessibilityCheck
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('No results returned from accessibility check');
    }

    const checkResult = results[0].result;
    
    // Validate the result structure
    if (typeof checkResult === 'string' && checkResult.includes('Error:')) {
      throw new Error(`Content script error: ${checkResult}`);
    }

    if (!checkResult.issues || !checkResult.summary) {
      throw new Error('Invalid data structure from accessibility check');
    }

    console.log('Accessibility check completed, generating report...');

    // Generate the report using ReportGenerator from content script
    const reportResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: generateReportInContentScript,
      args: [checkResult, format]
    });

    if (!reportResults || !reportResults[0] || !reportResults[0].result) {
      throw new Error('Failed to generate report');
    }

    const report = reportResults[0].result;
    
    // Validate report is not HTML error page
    if (typeof report === 'string' && report.trim().startsWith('<!DOCTYPE') || 
        report.includes('<html>') || report.includes('</html>')) {
      throw new Error('Received HTML instead of accessibility report. The URL might be inaccessible.');
    }

    return { report };

  } catch (error) {
    console.error('Error in handleAccessibilityCheck:', error);
    throw new Error(`Failed to check website: ${error.message}`);
  } finally {
    // Always close the checking tab
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
        console.log('Checking tab closed');
      } catch (e) {
        console.warn('Failed to close tab:', e.message);
      }
    }
  }
}

/**
 * Wait for tab to load completely
 * @param {number} tabId - ID of the tab to wait for
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Page load timeout (30 seconds)'));
    }, 30000);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('Tab loaded completely');
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    // Check if tab is already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

/**
 * Wait for content script to initialize
 * @param {number} tabId - ID of the tab
 */
function waitForContentScript(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Content script failed to load (10 seconds)'));
    }, 10000);

    let attempts = 0;
    const maxAttempts = 50;

    const checkScript = async () => {
      attempts++;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          function: () => {
            return {
              hasRunA11yChecks: typeof runA11yChecks === 'function',
              hasColorUtils: typeof ColorUtils !== 'undefined',
              hasA11yRules: typeof A11yRules !== 'undefined',
              hasReportGenerator: typeof ReportGenerator !== 'undefined',
              isReady: !!window.a11yInspectorReady
            };
          }
        });

        const dependencies = results[0].result;
        if (dependencies.hasRunA11yChecks && 
            dependencies.hasColorUtils && 
            dependencies.hasA11yRules &&
            dependencies.hasReportGenerator &&
            dependencies.isReady) {
          clearTimeout(timeout);
          console.log('All content scripts loaded successfully');
          resolve();
        } else {
          console.log('Waiting for dependencies:', dependencies);
          if (attempts >= maxAttempts) {
            clearTimeout(timeout);
            reject(new Error(`Content script dependencies not loaded after maximum attempts. Status: ${JSON.stringify(dependencies)}`));
          } else {
            setTimeout(checkScript, 200);
          }
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          clearTimeout(timeout);
          reject(new Error(`Failed to check content script: ${error.message}`));
        } else {
          setTimeout(checkScript, 200);
        }
      }
    };

    checkScript();
  });
}

/**
 * Function injected into the page to run accessibility checks
 */
function performAccessibilityCheck() {
  try {
    if (typeof runA11yChecks === 'function') {
      return runA11yChecks();
    } else {
      throw new Error('runA11yChecks function not found');
    }
  } catch (error) {
    console.error('Error in performAccessibilityCheck:', error);
    return {
      error: error.message,
      issues: [],
      summary: { total: 0, errors: 1, warnings: 0 }
    };
  }
}

/**
 * Generate report in content script context
 * @param {Object} data - Accessibility check data
 * @param {string} format - Report format
 */
function generateReportInContentScript(data, format) {
  try {
    if (typeof ReportGenerator === 'undefined') {
      throw new Error('ReportGenerator not available');
    }
    
    const generator = new ReportGenerator();
    return generator.generate(data, format);
  } catch (error) {
    console.error('Error generating report in content script:', error);
    return `Error generating report: ${error.message}`;
  }
}

/**
 * Validate HTTP URL format
 * @param {string} string - URL to validate
 */
function isValidHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}