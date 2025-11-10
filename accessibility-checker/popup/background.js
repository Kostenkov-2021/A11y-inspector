chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAccessibility') {
    handleAccessibilityCheck(request.url, request.format)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function handleAccessibilityCheck(url, format) {
  try {
    // Opening a new checking tab
    const tab = await chrome.tabs.create({ url, active: false });
    
    // Waiting for the page to load
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    // Implementing the accessibility check script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: runA11yChecks
    });

    // Closing the tab
    await chrome.tabs.remove(tab.id);

    // Generating a report
    const report = generateReport(results[0].result, format);
    return { report };

  } catch (error) {
    throw new Error(`Не удалось проверить сайт: ${error.message}`);
  }
}

function generateReport(a11yData, format) {
  const generator = new ReportGenerator();
  return generator.generate(a11yData, format);
}