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
    // Открываем новую вкладку для проверки
    const tab = await chrome.tabs.create({ url, active: false });
    
    // Ждем загрузки страницы
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });

    // Внедряем скрипт проверки доступности
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: runA11yChecks
    });

    // Закрываем вкладку
    await chrome.tabs.remove(tab.id);

    // Генерируем отчет
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