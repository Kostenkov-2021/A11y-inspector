(function(root) {
  'use strict';

  const ARTICLES = {
    a11y: ['\u0427\u0442\u043e \u0442\u0430\u043a\u043e\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c', 'https://doka.guide/a11y/chto-takoe-a11y/'],
    html: ['\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0439 HTML', 'https://doka.guide/a11y/a11y-html/'],
    css: ['\u0412\u043b\u0438\u044f\u043d\u0438\u0435 CSS \u043d\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c', 'https://doka.guide/a11y/css-impact-on-a11y/'],
    accessibleNames: ['\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0435 \u0438\u043c\u044f \u0438 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435', 'https://doka.guide/a11y/accessible-names-and-descs/'],
    siteLanguage: ['\u042f\u0437\u044b\u043a \u0441\u0430\u0439\u0442\u0430 \u0438 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0433\u043e', 'https://doka.guide/a11y/site-language/'],
    forms: ['\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u0444\u043e\u0440\u043c\u044b', 'https://doka.guide/a11y/accessible-forms/'],
    pictures: ['\u041a\u0430\u043a \u043e\u043f\u0438\u0441\u044b\u0432\u0430\u0442\u044c \u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0438', 'https://doka.guide/a11y/how-to-describe-pictures/'],
    ariaLabel: ['aria-label', 'https://doka.guide/a11y/aria-label/'],
    ariaLabelledby: ['aria-labelledby', 'https://doka.guide/a11y/aria-labelledby/'],
    ariaDescribedby: ['aria-describedby', 'https://doka.guide/a11y/aria-describedby/'],
    ariaControls: ['aria-controls', 'https://doka.guide/a11y/aria-controls/'],
    ariaActivedescendant: ['aria-activedescendant', 'https://doka.guide/a11y/aria-activedescendant/'],
    ariaInvalid: ['aria-invalid', 'https://doka.guide/a11y/aria-invalid/'],
    ariaErrormessage: ['aria-errormessage', 'https://doka.guide/a11y/aria-errormessage/'],
    ariaRequired: ['aria-required', 'https://doka.guide/a11y/aria-required/'],
    ariaExpanded: ['aria-expanded', 'https://doka.guide/a11y/aria-expanded/'],
    ariaCurrent: ['aria-current', 'https://doka.guide/a11y/aria-current/'],
    ariaLive: ['aria-live', 'https://doka.guide/a11y/aria-live/'],
    roleStatus: ['role="status"', 'https://doka.guide/a11y/role-status/'],
    roleAlert: ['role="alert"', 'https://doka.guide/a11y/role-alert/'],
    roleLog: ['role="log"', 'https://doka.guide/a11y/role-log/'],
    roleTooltip: ['role="tooltip"', 'https://doka.guide/a11y/role-tooltip/'],
    roleDialog: ['role="dialog"', 'https://doka.guide/a11y/role-dialog/'],
    ariaModal: ['aria-modal', 'https://doka.guide/a11y/aria-modal/'],
    roleButton: ['role="button"', 'https://doka.guide/a11y/role-button/'],
    roleLink: ['role="link"', 'https://doka.guide/a11y/role-link/'],
    roleHeading: ['role="heading"', 'https://doka.guide/a11y/role-heading/'],
    skipLink: ['Ссылка для пропуска навигации', 'https://doka.guide/a11y/skip-link/'],
    prefersContrast: ['prefers-contrast', 'https://doka.guide/a11y/prefers-contrast/'],
    forcedColors: ['forced-colors', 'https://doka.guide/a11y/forced-colors/']
  };

  const CATEGORY_ARTICLES = {
    images: ['pictures'],
    language: ['siteLanguage'],
    'language-parts': ['siteLanguage'],
    headings: ['roleHeading', 'html'],
    forms: ['forms', 'ariaRequired', 'ariaDescribedby'],
    'form-assistance': ['forms', 'ariaInvalid', 'ariaErrormessage'],
    contrast: ['css', 'prefersContrast', 'forcedColors'],
    'non-text-contrast': ['css', 'prefersContrast', 'forcedColors'],
    'text-spacing': ['css'],
    aria: ['accessibleNames', 'ariaLabelledby', 'ariaDescribedby'],
    keyboard: ['html', 'roleButton'],
    'keyboard-traps': ['roleDialog', 'ariaModal', 'ariaExpanded'],
    'focus-order': ['html', 'skipLink'],
    semantics: ['html'],
    navigation: ['skipLink', 'ariaCurrent', 'html'],
    links: ['roleLink', 'accessibleNames'],
    interactive: ['roleButton', 'roleLink', 'accessibleNames'],
    syntax: ['html', 'ariaLabelledby', 'ariaDescribedby'],
    'page-title': ['html'],
    'hover-focus-content': ['roleTooltip', 'ariaExpanded'],
    'label-in-name': ['accessibleNames', 'ariaLabel', 'ariaLabelledby'],
    'status-messages': ['ariaLive', 'roleStatus', 'roleAlert'],
    system: ['a11y'],
    general: ['a11y']
  };

  const ISSUE_ARTICLES = {
    missingAlt: ['pictures'],
    emptyAlt: ['pictures'],
    suspiciousAlt: ['pictures'],
    missingLabel: ['forms', 'accessibleNames'],
    missingErrorAssociation: ['ariaDescribedby', 'ariaErrormessage'],
    invalidField: ['ariaInvalid', 'ariaErrormessage'],
    missingRequiredCue: ['forms', 'ariaRequired'],
    missingSkipLinks: ['skipLink'],
    emptyAriaCurrent: ['ariaCurrent'],
    'empty-aria-current': ['ariaCurrent'],
    invalidAriaCurrent: ['ariaCurrent'],
    'invalid-aria-current': ['ariaCurrent'],
    activeNavigationItemWithoutAriaCurrent: ['ariaCurrent'],
    'active-navigation-item-without-aria-current': ['ariaCurrent'],
    ariaSelectedUsedInsteadOfAriaCurrent: ['ariaCurrent'],
    'aria-selected-used-instead-of-aria-current': ['ariaCurrent'],
    genericLinkText: ['roleLink', 'accessibleNames'],
    buttonWithoutLabel: ['roleButton', 'accessibleNames'],
    missingAccessibleName: ['accessibleNames', 'ariaLabel'],
    missingLiveRegion: ['ariaLive', 'roleStatus'],
    aggressiveLiveRegion: ['ariaLive', 'roleAlert'],
    duplicateId: ['html'],
    brokenAriaReference: ['ariaLabelledby', 'ariaDescribedby'],
    focusTrap: ['roleDialog', 'ariaModal'],
    tooltipDismissal: ['roleTooltip']
  };

  const ATTRIBUTE_ARTICLES = {
    'aria-labelledby': 'ariaLabelledby',
    'aria-describedby': 'ariaDescribedby',
    'aria-errormessage': 'ariaErrormessage',
    'aria-controls': 'ariaControls',
    'aria-activedescendant': 'ariaActivedescendant',
    'aria-invalid': 'ariaInvalid',
    'aria-required': 'ariaRequired',
    'aria-expanded': 'ariaExpanded',
    'aria-current': 'ariaCurrent',
    'aria-live': 'ariaLive'
  };

  function article(key) {
    const value = ARTICLES[key];
    return value ? { title: value[0], url: value[1] } : null;
  }

  function addKey(result, seen, key) {
    const item = article(key);
    if (!item || seen.has(item.url)) return;
    seen.add(item.url);
    result.push(item);
  }

  function normalizeToken(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-');
  }

  function collectIssueKeys(issue) {
    const details = issue && issue.details ? issue.details : {};
    const keys = [];
    [
      details.issue,
      details.check,
      details.reason,
      details.problem,
      issue && issue.code,
      issue && issue.rule,
      issue && issue.id
    ].forEach(value => {
      const token = normalizeToken(value);
      if (!token) return;
      Object.keys(ISSUE_ARTICLES).forEach(issueKey => {
        if (token === normalizeToken(issueKey)) keys.push(issueKey);
      });
    });

    const attribute = normalizeToken(details.attribute || details.ariaAttribute || details.referenceAttribute);
    if (ATTRIBUTE_ARTICLES[attribute]) keys.push(ATTRIBUTE_ARTICLES[attribute]);

    const role = normalizeToken(details.role || details.liveRole);
    if (role === 'status') keys.push('roleStatus');
    if (role === 'alert') keys.push('roleAlert');
    if (role === 'log') keys.push('roleLog');
    if (role === 'tooltip') keys.push('roleTooltip');
    if (role === 'dialog') keys.push('roleDialog');

    const message = normalizeToken(issue && issue.message);
    if (message.includes('aria-labelledby')) keys.push('ariaLabelledby');
    if (message.includes('aria-describedby')) keys.push('ariaDescribedby');
    if (message.includes('aria-errormessage')) keys.push('ariaErrormessage');
    if (message.includes('aria-live')) keys.push('ariaLive');
    if (message.includes('role-status') || message.includes('status')) keys.push('roleStatus');
    if (message.includes('role-alert') || message.includes('alert')) keys.push('roleAlert');
    if (message.includes('tooltip')) keys.push('roleTooltip');
    if (message.includes('autocomplete')) keys.push('forms');
    if (message.includes('lang')) keys.push('siteLanguage');

    return keys;
  }

  function getLinks(issue, maxLinks) {
    const result = [];
    const seen = new Set();
    const limit = Number.isFinite(maxLinks) ? maxLinks : 3;

    collectIssueKeys(issue).forEach(key => {
      if (ISSUE_ARTICLES[key]) {
        ISSUE_ARTICLES[key].forEach(articleKey => addKey(result, seen, articleKey));
      } else {
        addKey(result, seen, key);
      }
    });

    const category = issue && issue.category;
    (CATEGORY_ARTICLES[category] || CATEGORY_ARTICLES.general).forEach(key => addKey(result, seen, key));

    return result.slice(0, limit);
  }

  root.DokaGuideLinks = {
    getLinks
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.DokaGuideLinks;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
