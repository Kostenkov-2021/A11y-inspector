document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const urlInput = document.getElementById('url-input');
  const formatSelect = document.getElementById('format-select');
  const checkBtn = document.getElementById('check-btn');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  // const reportContent = document.getElementById('report-content');
  const downloadBtn = document.getElementById('download-btn');
  const copyBtn = document.getElementById('copy-btn');
  const summaryStats = document.getElementById('summary-stats');
  const buttonText = checkBtn.querySelector('.button-text');
  const loadingSpinner = checkBtn.querySelector('.loading-spinner');
  const openReport = document.getElementById("open-report");

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
      showStatus('Пожалуйста, введите действительный URL-адрес (http:// или https://)', 'error');
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
      showStatus(`Ошибка: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }

    if (response?.error) {
      showStatus(`Ошибка проверки: ${response.error}`, 'error');
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
        console.log("===");
        console.log(currentFormat);
        console.log(currentReport);
        displayResults(currentReport, currentFormat);
        openReport.addEventListener("click", () => { openReportAsWindow(reportData, currentFormat) });
        
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
    // displayReportContent(report, format);
    resultsDiv.classList.remove('hidden');
    // resultsDiv.scrollIntoView({ behavior: 'smooth' });
  }

  function displaySummaryStats(reportData, format) {
    try {
      let summary;
      if (format == 'html'){
        const doc = (new DOMParser()).parseFromString(reportData, 'text/html');
        const totalIssuesElement = doc.getElementsByClassName('total')[0];
        const errorsElement = doc.getElementsByClassName('errors')[0];
        const warningsElement = doc.getElementsByClassName('warnings')[0];
        if (totalIssuesElement && errorsElement && warningsElement) {
          summary = { 
            total: totalIssuesElement.textContent.trim(), 
            errors: errorsElement.textContent.trim(), 
            warnings: warningsElement.textContent.trim()
          };
        } else {
          summary = { total: 1, errors: 2, warnings: 3 };
        }
        
      } else if (typeof reportData === 'object' && reportData.summary) {
        summary = reportData.summary;
      } else if (typeof reportData === 'string') {
        const totalMatch = reportData.match(/(?:Всего проблем|Total Issues):?\s*(\d+)/i);
        const errorsMatch = reportData.match(/(?:Ошибок|Errors):?\s*(\d+)/i);
        const warningsMatch = reportData.match(/(?:Предупреждений|Warnings):?\s*(\d+)/i);
        summary = {
          total: totalMatch ? parseInt(totalMatch[1]) : 0,
          errors: errorsMatch ? parseInt(errorsMatch[1]) : 0,
          warnings: warningsMatch ? parseInt(warningsMatch[1]) : 0
        };
      }  else {
        summary = { total: 0, errors: 0, warnings: 0 };
      }

      summaryStats.innerHTML = `
        <div class="stat-item">
          <span class="stat-number total">${summary.total}</span>
          <span class="stat-label">всего проблем</span>
        </div>
        <div class="stat-item">
          <span class="stat-number errors">${summary.errors}</span>
          <span class="stat-label">ошибок</span>
        </div>
        <div class="stat-item">
          <span class="stat-number warnings">${summary.warnings}</span>
          <span class="stat-label">предупреждений</span>
        </div>
      `;
    } catch {
      summaryStats.innerHTML = '<p>Ошибка загрузки статистики</p>';
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
      reportContent.innerHTML = `<p>Ошибка форматирования отчёта: ${error.message}</p>`;
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
        <h1>Отчёт о доступности</h1>
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
              <span class="issue-type">${typeClass === 'error' ? 'Ошибка' : 'Предупреждение'}</span>
              <span class="issue-category">${translateCategory(issue.category)}</span>
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
    let text = `Отчёт о доступности\nURL: ${report.url || 'Неизвестно'}\nВремя проверки: ${report.timestamp || 'Неизвестно'}\n\n`;
    if (issues.length === 0) text += 'Проблемы доступности не найдены! ✅\n';
    else {
      text += `Найдено проблем: ${issues.length}\n\n`;
      issues.forEach((issue, index) => {
        const typeLabel = issue.type === 'error' ? 'ОШИБКА' : 'ПРЕДУПРЕЖДЕНИЕ';
        text += `${index + 1}. [${typeLabel}] ${translateCategory(issue.category)}\n`;
        text += `   Сообщение: ${issue.message || 'Нет описания'}\n`;
        if (issue.selector) text += `   Селектор: ${issue.selector}\n`;
        text += '\n';
      });
    }
    return `<pre>${text}</pre>`;
  }

  function formatAsMarkdown(data) {
        let _report = "# Отчёт о доступности сайта\n";
    _report += "## Сводка\n\n";
    _report += "**Сайт:** " + data.url + "\n";
    _report += "**Время:** " + data.timestamp + "\n";
    _report += "**Всего проблем:** " + data.summary.total + "\n";
    _report += "**Предупреждений:** " + data.summary.warnings + "\n";
    _report += "**Ошибок:** " + data.summary.errors + "\n\n";
    _report += "## Детализация ошибок \n";
    data.issues.forEach((item, i) => {
        _report += "### **Проблема:** " + (i + 1) + "\n\n";
        _report += "**Тип:** " + translateIssueType(item.type) + "\n";
        _report += "**Категория:** " + translateCategory(item.category) + "\n"
        _report += "**Сообщение:** " + item.message + "\n";
        _report += item.selector ? "**Селектор:** " + item.selector + "\n" : "";
        _report += item.element ? "**Код элемента:**\n```\n" + item.element + "\n```\n" : "";
        if (item.category === "contrast"){
            _report += "#### Параметры контраста\n\n";
            _report += "**Оценка:** " + translateContrastScore(item.details.suggestions.score) + "\n";
            _report += "**Улучшение:** " + translateImprovement(item.details.suggestions.improvement) + "\n\n"
            _report += "##### Информация о фоне\n\n"
            _report += "**Цвет фона:** " + item.details.backgroundColor + "\n";
            _report += "**Размер шрифта:** " + item.details.fontSize + "\n";
            _report += "**Насыщенность шрифта:** " + item.details.fontWeight + "\n";
            _report += "**Контраст:** " + item.details.ratio + "\n";
            _report += "**Требуемый контраст:** " + item.details.requiredRatio + "\n";
            _report += "**Цвет текста:** " + item.details.textColor + "\n";
            _report += "##### Текущий цвет\n\n";
            _report += "**Цвет:**\n";
            _report += " - **RGB:** " + item.details.suggestions.current + "\n";
            _report += " - **HEX:** " + item.details.suggestions.currentHex + "\n\n";
            _report += "**Контраст:** " + item.details.suggestions.currentRatio + "\n";
            _report += "##### Рекомендации\n\n";
            _report += "**Предлагаемый цвет:** \n";
            _report += " - **RGB:** " + item.details.suggestions.suggested + "\n";
            _report += " - **HEX:** " + item.details.suggestions.suggestedHex + "\n\n";
            _report += "**Контраст:** " + item.details.suggestions.suggestedRatio + "\n";
        }
        _report += "\n------------\n";
    });

    return _report;
  }

  function downloadReport() {
    if (!currentReport) { showStatus('Нет данных для скачивания', 'error'); return; }
    try {
      const format = formatSelect.value;
      let content, mimeType, extension;
      switch (format) {
        case 'html': content = typeof currentReport === 'string' ? currentReport : formatAsHtml(currentReport); mimeType = 'text/html'; extension = 'html'; break;
        case 'text': content = typeof currentReport === 'string' ? currentReport : formatAsText(currentReport); mimeType = 'text/plain'; extension = 'txt'; break;
        case 'markdown': content = typeof currentReport === 'string' ? currentReport : formatAsMarkdown(currentReport); mimeType = 'text/plain'; extension = 'md'; break;
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
      showStatus('Отчёт скачан успешно', 'success');
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
        case 'markdown': content = typeof currentReport === 'string' ? currentReport : formatAsMarkdown(currentReport); break;
        case 'json': default: content = typeof currentReport === 'string' ? currentReport : JSON.stringify(currentReport, null, 2); break;
      }
      await navigator.clipboard.writeText(content);
      showStatus('Отчёт скопирован в буфер обмена', 'success');
    } catch (error) { showStatus(`Ошибка копирования: ${error.message}`, 'error'); }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkBtn.disabled = true;
      buttonText.textContent = 'Проверка...';
      loadingSpinner.classList.remove('hidden');
    } else {
      checkBtn.disabled = false;
      buttonText.textContent = 'Проверить доступность';
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

  function translateIssueType(type) {
    return ({ error: 'ошибка', warning: 'предупреждение' })[type] || (type || 'не указано');
  }

  function translateCategory(category) {
    return ({
      images: 'изображения',
      language: 'язык страницы',
      headings: 'заголовки',
      forms: 'формы',
      contrast: 'контраст',
      aria: 'ARIA',
      keyboard: 'клавиатура',
      semantics: 'семантика',
      navigation: 'навигация',
      links: 'ссылки',
      interactive: 'интерактивные элементы',
      system: 'система',
      general: 'общее'
    })[category] || (category || 'неизвестно');
  }

  function translateImprovement(improvement) {
    return ({ none: 'не требуется', darken: 'сделать темнее', lighten: 'сделать светлее', error: 'ошибка' })[improvement] || (improvement || 'не указано');
  }

  function translateContrastScore(score) {
    return score === 'Fail' ? 'Не соответствует' : (score || 'не указано');
  }

  function openReportAsWindow(reportData, reportFormat){
    let heading_popup = '';
    let content = '';
      switch (reportFormat) {
          case 'html': 
            content = formatAsHtml(reportData); 
            heading_popup = 'data:text/html;charset=utf-8,';
            break;
          case 'text': 
            content = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { padding: 20px; font-family: sans-serif; }
              </style>
            </head>
            <body>
              <pre>${reportData}</pre>
            </body>
            </html>
            `; 
            heading_popup = 'data:text/html;charset=utf-8,';
            break;
          case 'markdown':
            content = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { padding: 20px; font-family: sans-serif; }
              </style>
            </head>
            <body>
              <pre>${
                formatAsMarkdown(reportData)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
              }</pre>
            </body>
            </html>
            `
            heading_popup = 'data:text/html;charset=utf-8,';
            break;
          case 'json':
            heading_popup = 'data:text/json;charset=utf-8,';
          default: content = JSON.stringify(reportData, null, 2); break;
        }
    chrome.windows.create({
        url: heading_popup + encodeURIComponent(content),
        type: "popup",
        width: 900,
        height: 650
      });
  }

});
