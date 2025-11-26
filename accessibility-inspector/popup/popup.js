document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlInput = document.getElementById('url-input');
  const formatSelect = document.getElementById('format-select');
  const checkBtn = document.getElementById('check-btn');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const reportContent = document.getElementById('report-content');
  const downloadBtn = document.getElementById('download-btn');
  const copyBtn = document.getElementById('copy-btn');
  const summaryStats = document.getElementById('summary-stats');
  const buttonText = checkBtn.querySelector('.button-text');
  const loadingSpinner = checkBtn.querySelector('.loading-spinner');

  // Current report data
  let currentReport = null;

  // Initialize popup
  init();

  function init() {
    // Set up event listeners
    checkBtn.addEventListener('click', startCheck);
    downloadBtn.addEventListener('click', downloadReport);
    copyBtn.addEventListener('click', copyReportToClipboard);
    urlInput.addEventListener('keypress', handleUrlInputKeypress);

    // Load saved data
    loadSavedData();

    // Подставляем текущий URL автоматически
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].url.startsWith('http')) {
        urlInput.value = tabs[0].url;
      }
    });

    // Set focus to URL input
    urlInput.focus();
  }

  function handleUrlInputKeypress(event) {
    if (event.key === 'Enter') {
      startCheck();
    }
  }

  function loadSavedData() {
    chrome.storage.local.get(['lastUrl', 'lastFormat'], function(result) {
      if (result.lastUrl) urlInput.value = result.lastUrl;
      if (result.lastFormat) formatSelect.value = result.lastFormat;
    });
  }

  function saveCurrentData() {
    chrome.storage.local.set({
      lastUrl: urlInput.value,
      lastFormat: formatSelect.value
    });
  }

  function startCheck() {
    const url = urlInput.value.trim();
    const format = formatSelect.value;

    if (!url) {
      showStatus('Пожалуйста, введите URL-адрес для проверки', 'error');
      urlInput.focus();
      return;
    }

    if (!isValidUrl(url)) {
      showStatus('Пожалуйста, введите действительный URL-адрес (http:// or https://)', 'error');
      urlInput.focus();
      return;
    }

    saveCurrentData();
    setLoadingState(true);
    showStatus('Идёт проверка доступности...', 'loading');
    hideResults();

    chrome.runtime.sendMessage(
      { action: 'checkAccessibility', url, format },
      handleResponse
    );
  }

  function handleResponse(response) {
    setLoadingState(false);

    if (chrome.runtime.lastError) {
      showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }

    if (response?.error) {
      showStatus(`Check error: ${response.error}`, 'error');
      return;
    }

    if (response?.report) {
      try {
        let reportData = response.report;
        if (typeof reportData === 'string' && (reportData.trim().startsWith('{') || reportData.trim().startsWith('['))) {
          try { reportData = JSON.parse(reportData); } catch {}
        }

        currentReport = reportData;
        currentFormat = response.format;
        displayResults(currentReport);
        showStatus('Проверка успешно завершена!', 'success');
      } catch (error) {
        showStatus(`Ошибка обработки результатов: ${error.message}`, 'error');
      }
    } else {
      showStatus('Неизвестная ошибка при проверке - данные не получены', 'error');
    }
  }

  function displayResults(report, format) {
    displaySummaryStats(report, format);
    displayReportContent(report, format);
    resultsDiv.classList.remove('hidden');
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
  }

  function displaySummaryStats(reportData, format) {
    try {
      let summary;
      if (typeof reportData === 'object' && reportData.summary) {
        summary = reportData.summary;
      } else if (typeof reportData === 'string') {
        const totalMatch = reportData.match(/Total Issues:?\s*(\d+)/i);
        const errorsMatch = reportData.match(/Errors:?\s*(\d+)/i);
        const warningsMatch = reportData.match(/Warnings:?\s*(\d+)/i);
        summary = {
          total: totalMatch ? parseInt(totalMatch[1]) : 0,
          errors: errorsMatch ? parseInt(errorsMatch[1]) : 0,
          warnings: warningsMatch ? parseInt(warningsMatch[1]) : 0
        };
      } else {
        summary = { total: 0, errors: 0, warnings: 0 };
      }

      summaryStats.innerHTML = `
        <div class="stat-item">
          <span class="stat-number total">${summary.total}</span>
          <span class="stat-label">total issues</span>
        </div>
        <div class="stat-item">
          <span class="stat-number errors">${summary.errors}</span>
          <span class="stat-label">errors</span>
        </div>
        <div class="stat-item">
          <span class="stat-number warnings">${summary.warnings}</span>
          <span class="stat-label">warnings</span>
        </div>
      `;
    } catch {
      summaryStats.innerHTML = '<p>Error loading statistics</p>';
    }
  }

  function displayReportContent(reportData, format) {
    try {
      let content = '';
      if (typeof reportData === 'string') {
        content = format === 'html' && reportData.includes('<') ? reportData : `<pre>${escapeHtml(reportData)}</pre>`;
      } else {
        switch (format) {
          case 'html': content = formatAsHtml(reportData); break;
          case 'text': content = formatAsText(reportData); break;
          case 'json':
          default: content = formatAsJson(reportData); break;
        }
      }
      reportContent.innerHTML = content;
    } catch (error) {
      reportContent.innerHTML = `<p>Report formatting error: ${error.message}</p>`;
    }
  }

  function formatAsJson(reportData) {
    return `<pre>${JSON.stringify(reportData, null, 2)}</pre>`;
  }

  function formatAsHtml(reportData) {
    if (typeof reportData === 'string') return reportData;
    const issues = reportData.issues || [];
    let html = `
      <div class="report-header">
        <h4>Отчет доступности</h4>
        <p><strong>URL:</strong> ${reportData.url || 'Неизвестно'}</p>
        <p><strong>Время проверки:</strong> ${reportData.timestamp || 'Неизвестно'}</p>
      </div>
    `;

    if (issues.length === 0) {
      html += '<p class="no-issues">Проблемы доступности не найдены! ✅</p>';
    } else {
      html += '<div class="issues-list">';
      issues.forEach((issue, index) => {
        const typeClass = issue.type === 'error' ? 'error' : 'warning';
        html += `
          <div class="issue-item ${typeClass}">
            <div class="issue-header">
              <span class="issue-type">${typeClass === 'error' ? '❌ Ошибка' : '⚠️ Предупреждение'}</span>
              <span class="issue-category">${issue.category || 'unknown'}</span>
            </div>
            <div class="issue-message">${issue.message || 'Нет описания'}</div>
            ${issue.selector ? `<div class="issue-selector"><strong>Селектор:</strong> ${issue.selector}</div>` : ''}
            ${issue.details ? `<div class="issue-details"><pre>${JSON.stringify(issue.details, null, 2)}</pre></div>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }
    return html;
  }

  function formatAsText(reportData) {
    const report = typeof reportData === 'string' ? JSON.parse(reportData) : reportData;
    const issues = report.issues || [];
    let text = `Отчет доступности\nURL: ${report.url || 'Неизвестно'}\nВремя проверки: ${report.timestamp || 'Неизвестно'}\n\n`;
    if (issues.length === 0) text += 'Проблемы доступности не найдены! ✅\n';
    else {
      text += `Найдено проблем: ${issues.length}\n\n`;
      issues.forEach((issue, index) => {
        const typeLabel = issue.type === 'error' ? 'ОШИБКА' : 'ПРЕДУПРЕЖДЕНИЕ';
        text += `${index + 1}. [${typeLabel}] ${issue.category || 'unknown'}\n`;
        text += `   Сообщение: ${issue.message || 'Нет описания'}\n`;
        if (issue.selector) text += `   Селектор: ${issue.selector}\n`;
        text += '\n';
      });
    }
    return `<pre>${text}</pre>`;
  }

  function downloadReport() {
    if (!currentReport) { showStatus('Нет данных для скачивания', 'error'); return; }
    try {
      const format = formatSelect.value;
      let content, mimeType, extension;
      switch (format) {
        case 'html': content = typeof currentReport === 'string' ? currentReport : formatAsHtml(currentReport); mimeType = 'text/html'; extension = 'html'; break;
        case 'text': content = typeof currentReport === 'string' ? currentReport : formatAsText(currentReport); mimeType = 'text/plain'; extension = 'txt'; break;
        case 'json':
        default: content = typeof currentReport === 'string' ? currentReport : JSON.stringify(currentReport, null, 2); mimeType = 'application/json'; extension = 'json'; break;
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accessibility-report-${new Date().toISOString().slice(0,10)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Отчет скачан успешно', 'success');
    } catch (error) { showStatus(`Ошибка скачивания: ${error.message}`, 'error'); }
  }

  async function copyReportToClipboard() {
    if (!currentReport) { showStatus('Нет данных для копирования', 'error'); return; }
    try {
      const format = formatSelect.value;
      let content;
      switch (format) {
        case 'html': content = typeof currentReport === 'string' ? currentReport : formatAsHtml(currentReport); break;
        case 'text': content = typeof currentReport === 'string' ? currentReport.replace(/<[^>]*>/g, '') : formatAsText(currentReport).replace(/<[^>]*>/g, ''); break;
        case 'json': default: content = typeof currentReport === 'string' ? currentReport : JSON.stringify(currentReport, null, 2); break;
      }
      await navigator.clipboard.writeText(content);
      showStatus('Отчет скопирован в буфер обмена', 'success');
    } catch (error) { showStatus(`Ошибка копирования: ${error.message}`, 'error'); }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkBtn.disabled = true;
      buttonText.textContent = 'Checking...';
      loadingSpinner.classList.remove('hidden');
    } else {
      checkBtn.disabled = false;
      buttonText.textContent = 'Check Accessibility';
      loadingSpinner.classList.add('hidden');
    }
  }

  function showStatus(message, type='info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    if (type === 'success') setTimeout(() => { statusDiv.classList.add('hidden'); }, 5000);
  }

  function hideResults() { resultsDiv.classList.add('hidden'); currentReport = null; }
  function isValidUrl(string) { try { const url = new URL(string); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; } }
  function escapeHtml(unsafe) { if (unsafe == null) return ''; return unsafe.toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
});
