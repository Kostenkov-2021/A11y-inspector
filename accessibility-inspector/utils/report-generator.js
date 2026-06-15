/**
 * Report generator for accessibility check results
 * Supports multiple output formats: JSON, HTML, and Text
 */

class ReportGenerator {
  /**
   * Generate report in specified format
   * @param {Object} data - Accessibility check data
   * @param {string} format - Output format (json, html, text)
   * @returns {string} Formatted report
   */
  generate(data, format) {
    try {
      switch (format) {
        case 'markdown':
          return this.generateJSON(data);
        case 'json':
          return this.generateJSON(data);
        case 'html':
          return this.generateHTML(data);
        case 'text':
          return this.generateText(data);
        default:
          return this.generateJSON(data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      return `Ошибка формирования отчёта в формате ${format}: ${error.message}`;
    }
  }

  /**
   * Generate JSON format report
   * @param {Object} data - Accessibility check data
   * @returns {string} JSON string
   */
  generateJSON(data) {
    return JSON.stringify(this.enrichWithGuideLinks(data), null, 2);
  }

  enrichWithGuideLinks(data) {
    if (!data || !Array.isArray(data.issues)) return data;
    return {
      ...data,
      issues: data.issues.map(issue => ({
        ...issue,
        guideLinks: this.getGuideLinks(issue)
      }))
    };
  }

  /**
   * Generate HTML format report
   * @param {Object} data - Accessibility check data
   * @returns {string} HTML report
   */
  generateHTML(data) {
    const issues = data.issues || [];
    const summary = data.summary || { total: 0, errors: 0, warnings: 0 };
    
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Отчёт о доступности - ${this.escapeHtml(data.url || 'неизвестный URL')}</title>
  <style>
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      margin: 0; 
      padding: 20px; 
      background: #f8f9fa;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      border-bottom: 2px solid #1a73e8;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .summary { 
      background: #e8f0fe; 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 30px;
      border-left: 4px solid #1a73e8;
    }
    .summary-stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }
    .stat {
      text-align: center;
      flex: 1;
    }
    .stat-number {
      display: block;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .stat-number.total { color: #1a73e8; }
    .stat-number.errors { color: #d93025; }
    .stat-number.warnings { color: #f9ab00; }
    .issue { 
      margin: 15px 0; 
      padding: 15px; 
      border-left: 4px solid; 
      border-radius: 6px;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .error { 
      border-left-color: #d32f2f; 
      background: #ffebee; 
    }
    .warning { 
      border-left-color: #ff9800; 
      background: #fff3e0; 
    }
    .category { 
      font-weight: bold; 
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .issue-type {
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8em;
    }
    .error .issue-type { background: #d32f2f; color: white; }
    .warning .issue-type { background: #ff9800; color: white; }
    .details {
      margin-top: 10px;
      padding: 10px;
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
      font-size: 0.9em;
    }
    .guide-links {
      margin-top: 10px;
      padding: 10px;
      background: rgba(26,115,232,0.08);
      border-radius: 4px;
      font-size: 0.9em;
    }
    .guide-links ul {
      margin: 6px 0 0;
      padding-left: 20px;
    }
    .guide-links a {
      color: #174ea6;
    }
    .selector {
      font-family: 'Consolas', 'Monaco', monospace;
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      margin: 5px 0;
    }
    .element {
      font-family: 'Consolas', 'Monaco', monospace;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 4px;
      margin: 5px 0;
      overflow-x: auto;
      font-size: 0.85em;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .no-issues {
      text-align: center;
      padding: 40px;
      color: #137333;
      background: #e6f4ea;
      border-radius: 8px;
      font-size: 1.1em;
    }
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 15px; }
      .summary-stats { flex-direction: column; gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Отчёт о доступности</h1>
      <div class="summary">
        <h2>Сводка</h2>
        <p><strong>URL:</strong> ${this.escapeHtml(data.url || 'неизвестно')}</p>
        <p><strong>Дата:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString('ru-RU')}</p>
        
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-number total">${summary.total}</span>
            <span>Всего проблем</span>
          </div>
          <div class="stat">
            <span class="stat-number errors">${summary.errors}</span>
            <span>Ошибок</span>
          </div>
          <div class="stat">
            <span class="stat-number warnings">${summary.warnings}</span>
            <span>Предупреждений</span>
          </div>
        </div>
      </div>
    </div>
    
    <h2>Проблемы</h2>
    ${issues.length === 0 ? 
      '<div class="no-issues">✅ Проблемы доступности не найдены!</div>' : 
      issues.map(issue => this.generateIssueHTML(issue)).join('')
    }
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for individual issue
   * @param {Object} issue - Issue data
   * @returns {string} HTML for the issue
   */
  generateIssueHTML(issue) {
    return `
    <div class="issue ${issue.type}">
      <div class="issue-header">
        <div class="category">${this.escapeHtml(this.translateCategory(issue.category))}</div>
        <div class="issue-type">${this.escapeHtml(this.translateIssueType(issue.type).toUpperCase())}</div>
      </div>
      <div><strong>${this.escapeHtml(issue.message || 'Нет сообщения')}</strong></div>
      ${issue.selector ? `<div class="selector"><strong>Селектор:</strong> ${this.escapeHtml(issue.selector)}</div>` : ''}
      ${issue.element ? `<strong>Элемент:</strong><pre class="element"><code>${this.escapeHtml(issue.element)}</code></pre>` : ''}
      ${issue.details ? this.generateDetailsHTML(issue.details) : ''}
      ${this.generateGuideLinksHTML(issue)}
    </div>`;
  }

  generateGuideLinksHTML(issue) {
    const links = this.getGuideLinks(issue);
    if (!links.length) return '';

    return `
      <div class="guide-links">
        <strong>\u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:</strong>
        <ul>
          ${links.map(link => `<li><a href="${this.escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(link.title)}</a></li>`).join('')}
        </ul>
      </div>`;
  }

  /**
   * Generate HTML for issue details
   * @param {Object} details - Issue details
   * @returns {string} HTML for details
   */
  generateDetailsHTML(details) {
    if (details.ratio) {
      // Contrast details
      return `
      <div class="details">
        <strong>Параметры контраста:</strong><br>
        <strong>Контраст:</strong> ${details.ratio}:1 (требуется: ${details.requiredRatio || 'н/д'}:1)<br>
        ${details.fontSize ? `<strong>Размер шрифта:</strong> ${details.fontSize}` : ''}
        ${details.fontWeight ? `<strong>Насыщенность шрифта:</strong> ${details.fontWeight}` : ''}
        ${details.textColor ? `<strong>Цвет текста:</strong> ${details.textColor}` : ''}
        ${details.backgroundColor ? `<strong>Цвет фона:</strong> ${details.backgroundColor}` : ''}
        ${details.suggestions ? this.generateSuggestionsHTML(details.suggestions) : ''}
      </div>`;
    }
    
    return `
    <div class="details">
      <strong>Подробности:</strong><br>
      ${this.generateDetailsListHTML(details)}
    </div>`;
  }

  generateDetailsListHTML(details) {
    const entries = Object.entries(details || {});
    if (!entries.length) return '<span>Дополнительные сведения отсутствуют</span>';

    return `<dl>${entries.map(([key, value]) => `
      <dt><strong>${this.escapeHtml(this.translateDetailKey(key))}:</strong></dt>
      <dd>${this.escapeHtml(this.formatDetailValue(value, key))}</dd>
    `).join('')}</dl>`;
  }

  /**
   * Generate HTML for contrast suggestions
   * @param {Object} suggestions - Contrast improvement suggestions
   * @returns {string} HTML for suggestions
   */
  generateSuggestionsHTML(suggestions) {
    if (!suggestions || suggestions.improvement === 'error') return '';
    
    return `<br><strong>Рекомендации:</strong> ${suggestions.improvement === 'darken' ? 'Сделать текст темнее' : 'Сделать текст светлее'}<br>
            <strong>Текущий цвет:</strong> ${suggestions.current} (${suggestions.currentRatio.toFixed(2)}:1)<br>
            <strong>Предлагаемый цвет:</strong> ${suggestions.suggested} (${suggestions.suggestedRatio.toFixed(2)}:1)`;
  }

  /**
   * Generate text format report
   * @param {Object} data - Accessibility check data
   * @returns {string} Text report
   */
  generateText(data) {
    const issues = data.issues || [];
    const summary = data.summary || { total: 0, errors: 0, warnings: 0 };
    
    let text = 'ОТЧЁТ О ДОСТУПНОСТИ\n';
    text += '===================\n\n';
    
    text += `URL: ${data.url || 'неизвестно'}\n`;
    text += `Дата: ${new Date(data.timestamp || Date.now()).toLocaleString('ru-RU')}\n\n`;
    
    text += 'СВОДКА:\n';
    text += `- Всего проблем: ${summary.total}\n`;
    text += `- Ошибок: ${summary.errors}\n`;
    text += `- Предупреждений: ${summary.warnings}\n\n`;
    
    if (issues.length === 0) {
      text += '✅ Проблемы доступности не найдены!\n';
    } else {
      text += 'ПРОБЛЕМЫ:\n\n';
      
      issues.forEach((issue, index) => {
        const typeLabel = issue.type === 'error' ? 'ОШИБКА' : 'ПРЕДУПРЕЖДЕНИЕ';
        text += `${index + 1}. [${typeLabel}] ${this.translateCategory(issue.category)}\n`;
        text += `   Сообщение: ${issue.message || 'Нет сообщения'}\n`;
        
        if (issue.selector) {
          text += `   Селектор: ${issue.selector}\n`;
        }

        if (issue.element) {
          text += `   Код элемента:\n${issue.element}\n`;
        }
        
        if (issue.details) {
          text += this.formatDetailsText(issue.details, '   ');
        }

        const guideLinks = this.getGuideLinks(issue);
        if (guideLinks.length) {
          text += '   \u041c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b Doka:\n';
          guideLinks.forEach(link => {
            text += `   - ${link.title}: ${link.url}\n`;
          });
        }
        
        text += '\n';
      });
    }
    
    return text;
  }

  /**
   * Escape HTML special characters
   * @param {string} unsafe - Unsafe string
   * @returns {string} Escaped string
   */
  escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    
    return unsafe.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getGuideLinks(issue) {
    const guide = typeof DokaGuideLinks !== 'undefined' ? DokaGuideLinks : null;
    return guide && typeof guide.getLinks === 'function' ? guide.getLinks(issue) : [];
  }

  translateIssueType(type) {
    return ({ error: 'ошибка', warning: 'предупреждение' })[type] || (type || 'не указано');
  }

  translateCategory(category) {
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

  formatDetailsText(details, indent = '') {
    const entries = Object.entries(details || {});
    if (!entries.length) return `${indent}Подробности: дополнительные сведения отсутствуют\n`;

    let text = `${indent}Подробности:\n`;
    entries.forEach(([key, value]) => {
      text += `${indent}- ${this.translateDetailKey(key)}: ${this.formatDetailValue(value, key)}\n`;
    });
    return text;
  }

  formatDetailValue(value, key = '') {
    if (value === null || value === undefined || value === '') return 'не указано';
    if (Array.isArray(value)) {
      if (!value.length) return 'нет данных';
      return value.map(item => this.formatDetailValue(item, key)).join('; ');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([itemKey, itemValue]) => `${this.translateDetailKey(itemKey)}: ${this.formatDetailValue(itemValue, itemKey)}`)
        .join('; ');
    }
    if (typeof value === 'boolean') return value ? 'да' : 'нет';
    if (['issue', 'reason', 'problem', 'check'].includes(key)) {
      return this.translateDetailCode(value);
    }
    if (key === 'improvement') {
      return ({ darken: 'сделать текст темнее', lighten: 'сделать текст светлее', error: 'не удалось подобрать улучшение' })[value] || String(value);
    }
    return String(value);
  }

  translateDetailCode(value) {
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
      'alert-live-off': 'role=\"alert\" отключён через aria-live=\"off\"',
      'status-live-off': 'role=\"status\" отключён через aria-live=\"off\"',
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

  translateDetailKey(key) {
    return ({
      criterion: 'Критерий',
      issue: 'Проблема',
      check: 'Проверка',
      reason: 'Причина',
      problem: 'Проблема',
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
      requiredAARatio: 'Требуемый контраст AA',
      requiredAAARatio: 'Требуемый контраст AAA',
      fontSize: 'Размер шрифта',
      fontWeight: 'Насыщенность шрифта',
      suggestions: 'Рекомендации',
      current: 'Текущее значение',
      currentHex: 'Текущий HEX',
      currentRatio: 'Текущий контраст',
      suggested: 'Предлагаемое значение',
      suggestedHex: 'Предлагаемый HEX',
      suggestedRatio: 'Предлагаемый контраст',
      improvement: 'Улучшение',
      score: 'Оценка',
      detectedErrorText: 'Найдённый текст ошибки',
      linkedErrorText: 'Связанный текст ошибки',
      constraints: 'Ограничения ввода',
      scrollWidth: 'Ширина прокрутки',
      clientWidth: 'Видимая ширина',
      scrollHeight: 'Высота прокрутки',
      clientHeight: 'Видимая высота'
    })[key] || key;
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportGenerator;
} else {
  window.ReportGenerator = ReportGenerator;
}
