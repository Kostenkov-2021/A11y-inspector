(function(root) {
  'use strict';

  const PROFILES = {
    combined: ['WCAG 2.2', 'ГОСТ Р 52872-2019'],
    wcag22: ['WCAG 2.2'],
    gost2019: ['ГОСТ Р 52872-2019']
  };
  const WCAG22_ONLY = new Set(['2.4.11', '2.4.12', '2.4.13', '2.5.7', '2.5.8', '3.2.6', '3.3.7', '3.3.8', '3.3.9']);
  const AAA = new Set(['1.4.6', '2.4.12', '2.4.13', '3.3.9']);
  const CATEGORY_CRITERIA = { contrast: '1.4.3', images: '1.1.1', 'non-text-contrast': '1.4.11', 'text-spacing': '1.4.12', 'language-parts': '3.1.2', language: '3.1.1' };

  function normalize(report, options = {}) {
    const profile = Object.hasOwn(PROFILES, options.profile) ? options.profile : (report.profile || 'combined');
    const selected = PROFILES[profile] || PROFILES.combined;
    const level = (options.level || report.level) === 'AAA' ? 'AAA' : 'AA';
    const excluded = [...(report.coverage?.excluded || [])];
    const notTested = [...(report.coverage?.notTested || [])];
    const issues = [];
    for (const original of report.issues || []) {
      const details = { ...(original.details || {}) };
      const criterion = details.criterion || CATEGORY_CRITERIA[original.category] || null;
      if (original.assessment === 'manual') {
        notTested.push({ criterion, outcome: 'not-tested', reason: 'Только ручная проверка; автоматическое наблюдение отсутствует' });
        continue;
      }
      if (original.outcome === 'not-tested') {
        notTested.push({ criterion, selector: original.selector, outcome: 'not-tested', reason: details['Причина'] || original.message });
        continue;
      }
      let criteria = [...new Set([...(details['Критерии WCAG'] || []), ...(details['Критерии ГОСТ'] || []), ...(criterion ? [criterion] : [])])];
      if (level === 'AA') criteria = criteria.filter(item => !AAA.has(item));
      const standards = criterion ? selected.filter(standard =>
        standard === 'WCAG 2.2' ? criteria.some(item => item !== '4.1.1') : criteria.some(item => !WCAG22_ONLY.has(item))) : [];
      if (criterion && (!criteria.length || !standards.length)) {
        if (!excluded.some(item => item.criterion === criterion)) excluded.push({ criterion, outcome: 'not-tested', reason: 'Вне выбранного профиля' });
        continue;
      }
      const outcome = original.outcome === 'violation' ? 'violation' : 'incomplete';
      const assessment = original.category === 'system' ? 'diagnostic' : outcome === 'violation' ? 'automatic' : 'assisted';
      details.criterion = criterion;
      details['Критерии WCAG'] = standards.includes('WCAG 2.2') ? criteria.filter(item => item !== '4.1.1') : [];
      details['Критерии ГОСТ'] = standards.includes('ГОСТ Р 52872-2019') ? criteria.filter(item => !WCAG22_ONLY.has(item)) : [];
      details['Стандарты'] = standards;
      details['Результат'] = outcome === 'violation' ? 'Обнаружено нарушение' : 'Требуется ручная проверка';
      details['Способ проверки'] = assessment === 'diagnostic' ? 'Диагностика выполнения' : assessment === 'automatic' ? 'Автоматическая проверка' : 'Автоматическая проверка с ручным подтверждением';
      issues.push({ ...original, type: outcome === 'violation' ? 'error' : 'warning', outcome, assessment, details });
    }
    const coverage = { ...(report.coverage || {}), excluded, notTested };
    coverage.profile = { standards: selected, level };
    coverage.policy = { includedAssessments: ['automatic', 'assisted'], manualOnlyIncluded: false };
    coverage.status = coverage.status === 'incomplete' || (coverage.limits || []).some(record => record.truncated) ||
      coverage.scenarios?.status === 'incomplete' || coverage.workflow?.status === 'incomplete' || notTested.length ||
      issues.some(issue => issue.category === 'system') ? 'incomplete' : 'completed';
    coverage.results = [
      ...(coverage.rules || []).map(rule => ({ rule, outcome:
        (coverage.ruleCriteria?.[rule] || []).length && !(coverage.ruleCriteria[rule]).some(item =>
          (level === 'AAA' || !AAA.has(item)) && (selected.includes('WCAG 2.2') && item !== '4.1.1' || selected.includes('ГОСТ Р 52872-2019') && !WCAG22_ONLY.has(item))) ? 'not-tested' :
        issues.some(issue => issue.details['Правило'] === rule && issue.outcome === 'violation') ? 'violation' :
        (coverage.incompleteRules || []).includes(rule) ? 'incomplete' :
        (coverage.passedRules || []).includes(rule) ? 'passed' :
        (coverage.inapplicableRules || []).includes(rule) ? 'inapplicable' : 'not-tested' })),
      ...excluded, ...notTested
    ];
    coverage.limitations = [
      'Ручные проверки без автоматически полученного признака в набор не включаются',
      'Количественные лимиты записаны в coverage.limits; старые эвристики также ограничены viewport',
      'Пройденный технический тест не подтверждает соответствие критерию целиком'
    ];
    return { ...report, profile, level, issues, coverage, summary: {
      total: issues.length, errors: issues.filter(issue => issue.type === 'error').length,
      warnings: issues.filter(issue => issue.type === 'warning').length
    } };
  }

  root.A11yAuditResults = { normalize, profiles: PROFILES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.A11yAuditResults;
})(typeof globalThis !== 'undefined' ? globalThis : window);
