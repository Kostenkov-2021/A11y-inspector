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
      return `Error generating ${format} report: ${error.message}`;
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report - ${this.escapeHtml(data.url || 'Unknown URL')}</title>
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
      <h1>Accessibility Report</h1>
      <div class="summary">
        <h2>Summary</h2>
        <p><strong>URL:</strong> ${this.escapeHtml(data.url || 'Unknown')}</p>
        <p><strong>Date:</strong> ${new Date(data.timestamp || Date.now()).toLocaleString()}</p>
        
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-number total">${summary.total}</span>
            <span>Total Issues</span>
          </div>
          <div class="stat">
            <span class="stat-number errors">${summary.errors}</span>
            <span>Errors</span>
          </div>
          <div class="stat">
            <span class="stat-number warnings">${summary.warnings}</span>
            <span>Warnings</span>
          </div>
        </div>
      </div>
    </div>
    
    <h2>Issues</h2>
    ${issues.length === 0 ? 
      '<div class="no-issues">✅ No accessibility issues found!</div>' : 
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
        <div class="category">${this.escapeHtml(issue.category || 'general')}</div>
        <div class="issue-type">${issue.type.toUpperCase()}</div>
      </div>
      <div><strong>${this.escapeHtml(issue.message || 'No message')}</strong></div>
      ${issue.selector ? `<div class="selector"><strong>Selector:</strong> ${this.escapeHtml(issue.selector)}</div>` : ''}
      ${issue.element ? `<div class="element"><strong>Element:</strong> ${this.escapeHtml(issue.element)}</div>` : ''}
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
        <strong>Contrast Details:</strong><br>
        <strong>Ratio:</strong> ${details.ratio}:1 (required: ${details.requiredRatio || 'N/A'}:1)<br>
        ${details.fontSize ? `<strong>Font Size:</strong> ${details.fontSize}` : ''}
        ${details.fontWeight ? `<strong>Font Weight:</strong> ${details.fontWeight}` : ''}
        ${details.textColor ? `<strong>Text Color:</strong> ${details.textColor}` : ''}
        ${details.backgroundColor ? `<strong>Background Color:</strong> ${details.backgroundColor}` : ''}
        ${details.suggestions ? this.generateSuggestionsHTML(details.suggestions) : ''}
      </div>`;
    }
    
    // General details
    return `
    <div class="details">
      <strong>Details:</strong><br>
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
    
    return `<br><strong>Suggestions:</strong> ${suggestions.improvement === 'darken' ? 'Darken' : 'Lighten'} text color<br>
            <strong>Current:</strong> ${suggestions.current} (${suggestions.currentRatio.toFixed(2)}:1)<br>
            <strong>Suggested:</strong> ${suggestions.suggested} (${suggestions.suggestedRatio.toFixed(2)}:1)`;
  }

  /**
   * Generate text format report
   * @param {Object} data - Accessibility check data
   * @returns {string} Text report
   */
  generateText(data) {
    const issues = data.issues || [];
    const summary = data.summary || { total: 0, errors: 0, warnings: 0 };
    
    let text = 'ACCESSIBILITY REPORT\n';
    text += '===================\n\n';
    
    text += `URL: ${data.url || 'Unknown'}\n`;
    text += `Date: ${new Date(data.timestamp || Date.now()).toLocaleString()}\n\n`;
    
    text += 'SUMMARY:\n';
    text += `- Total Issues: ${summary.total}\n`;
    text += `- Errors: ${summary.errors}\n`;
    text += `- Warnings: ${summary.warnings}\n\n`;
    
    if (issues.length === 0) {
      text += '✅ No accessibility issues found!\n';
    } else {
      text += 'ISSUES:\n\n';
      
      issues.forEach((issue, index) => {
        const typeLabel = issue.type === 'error' ? 'ERROR' : 'WARNING';
        text += `${index + 1}. [${typeLabel}] ${issue.category || 'general'}\n`;
        text += `   Message: ${issue.message || 'No message'}\n`;
        
        if (issue.selector) {
          text += `   Selector: ${issue.selector}\n`;
        }
        
        if (issue.details) {
          text += `   Details: ${JSON.stringify(issue.details, null, 2)}\n`;
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
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportGenerator;
} else {
  window.ReportGenerator = ReportGenerator;
}