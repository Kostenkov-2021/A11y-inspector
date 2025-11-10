class ReportGenerator {
  generate(data, format) {
    switch (format) {
      case 'json':
        return this.generateJSON(data);
      case 'html':
        return this.generateHTML(data);
      case 'csv':
        return this.generateCSV(data);
      case 'markdown':
        return this.generateMarkdown(data);
      default:
        return this.generateJSON(data);
    }
  }

  generateJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  generateHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Accessibility Report - ${data.url}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .issue { margin: 10px 0; padding: 10px; border-left: 4px solid; }
    .error { border-color: #d32f2f; background: #ffebee; }
    .warning { border-color: #ff9800; background: #fff3e0; }
    .category { font-weight: bold; color: #666; }
  </style>
</head>
<body>
  <h1>Accessibility Report</h1>
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>URL:</strong> ${data.url}</p>
    <p><strong>Date:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
    <p><strong>Total Issues:</strong> ${data.summary.total}</p>
    <p><strong>Errors:</strong> ${data.summary.errors}</p>
    <p><strong>Warnings:</strong> ${data.summary.warnings}</p>
  </div>
  
  <h2>Issues</h2>
  ${data.issues.map(issue => `
    <div class="issue ${issue.type}">
      <div class="category">${issue.category.toUpperCase()}</div>
      <div><strong>${issue.type.toUpperCase()}:</strong> ${issue.message}</div>
      ${issue.selector ? `<div><strong>Selector:</strong> ${issue.selector}</div>` : ''}
      ${issue.element ? `<div><strong>Element:</strong> <code>${issue.element}</code></div>` : ''}
    </div>
  `).join('')}
</body>
</html>`;
  }

  generateCSV(data) {
    const headers = ['Type', 'Category', 'Message', 'Selector', 'Element'];
    const rows = data.issues.map(issue => [
      issue.type,
      issue.category,
      `"${issue.message.replace(/"/g, '""')}"`,
      issue.selector || '',
      `"${(issue.element || '').replace(/"/g, '""')}"`
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  generateMarkdown(data) {
    return `# Accessibility Report

## Summary
- **URL**: ${data.url}
- **Date**: ${new Date(data.timestamp).toLocaleString()}
- **Total Issues**: ${data.summary.total}
- **Errors**: ${data.summary.errors}
- **Warnings**: ${data.summary.warnings}

## Issues

${data.issues.map(issue => `
### ${issue.type.toUpperCase()} - ${issue.category}
**Message**: ${issue.message}
${issue.selector ? `**Selector**: \`${issue.selector}\`` : ''}
${issue.element ? `**Element**: \`${issue.element}\`` : ''}
`).join('\n')}`;
  }
}