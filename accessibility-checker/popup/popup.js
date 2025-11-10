document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('url-input');
  const formatSelect = document.getElementById('format-select');
  const checkBtn = document.getElementById('check-btn');
  const downloadBtn = document.getElementById('download-btn');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const reportContent = document.getElementById('report-content');

  // Checking the current tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url) {
      urlInput.value = tabs[0].url;
    }
  });

  checkBtn.addEventListener('click', async function() {
    const url = urlInput.value.trim();
    const format = formatSelect.value;

    if (!url) {
      showStatus('Введите URL сайта', 'error');
      return;
    }

    if (!isValidUrl(url)) {
      showStatus('Некорректный URL', 'error');
      return;
    }

    showStatus('Проверка доступности...', '');

    try {
      const report = await runAccessibilityCheck(url, format);
      displayResults(report, format);
      showStatus('Проверка завершена', 'success');
      resultsDiv.classList.remove('hidden');
    } catch (error) {
      showStatus(`Ошибка: ${error.message}`, 'error');
    }
  });

  downloadBtn.addEventListener('click', function() {
    const format = formatSelect.value;
    const content = reportContent.textContent;
    downloadReport(content, format);
  });
});

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function displayResults(report, format) {
  const reportContent = document.getElementById('report-content');
  
  if (format === 'html') {
    reportContent.innerHTML = report;
  } else {
    reportContent.textContent = report;
  }
}

function downloadReport(content, format) {
  const mimeTypes = {
    json: 'application/json',
    html: 'text/html',
    csv: 'text/csv',
    markdown: 'text/markdown'
  };

  const blob = new Blob([content], { type: mimeTypes[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accessibility-report.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}