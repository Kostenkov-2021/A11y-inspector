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
    throw new Error('API scripting недоступен. Проверьте разрешения в manifest.json.');
  }

  let tab;
  try {
    console.log('Создание вкладки для URL:', url);
    
    // Validate URL format
    if (!isValidHttpUrl(url)) {
      throw new Error('Недопустимый формат URL. Используйте http:// или https://');
    }

    // Create a new tab for checking
    tab = await chrome.tabs.create({ url, active: false });
    
    // Wait for the page to load completely
    await waitForTabLoad(tab.id);

    console.log('Страница загружена, внедряются сценарии...');

    // Inject all necessary content scripts
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'utils/color-utils.js',
        'utils/a11y-rules.js',
        'utils/doka-links.js',
        'utils/report-generator.js',
        'utils/language-detector.js',
        'content-script.js'
      ]
    });

    console.log('Сценарии внедрены, ожидание инициализации...');

    // Wait for content script to be ready
    await waitForContentScript(tab.id);

    console.log('Сценарий страницы готов, выполняются проверки...');

    // Execute accessibility checks and get raw data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: performAccessibilityCheck
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Проверка доступности не вернула результатов');
    }

    const checkResult = results[0].result;
    
    // Validate the result structure
    if (typeof checkResult === 'string' && checkResult.includes('Error:')) {
      throw new Error(`Ошибка сценария страницы: ${checkResult}`);
    }

    if (!checkResult.issues || !checkResult.summary) {
      throw new Error('Проверка доступности вернула данные в недопустимом формате');
    }

    console.log('Проверка доступности завершена, формируется отчёт...');

    // Generate the report using ReportGenerator from content script
    const reportResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: generateReportInContentScript,
      args: [checkResult, format]
    });

    if (!reportResults || !reportResults[0] || !reportResults[0].result) {
      throw new Error('Не удалось сформировать отчёт');
    }

    const report = reportResults[0].result;
    
    // Validate report is not HTML error page
    if (
        format !== 'html' &&
        typeof report === 'string' &&
        (
            report.trim().startsWith('<!DOCTYPE') ||
            report.includes('<html') ||
            report.includes('</html>')
        )
    ) {
        throw new Error('Вместо отчёта о доступности получен HTML. Возможно, URL недоступен.');
    }

    return { report, format };


  } catch (error) {
    console.error('Ошибка в handleAccessibilityCheck:', error);
    throw new Error(`Не удалось проверить сайт: ${error.message}`);
  } finally {
    // Always close the checking tab
    if (tab?.id) {
      try {
        await chrome.tabs.remove(tab.id);
        console.log('Вкладка проверки закрыта');
      } catch (e) {
        console.warn('Не удалось закрыть вкладку:', e.message);
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
      reject(new Error('Время загрузки страницы истекло (30 секунд)'));
    }, 30000);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        console.log('Вкладка полностью загружена');
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
      reject(new Error('Сценарий страницы не загрузился (10 секунд)'));
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
          console.log('Все сценарии страницы успешно загружены');
          resolve();
        } else {
          console.log('Ожидание зависимостей:', dependencies);
          if (attempts >= maxAttempts) {
            clearTimeout(timeout);
            reject(new Error(`Зависимости сценария страницы не загрузились после максимального числа попыток. Статус: ${JSON.stringify(dependencies)}`));
          } else {
            setTimeout(checkScript, 200);
          }
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          clearTimeout(timeout);
          reject(new Error(`Не удалось проверить сценарий страницы: ${error.message}`));
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
      throw new Error('Функция runA11yChecks не найдена');
    }
  } catch (error) {
    console.error('Ошибка в performAccessibilityCheck:', error);
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
      throw new Error('ReportGenerator недоступен');
    }
    
    const generator = new ReportGenerator();
    return generator.generate(data, format);
  } catch (error) {
    console.error('Ошибка формирования отчёта в сценарии страницы:', error);
    return `Ошибка формирования отчёта: ${error.message}`;
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
