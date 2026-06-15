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
            ${issue.element ? `<div class="issue-element"><strong>Код элемента:</strong><pre><code>${escapeHtml(issue.element)}</code></pre></div>` : ''}
            ${issue.details ? formatDetailsHtml(issue.details) : ''}
            ${formatGuideLinksHtml(issue)}
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
        if (issue.element) text += `   Код элемента:\n${issue.element}\n`;
        if (issue.details) text += formatDetailsText(issue.details, '   ');
        text += formatGuideLinksText(issue);
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
        _report += item.element ? formatElementMarkdown(item.element) : "";
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
        } else if (item.details) {
            _report += formatDetailsMarkdown(item.details);
        }
        _report += formatGuideLinksMarkdown(item);
        _report += "\n------------\n";
    });

    return _report;
  }

  function formatDetailsHtml(details) {
    const entries = Object.entries(details || {});
    if (!entries.length) return '<div class="issue-details"><strong>Подробности:</strong> дополнительные сведения отсутствуют</div>';
    return `<div class="issue-details"><strong>Подробности:</strong><dl>${entries.map(([key, value]) => `<dt><strong>${escapeHtml(translateDetailKey(key))}:</strong></dt><dd>${escapeHtml(formatDetailValue(value, key))}</dd>`).join('')}</dl></div>`;
  }

  function formatElementMarkdown(element) {
    const fence = String(element).includes('```') ? '````' : '```';
    return `**Код элемента:**\n${fence}\n${element}\n${fence}\n`;
  }

  function formatDetailsText(details, indent = '') {
    const entries = Object.entries(details || {});
    if (!entries.length) return `${indent}Подробности: дополнительные сведения отсутствуют\n`;
    return `${indent}Подробности:\n` + entries.map(([key, value]) => `${indent}- ${translateDetailKey(key)}: ${formatDetailValue(value, key)}\n`).join('');
  }

  function formatDetailsMarkdown(details) {
    const entries = Object.entries(details || {});
    if (!entries.length) return "\n#### Подробности\n\nДополнительные сведения отсутствуют\n";
    return "\n#### Подробности\n\n" + entries.map(([key, value]) => `- **${translateDetailKey(key)}:** ${formatDetailValue(value, key)}\n`).join('');
  }

  function formatDetailValue(value, key = '') {
    if (value === null || value === undefined || value === '') return 'не указано';
    if (Array.isArray(value)) return value.length ? value.map(item => formatDetailValue(item, key)).join('; ') : 'нет данных';
    if (typeof value === 'object') {
      return Object.entries(value).map(([itemKey, itemValue]) => `${translateDetailKey(itemKey)}: ${formatDetailValue(itemValue, itemKey)}`).join('; ');
    }
    if (typeof value === 'boolean') return value ? 'да' : 'нет';
    if (['issue', 'reason', 'problem', 'check'].includes(key)) return translateDetailCode(value);
    if (key === 'improvement') return ({ darken: 'сделать текст темнее', lighten: 'сделать текст светлее', error: 'не удалось подобрать улучшение' })[value] || String(value);
    return String(value);
  }

  function translateDetailCode(value) {
    return ({
      'required-field-without-instruction': 'обязательное поле без инструкции',
      'broken-aria-describedby': 'aria-describedby ссылается на несуществующий элемент',
      'broken-aria-errormessage': 'aria-errormessage ссылается на несуществующий элемент',
      'visual-error-without-aria-invalid': 'визуальная ошибка без aria-invalid',
      'invalid-field-without-error-description': 'ошибочное поле без связанного описания ошибки',
      'invalid-field-without-correction-suggestion': 'ошибочное поле без подсказки по исправлению',
      'input-constraint-without-instruction': 'ограничение ввода без инструкции',
      'unassociated-error-message': 'текст ошибки не связан с полем',
      'native-title-tooltip': 'нативная подсказка title',
      'not-hoverable': 'контент недоступен при наведении',
      'no-visible-dismiss': 'нет видимого способа закрытия',
      'hover-only-trigger': 'триггер доступен только при наведении',
      'controlled-popup-not-hoverable': 'связанный всплывающий контент недоступен при наведении',
      'positive-tabindex': 'положительный tabindex',
      'focus-moves-to-earlier-visual-row': 'фокус переходит на визуально более раннюю строку',
      'focus-moves-backward-on-same-row': 'фокус движется назад в той же визуальной строке',
      'potential-focus-trap-without-exit': 'возможная клавиатурная ловушка без выхода',
      'tab-boundary-cancelled-without-exit': 'Tab перехватывается на границе без выхода',
      'element-cancels-tab-both-directions': 'элемент перехватывает Tab и Shift+Tab',
      'visible-label-not-in-accessible-name': 'видимая метка не входит в доступное имя',
      'invalid-aria-live': 'недопустимое значение aria-live',
      'invalid-aria-atomic': 'недопустимое значение aria-atomic',
      'alert-live-off': 'role="alert" отключён через aria-live="off"',
      'status-live-off': 'role="status" отключён через aria-live="off"',
      'live-region-aria-hidden': 'динамическая область скрыта от вспомогательных технологий',
      'empty-hidden-live-region': 'пустая скрытая динамическая область',
      'error-message-not-assertive': 'ошибка не объявляется в assertive-режиме',
      'status-message-without-live-region': 'статусное сообщение без динамической области',
      'unannounced-status-container': 'статусный контейнер не объявляется вспомогательными технологиями',
      'empty-id': 'пустой id',
      'id-contains-whitespace': 'id содержит пробельные символы',
      'duplicate-id': 'дублирующийся id',
      'empty-id-reference': 'пустая ссылка на id',
      'single-id-reference-has-multiple-values': 'атрибут должен ссылаться только на один id',
      'broken-aria-id-reference': 'ARIA-атрибут ссылается на несуществующий id',
      'broken-label-for-reference': 'label[for] ссылается на несуществующий id',
      'broken-list-reference': 'атрибут list ссылается на несуществующий datalist',
      'broken-table-headers-reference': 'атрибут headers ссылается на несуществующий заголовок',
      'broken-fragment-reference': 'якорная ссылка ведёт на несуществующий id',
      'empty-aria-current': 'пустой aria-current',
      'invalid-aria-current': 'нестандартное значение aria-current',
      'active-navigation-item-without-aria-current': 'активный пункт навигации без aria-current',
      'aria-selected-used-instead-of-aria-current': 'aria-selected используется вместо aria-current',
      'different-language-without-lang': 'фрагмент на другом языке без lang'
    })[value] || String(value);
  }

  function translateDetailKey(key) {
    return ({
      criterion: 'Критерий',
      issue: 'Проблема',
      expected: 'Ожидаемое исправление',
      currentAutocomplete: 'Текущее значение autocomplete',
      expectedAutocomplete: 'Ожидаемое значение autocomplete',
      fieldText: 'Текст поля',
      accessibleName: 'Доступное имя',
      describedByText: 'Текст aria-describedby',
      ariaDescribedBy: 'Значение aria-describedby',
      ariaErrorMessage: 'Значение aria-errormessage',
      missingIds: 'Отсутствующие id',
      missingId: 'Отсутствующий id',
      attribute: 'Атрибут',
      value: 'Значение',
      currentValue: 'Текущее значение',
      allowedValues: 'Допустимые значения',
      activeHint: 'Признак активного пункта',
      href: 'Адрес ссылки',
      role: 'Роль',
      ariaLive: 'Значение aria-live',
      ariaAtomic: 'Значение aria-atomic',
      ariaHidden: 'Значение aria-hidden',
      selector: 'Селектор',
      text: 'Текст',
      sample: 'Фрагмент текста',
      pageLang: 'Язык страницы',
      detectedLang: 'Определённый язык',
      detectedIso3: 'Код языка ISO 639-3',
      confidence: 'Уверенность определения',
      alternatives: 'Альтернативы',
      tabIndex: 'Значение tabindex',
      previousElement: 'Предыдущий элемент',
      currentElement: 'Текущий элемент',
      previousRect: 'Область предыдущего элемента',
      currentRect: 'Область текущего элемента',
      visibleLabel: 'Видимая метка',
      accessibleLabel: 'Доступная метка',
      controlColor: 'Цвет элемента управления',
      borderColor: 'Цвет границы',
      outlineColor: 'Цвет обводки',
      shadowColor: 'Цвет тени',
      graphicColor: 'Цвет графики',
      backgroundColor: 'Цвет фона',
      textColor: 'Цвет текста',
      ratio: 'Контраст',
      requiredRatio: 'Требуемый контраст',
      fontSize: 'Размер шрифта',
      fontWeight: 'Насыщенность шрифта',
      detectedErrorText: 'Найдённый текст ошибки',
      linkedErrorText: 'Связанный текст ошибки',
      constraints: 'Ограничения ввода',
      scrollWidth: 'Ширина прокрутки',
      clientWidth: 'Видимая ширина',
      scrollHeight: 'Высота прокрутки',
      clientHeight: 'Видимая высота'
    })[key] || key;
  }

  function getGuideLinks(issue) {
    return typeof DokaGuideLinks !== 'undefined' && typeof DokaGuideLinks.getLinks === 'function'
      ? DokaGuideLinks.getLinks(issue)
      : [];
  }

  function formatGuideLinksHtml(issue) {
    const links = getGuideLinks(issue);
    if (!links.length) return '';
    return `<div class="issue-guide-links"><strong>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:</strong><ul>${links.map(link => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.title)}</a></li>`).join('')}</ul></div>`;
  }

  function formatGuideLinksText(issue) {
    const links = getGuideLinks(issue);
    if (!links.length) return '';
    return '   \u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:\n' + links.map(link => `   - ${link.title}: ${link.url}\n`).join('');
  }

  function formatGuideLinksMarkdown(issue) {
    const links = getGuideLinks(issue);
    if (!links.length) return '';
    return "\n**\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:**\n" + links.map(link => `- [${link.title}](${link.url})\n`).join('');
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
      'language-parts': 'язык частей контента',
      headings: 'заголовки',
      forms: 'формы',
      contrast: 'контраст',
      aria: 'ARIA',
      keyboard: 'клавиатура',
      semantics: 'семантика',
      navigation: 'навигация',
      links: 'ссылки',
      interactive: 'интерактивные элементы',
      syntax: 'синтаксис',
      'page-title': 'заголовок страницы',
      'non-text-contrast': 'контраст нетекстовой информации',
      'text-spacing': 'интервалы текста',
      'hover-focus-content': 'контент при наведении и фокусе',
      'focus-order': 'порядок фокуса',
      'keyboard-traps': 'клавиатурные ловушки',
      'label-in-name': 'метка в названии',
      'status-messages': 'статусные сообщения',
      'form-assistance': 'помощь при вводе',
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
