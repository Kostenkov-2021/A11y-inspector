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
    return JSON.stringify(data, null, 2);
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
      ${issue.element ? `<div class="element"><strong>Элемент:</strong> ${this.escapeHtml(issue.element)}</div>` : ''}
      ${issue.details ? this.generateDetailsHTML(issue.details) : ''}
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
    
    // General details
    return `
    <div class="details">
      <strong>Подробности:</strong><br>
      <pre>${this.escapeHtml(JSON.stringify(details, null, 2))}</pre>
    </div>`;
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
        
        if (issue.details) {
          text += `   Подробности: ${JSON.stringify(issue.details, null, 2)}\n`;
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

  translateIssueType(type) {
    return ({ error: 'ошибка', warning: 'предупреждение' })[type] || (type || 'не указано');
  }

  translateCategory(category) {
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
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportGenerator;
} else {
  window.ReportGenerator = ReportGenerator;
}
