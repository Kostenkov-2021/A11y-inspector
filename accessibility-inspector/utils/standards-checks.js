(function(root) {
  'use strict';

  // Run only the rules owned by this module to avoid duplicate legacy checks.
  const RULES = [
    'aria-allowed-attr', 'aria-braille-equivalent', 'aria-command-name',
    'aria-conditional-attr', 'aria-deprecated-role', 'aria-hidden-body',
    'aria-hidden-focus', 'aria-input-field-name', 'aria-meter-name',
    'aria-progressbar-name', 'aria-prohibited-attr', 'aria-required-attr',
    'aria-required-children', 'aria-required-parent', 'aria-roledescription',
    'aria-roles', 'aria-toggle-field-name', 'aria-tooltip-name',
    'aria-valid-attr-value', 'aria-valid-attr', 'autocomplete-valid',
    'button-name', 'form-field-multiple-labels', 'frame-title',
    'html-has-lang', 'html-lang-valid', 'html-xml-lang-mismatch',
    'image-alt', 'input-image-alt', 'label', 'label-content-name-mismatch',
    'link-name', 'object-alt', 'select-name', 'svg-img-alt',
    'table-fake-caption', 'td-has-header', 'td-headers-attr',
    'th-has-data-cells', 'valid-lang', 'target-size'
  ];

  function getCategory(result) {
    const tags = result.tags || [];
    if (result.id === 'target-size') return 'interactive';
    if (result.id === 'label-content-name-mismatch') return 'label-in-name';
    if (tags.includes('cat.language')) return result.id === 'valid-lang' ? 'language-parts' : 'language';
    if (tags.includes('cat.tables')) return 'semantics';
    if (tags.includes('cat.forms')) return 'forms';
    if (tags.includes('cat.text-alternatives')) return 'images';
    if (result.id === 'link-name') return 'links';
    return 'aria';
  }

  function getCriteria(tags) {
    return tags.filter(tag => /^wcag\d{3,4}$/.test(tag)).map(tag => {
      const number = tag.slice(4);
      return `${number[0]}.${number[1]}.${number.slice(2)}`;
    });
  }

  function createIssue(result, node, needsReview) {
    const criteria = getCriteria(result.tags || []);
    const standards = ['WCAG 2.2'];
    if (!result.tags.includes('wcag22aa')) standards.push('ГОСТ Р 52872-2019');

    return {
      type: needsReview ? 'warning' : 'error',
      outcome: needsReview ? 'incomplete' : 'violation',
      category: getCategory(result),
      message: (needsReview ? 'Требуется ручная проверка: ' : '') + result.help,
      element: node.element ? node.element.outerHTML : node.html,
      selector: JSON.stringify(node.target),
      details: {
        criterion: criteria[0] || null,
        'Критерии WCAG': criteria,
        'Стандарты': standards,
        'Правило': result.id,
        'Результат': needsReview ? 'Требуется ручная проверка' : 'Обнаружено нарушение',
        'Подробности проверки': node.failureSummary || 'Проверьте элемент и применимые исключения критерия',
        'Источник проверки': `axe-core ${root.axe.version}`
      }
    };
  }

  async function run() {
    if (!root.axe || !root.A11yAxeLocale) {
      throw new Error('Локальные модули стандартных проверок не загружены');
    }

    root.axe.configure({ locale: root.A11yAxeLocale });
    const result = await root.axe.run(document, {
      runOnly: { type: 'rule', values: RULES },
      rules: Object.fromEntries(RULES.map(id => [id, { enabled: true }])),
      iframes: false,
      elementRef: true
    });

    const issues = [];
    result.violations.forEach(rule => {
      rule.nodes.forEach(node => issues.push(createIssue(rule, node, false)));
    });
    result.incomplete.forEach(rule => {
      rule.nodes.forEach(node => issues.push(createIssue(rule, node, true)));
    });

    return {
      issues,
      coverage: {
        engine: `axe-core ${root.axe.version}`,
        rules: RULES.slice(),
        ruleCriteria: Object.fromEntries([...result.violations, ...result.incomplete, ...result.passes, ...result.inapplicable].map(rule => [rule.id, getCriteria(rule.tags || [])])),
        passedRules: result.passes.map(rule => rule.id),
        inapplicableRules: result.inapplicable.map(rule => rule.id),
        incompleteRules: result.incomplete.map(rule => rule.id),
        scope: 'Основной документ и открытые Shadow DOM; содержимое iframe не проверяется'
      }
    };
  }

  root.A11yStandardsChecks = { run };
})(typeof globalThis !== 'undefined' ? globalThis : window);
