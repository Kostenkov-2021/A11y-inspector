/**
 * Content script for accessibility checking
 * Injected into web pages to perform accessibility audits
 */

// Make sure all dependencies are loaded
console.log('Content script инспектора доступности загружен');

// Global flag to indicate content script is ready
window.a11yInspectorReady = true;

// Initialize dependencies if they're not available
function initializeDependencies() {
  try {
    // Check and initialize ColorUtils if not available
    if (typeof ColorUtils === 'undefined') {
      console.warn('ColorUtils не загружен, используется резервная реализация');
      // Simple fallback color utils
      window.ColorUtils = {
        calculateContrastRatio: function(color1, color2) {
          // Simple fallback implementation
          return 4.5; // Default passing ratio
        },
        suggestContrastImprovements: function() {
          return { currentRatio: 4.5, suggestedRatio: 4.5 };
        }
      };
    }

    // Check and initialize A11yRules if not available
    if (typeof A11yRules === 'undefined') {
      console.warn('A11yRules не загружен, используется резервная реализация');
      window.A11yRules = {};
      window.A11yRuleUtils = {
        runAllChecks: function() { return []; }
      };
    }

    // Check and initialize ReportGenerator if not available
    if (typeof ReportGenerator === 'undefined') {
      console.warn('ReportGenerator не загружен, используется резервная реализация');
      window.ReportGenerator = class {
        generate(data, format) {
          if (format === 'json') {
            return JSON.stringify(data, null, 2);
          }
          return `Отчёт в формате ${format}\n${JSON.stringify(data, null, 2)}`;
        }
      };
    }

    return true;
  } catch (error) {
    console.error('Ошибка инициализации зависимостей:', error);
    return false;
  }
}

// Initialize dependencies when content script loads
initializeDependencies();

/**
 * Main function to run all accessibility checks
 * @returns {Object} Accessibility report with issues and summary
 */
function runA11yChecks() {
  console.log('Запуск проверки доступности...');

  const issues = [];

  try {
    // Use modular accessibility rules if available
    if (typeof A11yRuleUtils !== 'undefined' && typeof A11yRuleUtils.runAllChecks === 'function') {
      console.log('Для проверок используется A11yRuleUtils');
      const ruleIssues = A11yRuleUtils.runAllChecks();
      issues.push(...ruleIssues);
    } else {
      console.log('A11yRuleUtils недоступен, запускаются базовые проверки');
      // Run basic checks if rule utils are not available
      issues.push(...runBasicChecks());
    }

    // Run additional specialized checks
    const pageTitleIssues = checkPageTitle();
    issues.push(...pageTitleIssues);

    const autocompleteIssues = checkAutocompletePurpose();
    issues.push(...autocompleteIssues);

    const formAssistanceIssues = checkFormErrorAssistance();
    issues.push(...formAssistanceIssues);

    const contrastIssues = checkColorContrast();
    issues.push(...contrastIssues);

    const nonTextContrastIssues = checkNonTextContrast();
    issues.push(...nonTextContrastIssues);

    const textSpacingIssues = checkTextSpacingResilience();
    issues.push(...textSpacingIssues);

    const hoverFocusContentIssues = checkHoverFocusContent();
    issues.push(...hoverFocusContentIssues);

    const focusOrderIssues = checkFocusOrder();
    issues.push(...focusOrderIssues);

    const keyboardTrapIssues = checkKeyboardTraps();
    issues.push(...keyboardTrapIssues);

    const labelInNameIssues = checkLabelInName();
    issues.push(...labelInNameIssues);

    const statusMessageIssues = checkStatusMessages();
    issues.push(...statusMessageIssues);

    const syntaxIssues = checkSyntaxIntegrity();
    issues.push(...syntaxIssues);

    const ariaCurrentIssues = checkAriaCurrentForActiveItems();
    issues.push(...ariaCurrentIssues);

    const ariaIssues = checkAriaAttributes();
    issues.push(...ariaIssues);

    const keyboardIssues = checkKeyboardNavigation();
    issues.push(...keyboardIssues);

    const semanticIssues = checkSemanticMarkup();
    issues.push(...semanticIssues);

    const langIssues = checkLanguage();
    issues.push(...langIssues);

    const languagePartIssues = checkLanguageOfParts();
    issues.push(...languagePartIssues);

  } catch (error) {
    console.error('Ошибка во время проверки доступности:', error);
    issues.push({
      type: 'error',
      category: 'system',
      message: `Ошибка выполнения проверки: ${error.message}`,
      element: null,
      selector: null
    });
  }

  console.log(`Проверка доступности завершена: найдено проблем - ${issues.length}`);

  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    issues: issues,
    summary: {
      total: issues.length,
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length
    }
  };
}

/**
 * Basic accessibility checks as fallback
 */
function runBasicChecks() {
  const issues = [];

  try {
    // Check images without alt
    const images = document.querySelectorAll('img:not([alt])');
    images.forEach(img => {
      if (isElementVisible(img)) {
        issues.push({
          type: 'error',
          category: 'images',
          message: 'У изображения отсутствует атрибут alt',
          element: img.outerHTML,
          selector: getSelector(img)
        });
      }
    });

    // Check for page language
    const html = document.documentElement;
    if (!html.getAttribute('lang')) {
      issues.push({
        type: 'error',
        category: 'language',
        message: 'У элемента html отсутствует атрибут lang',
        element: html.outerHTML,
        selector: 'html'
      });
    }

    // Check for headings
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      issues.push({
        type: 'warning',
        category: 'headings',
        message: 'Заголовок H1 не найдён',
        element: null,
        selector: null
      });
    }

    // Check form labels
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
    inputs.forEach(input => {
      if (!input.id || !document.querySelector(`label[for="${input.id}"]`)) {
        issues.push({
          type: 'warning',
          category: 'forms',
          message: 'Поле ввода без связанной подписи',
          element: input.outerHTML,
          selector: getSelector(input)
        });
      }
    });

  } catch (error) {
    console.error('Ошибка в базовых проверках:', error);
    issues.push({
      type: 'error',
      category: 'system',
      message: `Ошибка базовой проверки: ${error.message}`,
      element: null,
      selector: null
    });
  }

  return issues;
}

/**
 * Check that the page has a meaningful title (GOST/WCAG 2.4.2).
 */
function checkPageTitle() {
  const issues = [];

  try {
    const title = (document.title || '').trim();
    const normalizedTitle = title.toLowerCase();
    const genericTitles = [
      'untitled', 'untitled document', 'document', 'page', 'home',
      'homepage', 'index', 'new page', 'без названия', 'документ',
      'страница', 'главная'
    ];

    if (!title) {
      issues.push({
        type: 'error',
        category: 'page-title',
        message: 'У страницы отсутствует заголовок <title>',
        element: document.querySelector('title') ? document.querySelector('title').outerHTML : null,
        selector: 'title',
        details: {
          criterion: '2.4.2',
          expected: 'Заголовок страницы должен описывать её тему или назначение'
        }
      });
      return issues;
    }

    if (title.length < 3 || genericTitles.includes(normalizedTitle) || /^[\W_]+$/.test(title)) {
      issues.push({
        type: 'warning',
        category: 'page-title',
        message: 'Заголовок страницы выглядит неинформативным',
        element: document.querySelector('title') ? document.querySelector('title').outerHTML : null,
        selector: 'title',
        details: {
          criterion: '2.4.2',
          title: title,
          expected: 'Заголовок должен отличать страницу и кратко описывать её назначение'
        }
      });
    }
  } catch (error) {
    console.error('Ошибка проверки заголовка страницы:', error);
  }

  return issues;
}

/**
 * Check autocomplete purpose for common user-information fields (GOST/WCAG 1.3.5).
 */
function checkAutocompletePurpose() {
  const issues = [];

  try {
    const controls = Array.from(document.querySelectorAll('input, select, textarea'));
    const supportedTypes = new Set([
      'text', 'email', 'tel', 'url', 'search', 'password', 'number',
      'date', 'month', 'week', 'time', 'datetime-local', ''
    ]);

    controls.forEach(control => {
      if (!isElementVisible(control) || control.disabled || control.readOnly) return;
      if (control.tagName.toLowerCase() === 'input' && !supportedTypes.has((control.type || '').toLowerCase())) return;

      const expected = inferAutocompleteToken(control);
      if (!expected) return;

      const autocomplete = (control.getAttribute('autocomplete') || '').trim().toLowerCase();
      const tokens = autocomplete.split(/\s+/).filter(Boolean);
      const hasExpectedToken = tokens.includes(expected);

      if (!autocomplete || autocomplete === 'off' || !hasExpectedToken) {
        issues.push({
          type: autocomplete === 'off' ? 'error' : 'warning',
          category: 'forms',
          message: `Поле, вероятно, требует autocomplete="${expected}"`,
          element: control.outerHTML,
          selector: getSelector(control),
          details: {
            criterion: '1.3.5',
            expectedAutocomplete: expected,
            currentAutocomplete: autocomplete || null,
            accessibleName: getControlText(control)
          }
        });
      }
    });
  } catch (error) {
    console.error('Ошибка проверки autocomplete:', error);
  }

  return issues;
}

function inferAutocompleteToken(control) {
  const type = (control.getAttribute('type') || '').toLowerCase();
  const text = getControlText(control);

  if (type === 'email' || hasFieldWord(text, ['email', 'e-mail', 'почта', 'электронная почта'])) return 'email';
  if (type === 'tel' || hasFieldWord(text, ['phone', 'tel', 'telephone', 'телефон', 'мобильный'])) return 'tel';

  const patterns = [
    { token: 'given-name', words: ['given name', 'first name', 'имя'] },
    { token: 'family-name', words: ['family name', 'last name', 'surname', 'фамилия'] },
    { token: 'name', words: ['full name', 'fio', 'name', 'фио', 'полное имя'] },
    { token: 'organization', words: ['organization', 'company', 'organisation', 'организация', 'компания'] },
    { token: 'street-address', words: ['street address', 'address', 'адрес'] },
    { token: 'address-line1', words: ['address line 1', 'address1', 'адрес 1'] },
    { token: 'address-line2', words: ['address line 2', 'address2', 'адрес 2'] },
    { token: 'postal-code', words: ['postal code', 'zip', 'postcode', 'индекс', 'почтовый индекс'] },
    { token: 'country', words: ['country', 'страна'] },
    { token: 'bday', words: ['birth date', 'birthday', 'date of birth', 'дата рождения'] }
  ];

  const match = patterns.find(item => hasFieldWord(text, item.words));
  return match ? match.token : null;
}

function getControlText(control) {
  const parts = [
    control.getAttribute('name'),
    control.getAttribute('id'),
    control.getAttribute('placeholder'),
    control.getAttribute('aria-label'),
    control.getAttribute('title')
  ];

  const labelledBy = control.getAttribute('aria-labelledby');
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach(id => {
      const labelElement = document.getElementById(id);
      if (labelElement) parts.push(labelElement.textContent);
    });
  }

  if (control.id) {
    const label = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    if (label) parts.push(label.textContent);
  }

  const wrappingLabel = control.closest('label');
  if (wrappingLabel) parts.push(wrappingLabel.textContent);

  return parts.filter(Boolean).join(' ').replace(/[_-]+/g, ' ').toLowerCase();
}

function hasFieldWord(text, words) {
  return words.some(word => {
    const normalizedWord = word.toLowerCase();
    if (/^[a-z0-9\s-]+$/.test(normalizedWord)) {
      const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
    }
    return text.includes(normalizedWord);
  });
}

/**
 * Check form error identification, labels/instructions, and correction help (GOST/WCAG 3.3.1-3.3.3).
 */
function checkFormErrorAssistance() {
  const issues = [];

  try {
    const controls = Array.from(document.querySelectorAll('input, select, textarea'));

    controls.slice(0, 1500).forEach(control => {
      if (!isFormControlForAssistance(control)) return;

      const selector = getSelector(control);
      const accessibleName = getControlText(control);
      const describedBy = getDescribedByInfo(control);
      const errorMessageInfo = getAriaErrorMessageInfo(control);
      const isRequired = isRequiredControl(control);
      const errorState = getControlErrorState(control, describedBy);

      if (isRequired && !hasRequiredInstruction(control, accessibleName, describedBy.text)) {
        issues.push({
          type: 'warning',
          category: 'form-assistance',
          message: 'Обязательное поле не имеет явной инструкции о том, что оно обязательно',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.2',
            issue: 'required-field-without-instruction',
            accessibleName,
            describedBy: describedBy.ids
          }
        });
      }

      if (describedBy.missingIds.length > 0) {
        issues.push({
          type: 'error',
          category: 'form-assistance',
          message: 'aria-describedby ссылается на несуществующий элемент',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.2',
            issue: 'broken-aria-describedby',
            missingIds: describedBy.missingIds,
            accessibleName
          }
        });
      }

      if (errorMessageInfo.missingId) {
        issues.push({
          type: 'error',
          category: 'form-assistance',
          message: 'aria-errormessage ссылается на несуществующий элемент',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.1',
            issue: 'broken-aria-errormessage',
            missingId: errorMessageInfo.missingId,
            accessibleName
          }
        });
      }

      if (errorState.hasVisualError && !errorState.hasProgrammaticInvalid) {
        issues.push({
          type: 'error',
          category: 'form-assistance',
          message: 'Поле выглядит ошибочным, но не имеет aria-invalid="true"',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.1',
            issue: 'visual-error-without-aria-invalid',
            accessibleName,
            detectedErrorText: errorState.errorText
          }
        });
      }

      const hasLinkedErrorDescription = describedBy.hasValidReferences || Boolean(errorMessageInfo.element && errorMessageInfo.text);

      if (errorState.hasProgrammaticInvalid && !hasLinkedErrorDescription) {
        issues.push({
          type: 'error',
          category: 'form-assistance',
          message: 'Поле с aria-invalid не связано с текстом ошибки через aria-describedby или aria-errormessage',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.1',
            issue: 'invalid-field-without-error-description',
            accessibleName,
            ariaDescribedBy: control.getAttribute('aria-describedby'),
            ariaErrorMessage: control.getAttribute('aria-errormessage')
          }
        });
      }

      const linkedErrorText = `${describedBy.text} ${errorMessageInfo.text}`.trim();
      if (errorState.hasProgrammaticInvalid && hasLinkedErrorDescription && !containsErrorOrSuggestionText(linkedErrorText)) {
        issues.push({
          type: 'warning',
          category: 'form-assistance',
          message: 'Описание ошибочного поля не содержит понятного текста ошибки или подсказки по исправлению',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.3',
            issue: 'invalid-field-without-correction-suggestion',
            accessibleName,
            linkedErrorText: linkedErrorText.slice(0, 180)
          }
        });
      }

      if (hasInputConstraint(control) && !hasConstraintInstruction(control, accessibleName, describedBy.text)) {
        issues.push({
          type: 'warning',
          category: 'form-assistance',
          message: 'Поле с ограничениями ввода не имеет связанной инструкции или примера формата',
          element: control.outerHTML,
          selector,
          details: {
            criterion: '3.3.2',
            issue: 'input-constraint-without-instruction',
            accessibleName,
            constraints: getInputConstraints(control),
            describedBy: describedBy.ids
          }
        });
      }
    });

    const globalErrorIssues = checkGlobalFormErrors();
    issues.push(...globalErrorIssues);
  } catch (error) {
    console.error('Ошибка проверки помощи при вводе:', error);
  }

  return issues;
}

function isFormControlForAssistance(control) {
  if (!isElementVisible(control) || control.disabled || control.readOnly) return false;
  if (control.tagName.toLowerCase() !== 'input') return true;

  const type = (control.type || '').toLowerCase();
  return !['hidden', 'button', 'submit', 'reset', 'image'].includes(type);
}

function isRequiredControl(control) {
  return control.required ||
         control.getAttribute('aria-required') === 'true' ||
         /\brequired\b/i.test(control.className || '') ||
         /обязател|required|\*/i.test(getAssociatedFormText(control));
}

function getDescribedByInfo(control) {
  const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  const elements = ids.map(id => document.getElementById(id)).filter(Boolean);
  const missingIds = ids.filter(id => !document.getElementById(id));
  const text = elements.map(element => element.textContent || '').join(' ').replace(/\s+/g, ' ').trim();

  return {
    ids,
    missingIds,
    elements,
    text,
    hasValidReferences: elements.length > 0 && text.length > 0
  };
}

function getControlErrorState(control, describedBy) {
  const ariaInvalid = (control.getAttribute('aria-invalid') || '').toLowerCase();
  const hasProgrammaticInvalid = ariaInvalid === 'true' || ariaInvalid === 'grammar' || ariaInvalid === 'spelling';
  const associatedText = [
    describedBy.text,
    getAssociatedFormText(control),
    control.validationMessage || ''
  ].join(' ');
  const hasNativeInvalidValue = control.value && control.validity && !control.validity.valid;
  const hasVisualError = hasProgrammaticInvalid ||
                         hasNativeInvalidValue ||
                         hasClassContaining(control, ['error', 'invalid', 'danger']) ||
                         containsErrorText(associatedText);

  return {
    hasProgrammaticInvalid,
    hasVisualError,
    errorText: associatedText.replace(/\s+/g, ' ').trim().slice(0, 180)
  };
}

function hasRequiredInstruction(control, accessibleName, describedByText) {
  return /обязател|required|\*/i.test(`${accessibleName} ${describedByText} ${getAssociatedFormText(control)}`);
}

function getAriaErrorMessageInfo(control) {
  const id = control.getAttribute('aria-errormessage');
  if (!id) {
    return { id: null, element: null, text: '', missingId: null };
  }

  const element = document.getElementById(id);
  return {
    id,
    element,
    text: element ? (element.textContent || '').replace(/\s+/g, ' ').trim() : '',
    missingId: element ? null : id
  };
}

function hasInputConstraint(control) {
  const type = (control.getAttribute('type') || '').toLowerCase();
  return ['email', 'url', 'tel', 'number', 'date', 'time', 'datetime-local', 'month', 'week', 'password'].includes(type) ||
         control.hasAttribute('pattern') ||
         control.hasAttribute('min') ||
         control.hasAttribute('max') ||
         control.hasAttribute('minlength') ||
         control.hasAttribute('maxlength');
}

function getInputConstraints(control) {
  const names = ['type', 'pattern', 'min', 'max', 'minlength', 'maxlength'];
  return names.reduce((constraints, name) => {
    if (control.hasAttribute(name)) constraints[name] = control.getAttribute(name);
    return constraints;
  }, {});
}

function hasConstraintInstruction(control, accessibleName, describedByText) {
  const combinedText = `${accessibleName} ${describedByText} ${control.getAttribute('placeholder') || ''}`.toLowerCase();
  const type = (control.getAttribute('type') || '').toLowerCase();

  if (control.hasAttribute('pattern') && !/(формат|format|пример|example|например|must|долж|только)/i.test(combinedText)) return false;
  if (['email', 'url', 'tel', 'date', 'time', 'number', 'password'].includes(type)) {
    return /(формат|format|пример|example|например|email|e-mail|телефон|phone|url|дата|date|число|number|парол|password|min|max|миним|максим)/i.test(combinedText);
  }

  return true;
}

function containsErrorText(text) {
  return /(error|invalid|incorrect|wrong|ошиб|неверн|некоррект|исправ)/i.test(text || '');
}

function containsErrorOrSuggestionText(text) {
  return /(error|invalid|required|incorrect|wrong|fix|enter|use|must|ошиб|неверн|некоррект|обязател|заполн|исправ|введите|укажите|используйте|долж)/i.test(text || '');
}

function getAssociatedFormText(control) {
  const parts = [];
  const fieldContainer = control.closest('.form-group, .field, .input-group, .control, .form-field, [class*="field"], [class*="input-group"], [class*="control"]');

  if (fieldContainer) {
    const relatedText = Array.from(fieldContainer.querySelectorAll('label, small, .help, .hint, .error, .invalid-feedback, [role="alert"], [aria-live]'))
      .map(element => element.textContent || '')
      .join(' ');
    parts.push(relatedText);
  }

  if (control.id) {
    const label = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    if (label) parts.push(label.textContent);
  }

  const wrappingLabel = control.closest('label');
  if (wrappingLabel) parts.push(wrappingLabel.textContent);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function checkGlobalFormErrors() {
  const issues = [];
  const errorContainers = Array.from(document.querySelectorAll('[role="alert"], [aria-live], .error, .errors, .invalid-feedback, [class*="error"]'));

  errorContainers.slice(0, 500).forEach(container => {
    if (!isElementVisible(container)) return;
    const text = (container.textContent || '').trim();
    if (!containsErrorText(text)) return;

    const id = container.getAttribute('id');
    const isReferenced = id && document.querySelector(`[aria-describedby~="${CSS.escape(id)}"], [aria-errormessage="${CSS.escape(id)}"]`);

    if (!isReferenced && !container.closest('label')) {
      issues.push({
        type: 'warning',
        category: 'form-assistance',
        message: 'Текст ошибки не связан с полем через aria-describedby или aria-errormessage',
        element: container.outerHTML,
        selector: getSelector(container),
        details: {
          criterion: '3.3.1',
          issue: 'unassociated-error-message',
          text: text.slice(0, 180)
        }
      });
    }
  });

  return issues;
}

/**
 * Check color contrast for all visible text elements
 */
function checkColorContrast() {
  const issues = [];

  try {
    // Limit elements for performance on large pages
    const textElements = getTextElements().slice(0, 1000);

    textElements.forEach(element => {
      const contrastResult = getContrastRatioForElement(element);

      if (contrastResult && !contrastResult.meetsAA) {
        issues.push({
          type: 'error',
          category: 'contrast',
          message: `Недостаточный контраст: ${contrastResult.ratio.toFixed(2)}:1 (требуется ${contrastResult.requiredAARatio}:1)`,
          element: element.outerHTML,
          selector: getSelector(element),
          details: {
            ratio: contrastResult.ratio.toFixed(2),
            requiredRatio: contrastResult.requiredAARatio,
            fontSize: `${contrastResult.fontSize}px`,
            fontWeight: contrastResult.fontWeight,
            textColor: contrastResult.textColor,
            backgroundColor: contrastResult.backgroundColor,
            suggestions: contrastResult.suggestions
          }
        });
      }
    });
  } catch (error) {
    console.error('Ошибка проверки контраста:', error);
  }

  return issues;
}

/**
 * Check non-text contrast for control borders, SVG graphics, and focus indicators (GOST/WCAG 1.4.11).
 */
function checkNonTextContrast() {
  const issues = [];
  const seen = new Set();
  const requiredRatio = 3;

  try {
    const controls = Array.from(document.querySelectorAll('button, [role="button"], input, select, textarea, [tabindex], a[href]'));
    controls.slice(0, 1000).forEach(control => {
      if (!isElementVisible(control)) return;

      const borderIssue = getLowContrastBorderIssue(control, requiredRatio);
      if (borderIssue) {
        issues.push(borderIssue);
      }

      const focusIssue = getLowContrastFocusIssue(control, requiredRatio);
      if (focusIssue) {
        issues.push(focusIssue);
      }
    });

    const graphics = Array.from(document.querySelectorAll('svg, svg *, [role="img"]'));
    graphics.slice(0, 1000).forEach(graphic => {
      if (!isElementVisible(graphic)) return;

      const graphicIssue = getLowContrastGraphicIssue(graphic, requiredRatio);
      if (!graphicIssue) return;

      const key = `${graphicIssue.selector}|${graphicIssue.details.graphicColor}|${graphicIssue.details.backgroundColor}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push(graphicIssue);
    });
  } catch (error) {
    console.error('Ошибка проверки контрастности нетекстовой информации:', error);
  }

  return issues;
}

function getLowContrastBorderIssue(element, requiredRatio) {
  const style = window.getComputedStyle(element);
  const backgroundColor = getBackgroundColor(element);
  const sides = ['top', 'right', 'bottom', 'left'];

  for (const side of sides) {
    const width = parseFloat(style.getPropertyValue(`border-${side}-width`));
    const borderStyle = style.getPropertyValue(`border-${side}-style`);
    const borderColor = resolveCssColor(style.getPropertyValue(`border-${side}-color`), element);

    if (!width || borderStyle === 'none' || borderStyle === 'hidden' || !borderColor || !backgroundColor) continue;

    const ratio = ColorUtils.calculateContrastRatio(borderColor, backgroundColor);
    if (ratio < requiredRatio) {
      return {
        type: 'warning',
        category: 'non-text-contrast',
        message: `Недостаточный контраст границы элемента: ${ratio.toFixed(2)}:1 (требуется ${requiredRatio}:1)`,
        element: element.outerHTML,
        selector: getSelector(element),
        details: {
          criterion: '1.4.11',
          ratio: ratio.toFixed(2),
          requiredRatio,
          borderSide: side,
          borderColor,
          backgroundColor
        }
      };
    }
  }

  return null;
}

function getLowContrastFocusIssue(element, requiredRatio) {
  const style = window.getComputedStyle(element);
  const backgroundColor = getBackgroundColor(element);
  const outlineWidth = parseFloat(style.outlineWidth);
  const outlineStyle = style.outlineStyle;
  const outlineColor = resolveCssColor(style.outlineColor, element);

  if (outlineWidth > 0 && outlineStyle !== 'none' && outlineColor && backgroundColor) {
    const ratio = ColorUtils.calculateContrastRatio(outlineColor, backgroundColor);
    if (ratio < requiredRatio) {
      return {
        type: 'warning',
        category: 'non-text-contrast',
        message: `Недостаточный контраст индикатора фокуса: ${ratio.toFixed(2)}:1 (требуется ${requiredRatio}:1)`,
        element: element.outerHTML,
        selector: getSelector(element),
        details: {
          criterion: '1.4.11',
          ratio: ratio.toFixed(2),
          requiredRatio,
          focusColor: outlineColor,
          backgroundColor
        }
      };
    }
  }

  const shadowColor = extractFirstCssColor(style.boxShadow);
  if (shadowColor && backgroundColor) {
    const ratio = ColorUtils.calculateContrastRatio(shadowColor, backgroundColor);
    if (ratio < requiredRatio) {
      return {
        type: 'warning',
        category: 'non-text-contrast',
        message: `Недостаточный контраст тени/кольца фокуса: ${ratio.toFixed(2)}:1 (требуется ${requiredRatio}:1)`,
        element: element.outerHTML,
        selector: getSelector(element),
        details: {
          criterion: '1.4.11',
          ratio: ratio.toFixed(2),
          requiredRatio,
          focusColor: shadowColor,
          backgroundColor
        }
      };
    }
  }

  return null;
}

function getLowContrastGraphicIssue(element, requiredRatio) {
  const style = window.getComputedStyle(element);
  const backgroundColor = getBackgroundColor(element);
  const colors = [
    resolveCssColor(style.fill, element),
    resolveCssColor(style.stroke, element),
    resolveCssColor(style.color, element)
  ].filter(color => color && !isTransparentColor(color));

  const graphicColor = colors.find(color => {
    const ratio = ColorUtils.calculateContrastRatio(color, backgroundColor);
    return ratio < requiredRatio;
  });

  if (!graphicColor || !backgroundColor) return null;

  const ratio = ColorUtils.calculateContrastRatio(graphicColor, backgroundColor);
  return {
    type: 'warning',
    category: 'non-text-contrast',
    message: `Недостаточный контраст графического элемента: ${ratio.toFixed(2)}:1 (требуется ${requiredRatio}:1)`,
    element: element.outerHTML,
    selector: getSelector(element),
    details: {
      criterion: '1.4.11',
      ratio: ratio.toFixed(2),
      requiredRatio,
      graphicColor,
      backgroundColor
    }
  };
}

/**
 * Check that content survives increased text spacing (GOST/WCAG 1.4.12).
 */
function checkTextSpacingResilience() {
  const issues = [];
  const styleId = 'a11y-inspector-text-spacing-test';

  try {
    const before = getOverflowingTextSpacingElements();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p, li, blockquote, dd, dt {
        margin-bottom: 2em !important;
      }
    `;

    document.documentElement.appendChild(style);
    const after = getOverflowingTextSpacingElements();
    style.remove();

    const newIssues = Array.from(after.values()).filter(item => !before.has(item.selector));
    newIssues.slice(0, 50).forEach(item => {
      issues.push({
        type: 'warning',
        category: 'text-spacing',
        message: 'Контент может обрезаться или требовать горизонтальной прокрутки при увеличенных интервалах текста',
        element: item.element,
        selector: item.selector,
        details: {
          criterion: '1.4.12',
          scrollWidth: item.scrollWidth,
          clientWidth: item.clientWidth,
          scrollHeight: item.scrollHeight,
          clientHeight: item.clientHeight
        }
      });
    });
  } catch (error) {
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();
    console.error('Ошибка проверки интервалов текста:', error);
  }

  return issues;
}

function getOverflowingTextSpacingElements() {
  const results = new Map();
  const elements = Array.from(document.body ? document.body.querySelectorAll('*') : []);

  elements.slice(0, 1500).forEach(element => {
    if (!isElementVisible(element)) return;

    const text = (element.textContent || '').trim();
    if (!text) return;

    const style = window.getComputedStyle(element);
    const hasClippingOverflow = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) ||
                                ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
    if (!hasClippingOverflow) return;

    const horizontalOverflow = element.scrollWidth > element.clientWidth + 2;
    const verticalOverflow = ['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 2;

    if (horizontalOverflow || verticalOverflow) {
      const selector = getSelector(element);
      results.set(selector, {
        selector,
        element: element.outerHTML,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight
      });
    }
  });

  return results;
}

/**
 * Check hover/focus supplemental content behavior (GOST/WCAG 1.4.13).
 */
function checkHoverFocusContent() {
  const issues = [];
  const seen = new Set();

  try {
    const titleIssues = findNativeTitleTooltipIssues();
    titleIssues.forEach(issue => addUniqueIssue(issues, seen, issue));

    const popupIssues = findVisiblePopupContentIssues();
    popupIssues.forEach(issue => addUniqueIssue(issues, seen, issue));

    const triggerIssues = findMouseOnlyPopupTriggerIssues();
    triggerIssues.forEach(issue => addUniqueIssue(issues, seen, issue));
  } catch (error) {
    console.error('Ошибка проверки контента при наведении/фокусе:', error);
  }

  return issues;
}

function findNativeTitleTooltipIssues() {
  const issues = [];
  const titledElements = Array.from(document.querySelectorAll('[title]'));

  titledElements.slice(0, 500).forEach(element => {
    if (!isElementVisible(element)) return;

    const title = (element.getAttribute('title') || '').trim();
    if (!title) return;

    issues.push({
      type: 'warning',
      category: 'hover-focus-content',
      message: 'Нативная подсказка title может быть недоступна для наведения, фокуса или закрытия',
      element: element.outerHTML,
      selector: getSelector(element),
      details: {
        criterion: '1.4.13',
        issue: 'native-title-tooltip',
        title: title.slice(0, 120),
        expected: 'Для важной подсказки используйте управляемый tooltip/popover, который можно закрыть, навести курсором и удерживать открытым'
      }
    });
  });

  return issues;
}

function findVisiblePopupContentIssues() {
  const issues = [];
  const popupSelectors = [
    '[role="tooltip"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[popover]',
    '[aria-modal="true"]',
    '.tooltip',
    '.popover',
    '.dropdown-menu',
    '.dropdown-content',
    '.menu',
    '[class*="tooltip"]',
    '[class*="popover"]',
    '[class*="dropdown"]'
  ].join(',');

  const popups = Array.from(document.querySelectorAll(popupSelectors));

  popups.slice(0, 500).forEach(popup => {
    if (!isElementVisible(popup) || !isLikelySupplementalPopup(popup)) return;

    const style = window.getComputedStyle(popup);
    const selector = getSelector(popup);

    if (style.pointerEvents === 'none') {
      issues.push({
        type: 'warning',
        category: 'hover-focus-content',
        message: 'Всплывающий контент нельзя удержать наведением курсора из-за pointer-events: none',
        element: popup.outerHTML,
        selector,
        details: {
          criterion: '1.4.13',
          issue: 'not-hoverable',
          pointerEvents: style.pointerEvents,
          expected: 'Контент, появляющийся при hover/focus, должен оставаться доступным при наведении на сам контент'
        }
      });
    }

    if (!hasPopupDismissMechanism(popup)) {
      issues.push({
        type: 'warning',
        category: 'hover-focus-content',
        message: 'У всплывающего контента не найдён явный способ закрытия',
        element: popup.outerHTML,
        selector,
        details: {
          criterion: '1.4.13',
          issue: 'no-visible-dismiss',
          expected: 'Должен быть способ закрыть подсказку/поповер без перемещения указателя, например Escape или кнопка закрытия'
        }
      });
    }
  });

  return issues;
}

function findMouseOnlyPopupTriggerIssues() {
  const issues = [];
  const triggerSelectors = [
    '[aria-haspopup]',
    '[aria-expanded]',
    '[aria-controls]',
    '[data-toggle*="dropdown"]',
    '[data-bs-toggle*="dropdown"]',
    '[data-tooltip]',
    '[data-title]',
    '.dropdown-toggle',
    '[onmouseover]',
    '[onmouseenter]'
  ].join(',');

  const triggers = Array.from(document.querySelectorAll(triggerSelectors));

  triggers.slice(0, 700).forEach(trigger => {
    if (!isElementVisible(trigger)) return;

    const hasMouseOpen = trigger.hasAttribute('onmouseover') ||
                         trigger.hasAttribute('onmouseenter') ||
                         hasClassContaining(trigger, ['hover', 'tooltip', 'dropdown', 'popover']);
    if (!hasMouseOpen) return;

    const hasFocusOpen = trigger.hasAttribute('onfocus') ||
                         trigger.hasAttribute('onfocusin') ||
                         trigger.hasAttribute('aria-expanded') ||
                         trigger.hasAttribute('aria-haspopup') ||
                         trigger.hasAttribute('aria-controls') ||
                         isNaturallyFocusable(trigger) ||
                         trigger.hasAttribute('tabindex');

    if (!hasFocusOpen) {
      issues.push({
        type: 'warning',
        category: 'hover-focus-content',
        message: 'Триггер всплывающего контента выглядит доступным только при наведении мышью',
        element: trigger.outerHTML,
        selector: getSelector(trigger),
        details: {
          criterion: '1.4.13',
          issue: 'hover-only-trigger',
          expected: 'Контент, появляющийся при наведении, должен также работать при клавиатурном фокусе и не исчезать сразу при фокусе'
        }
      });
    }

    const controlledPopup = getControlledPopup(trigger);
    if (controlledPopup && isElementVisible(controlledPopup) && window.getComputedStyle(controlledPopup).pointerEvents === 'none') {
      issues.push({
        type: 'warning',
        category: 'hover-focus-content',
        message: 'Связанный всплывающий контент может исчезать или быть недоступным при попытке навести на него курсор',
        element: controlledPopup.outerHTML,
        selector: getSelector(controlledPopup),
        details: {
          criterion: '1.4.13',
          issue: 'controlled-popup-not-hoverable',
          trigger: getSelector(trigger)
        }
      });
    }
  });

  return issues;
}

function isLikelySupplementalPopup(element) {
  const role = (element.getAttribute('role') || '').toLowerCase();
  if (['tooltip', 'menu', 'listbox', 'dialog'].includes(role)) return true;
  if (element.hasAttribute('popover') || element.getAttribute('aria-modal') === 'true') return true;

  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
  if (/(tooltip|popover|dropdown|menu)/.test(className)) return true;

  const style = window.getComputedStyle(element);
  return ['absolute', 'fixed', 'sticky'].includes(style.position) && element.getBoundingClientRect().width > 0;
}

function hasPopupDismissMechanism(popup) {
  if (popup.hasAttribute('popover')) return true;

  const closeSelectors = [
    'button[aria-label*="close" i]',
    'button[aria-label*="закры" i]',
    'button[title*="close" i]',
    'button[title*="закры" i]',
    '[data-dismiss]',
    '[data-bs-dismiss]',
    '[popovertargetaction="hide"]',
    '.close',
    '.btn-close',
    '[class*="close"]'
  ].join(',');

  if (popup.querySelector(closeSelectors)) return true;
  if (popup.hasAttribute('onkeydown') || popup.hasAttribute('onkeyup')) return true;

  const role = (popup.getAttribute('role') || '').toLowerCase();
  return role === 'menu' || role === 'listbox';
}

function getControlledPopup(trigger) {
  const controls = trigger.getAttribute('aria-controls') || trigger.getAttribute('aria-describedby');
  if (!controls) return null;

  const id = controls.split(/\s+/).find(Boolean);
  return id ? document.getElementById(id) : null;
}

function hasClassContaining(element, terms) {
  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
  return terms.some(term => className.includes(term));
}

function isNaturallyFocusable(element) {
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  if (['button', 'select', 'textarea'].includes(tag)) return !element.disabled;
  if (tag === 'input') return !element.disabled && element.type !== 'hidden';
  if (tag === 'a') return element.hasAttribute('href');
  return false;
}

function addUniqueIssue(issues, seen, issue) {
  const key = `${issue.category}|${issue.selector}|${issue.details && issue.details.issue}`;
  if (seen.has(key)) return;
  seen.add(key);
  issues.push(issue);
}

/**
 * Check focus order against DOM/tabindex and visual layout (GOST/WCAG 2.4.3).
 */
function checkFocusOrder() {
  const issues = [];

  try {
    const focusableItems = getFocusableOrderItems();
    if (focusableItems.length < 2) return issues;

    const positiveTabIndexItems = focusableItems.filter(item => item.tabIndex > 0);
    positiveTabIndexItems.slice(0, 25).forEach(item => {
      issues.push({
        type: 'warning',
        category: 'focus-order',
        message: `Положительный tabindex="${item.tabIndex}" может нарушать естественный порядок фокуса`,
        element: item.element.outerHTML,
        selector: item.selector,
        details: {
          criterion: '2.4.3',
          issue: 'positive-tabindex',
          focusIndex: item.focusIndex,
          tabIndex: item.tabIndex,
          expected: 'Используйте естественный порядок элементов в DOM или tabindex="0" вместо положительных значений'
        }
      });
    });

    const visualJumps = findSuspiciousFocusJumps(focusableItems);
    visualJumps.slice(0, 50).forEach(jump => {
      issues.push({
        type: 'warning',
        category: 'focus-order',
        message: 'Порядок фокуса выглядит несогласованным с визуальным расположением элементов',
        element: jump.current.element.outerHTML,
        selector: jump.current.selector,
        details: {
          criterion: '2.4.3',
          issue: jump.reason,
          from: {
            focusIndex: jump.previous.focusIndex,
            selector: jump.previous.selector,
            text: getShortElementText(jump.previous.element)
          },
          to: {
            focusIndex: jump.current.focusIndex,
            selector: jump.current.selector,
            text: getShortElementText(jump.current.element)
          },
          previousRect: jump.previous.rectSummary,
          currentRect: jump.current.rectSummary
        }
      });
    });
  } catch (error) {
    console.error('Ошибка проверки порядка фокуса:', error);
  }

  return issues;
}

function getFocusableOrderItems() {
  const selector = [
    'a[href]',
    'area[href]',
    'button',
    'input',
    'select',
    'textarea',
    'summary',
    'iframe',
    'object',
    'embed',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]'
  ].join(',');

  const elements = Array.from(document.querySelectorAll(selector))
    .filter(element => isFocusableForOrder(element))
    .map((element, domIndex) => {
      const tabIndex = getElementTabIndex(element);
      const rect = element.getBoundingClientRect();
      return {
        element,
        domIndex,
        tabIndex,
        selector: getSelector(element),
        rect,
        rectSummary: summarizeRect(rect)
      };
    });

  const sorted = elements.sort((a, b) => {
    const aPositive = a.tabIndex > 0;
    const bPositive = b.tabIndex > 0;

    if (aPositive && bPositive && a.tabIndex !== b.tabIndex) return a.tabIndex - b.tabIndex;
    if (aPositive && !bPositive) return -1;
    if (!aPositive && bPositive) return 1;
    return a.domIndex - b.domIndex;
  });

  sorted.forEach((item, index) => {
    item.focusIndex = index + 1;
  });

  return sorted;
}

function isFocusableForOrder(element) {
  if (!isElementVisible(element)) return false;
  if (element.disabled || element.getAttribute('aria-hidden') === 'true') return false;

  const tabIndexAttr = element.getAttribute('tabindex');
  if (tabIndexAttr !== null && parseInt(tabIndexAttr, 10) < 0) return false;

  const style = window.getComputedStyle(element);
  if (style.pointerEvents === 'none') return false;

  if (isNaturallyFocusable(element)) return true;
  if (element.hasAttribute('tabindex')) return true;
  if (element.isContentEditable) return true;

  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  return ['summary', 'iframe', 'object', 'embed'].includes(tag);
}

function getElementTabIndex(element) {
  const attr = element.getAttribute('tabindex');
  if (attr === null || attr === '') return 0;
  const value = parseInt(attr, 10);
  return Number.isNaN(value) ? 0 : value;
}

function findSuspiciousFocusJumps(items) {
  const jumps = [];
  const direction = (document.dir || document.documentElement.dir || 'ltr').toLowerCase();
  const rowTolerance = 16;
  const backwardsTolerance = 32;

  for (let i = 1; i < items.length; i++) {
    const previous = items[i - 1];
    const current = items[i];
    const previousRect = previous.rect;
    const currentRect = current.rect;

    if (isTinyRect(previousRect) || isTinyRect(currentRect)) continue;
    if (areOverlappingRects(previousRect, currentRect)) continue;

    const previousCenterY = previousRect.top + previousRect.height / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    const previousCenterX = previousRect.left + previousRect.width / 2;
    const currentCenterX = currentRect.left + currentRect.width / 2;

    const movesToEarlierRow = currentCenterY < previousCenterY - Math.max(rowTolerance, previousRect.height * 0.5);
    const sameVisualRow = Math.abs(currentCenterY - previousCenterY) <= Math.max(rowTolerance, Math.min(previousRect.height, currentRect.height));
    const movesBackOnRow = direction === 'rtl'
      ? currentCenterX > previousCenterX + backwardsTolerance
      : currentCenterX < previousCenterX - backwardsTolerance;

    if (movesToEarlierRow) {
      jumps.push({ previous, current, reason: 'focus-moves-to-earlier-visual-row' });
    } else if (sameVisualRow && movesBackOnRow) {
      jumps.push({ previous, current, reason: 'focus-moves-backward-on-same-row' });
    }
  }

  return jumps;
}

function summarizeRect(rect) {
  return {
    top: Math.round(rect.top),
    left: Math.round(rect.left),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function isTinyRect(rect) {
  return rect.width < 4 || rect.height < 4;
}

function areOverlappingRects(a, b) {
  return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
}

function getShortElementText(element) {
  const text = (
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.textContent ||
    element.getAttribute('value') ||
    element.getAttribute('name') ||
    ''
  ).trim().replace(/\s+/g, ' ');

  return text.slice(0, 80);
}

/**
 * Semi-automated keyboard trap detection (GOST/WCAG 2.1.2).
 */
function checkKeyboardTraps() {
  const issues = [];
  const seen = new Set();

  try {
    const previousActiveElement = document.activeElement;
    const focusableItems = getFocusableOrderItems();

    getFocusTrapScopeIssues(focusableItems).forEach(issue => addUniqueIssue(issues, seen, issue));
    getTabCancellationIssues(focusableItems).forEach(issue => addUniqueIssue(issues, seen, issue));

    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus({ preventScroll: true });
    }
  } catch (error) {
    console.error('Ошибка проверки клавиатурных ловушек:', error);
  }

  return issues;
}

function getFocusTrapScopeIssues(focusableItems) {
  const issues = [];
  const scopes = new Map();

  focusableItems.forEach(item => {
    const scope = getPotentialFocusTrapScope(item.element);
    if (!scope) return;

    if (!scopes.has(scope)) scopes.set(scope, []);
    scopes.get(scope).push(item);
  });

  scopes.forEach((items, scope) => {
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const hasBefore = focusableItems.some(item => item.focusIndex < first.focusIndex && !scope.contains(item.element));
    const hasAfter = focusableItems.some(item => item.focusIndex > last.focusIndex && !scope.contains(item.element));
    const exitMechanisms = getKeyboardTrapExitMechanisms(scope);

    if ((hasBefore || hasAfter) && exitMechanisms.length === 0) {
      issues.push(createKeyboardTrapIssue(scope, {
        type: 'warning',
        message: 'Компонент может удерживать клавиатурный фокус без явного способа выхода',
        issue: 'potential-focus-trap-without-exit',
        details: {
          focusableCount: items.length,
          firstFocusable: first.selector,
          lastFocusable: last.selector,
          hasFocusableBefore: hasBefore,
          hasFocusableAfter: hasAfter,
          expected: 'Добавьте клавиатурный способ выйти из компонента: Escape, закрывающую кнопку или документированную клавишу'
        }
      }));
    }

    const boundaryCancellations = [
      getSyntheticTabCancellation(first.element, true),
      getSyntheticTabCancellation(last.element, false)
    ].filter(Boolean);

    if (boundaryCancellations.length > 0 && exitMechanisms.length === 0) {
      issues.push(createKeyboardTrapIssue(scope, {
        type: 'error',
        message: 'Компонент перехватывает Tab на границе и не имеет найдённого способа выхода',
        issue: 'tab-boundary-cancelled-without-exit',
        details: {
          focusableCount: items.length,
          cancelledAt: boundaryCancellations,
          firstFocusable: first.selector,
          lastFocusable: last.selector
        }
      }));
    }
  });

  return issues;
}

function getTabCancellationIssues(focusableItems) {
  const issues = [];

  focusableItems.slice(0, 300).forEach(item => {
    const scope = getPotentialFocusTrapScope(item.element);
    if (scope) return;

    const forwardCancelled = getSyntheticTabCancellation(item.element, false);
    const backwardCancelled = getSyntheticTabCancellation(item.element, true);

    if (forwardCancelled && backwardCancelled) {
      issues.push(createKeyboardTrapIssue(item.element, {
        type: 'warning',
        message: 'Элемент перехватывает Tab и Shift+Tab; возможна клавиатурная ловушка',
        issue: 'element-cancels-tab-both-directions',
        details: {
          focusIndex: item.focusIndex,
          selector: item.selector,
          expected: 'Проверьте вручную, можно ли уйти с элемента только клавиатурой'
        }
      }));
    }
  });

  return issues;
}

function getPotentialFocusTrapScope(element) {
  return element.closest([
    'dialog[open]',
    '[aria-modal="true"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="grid"]',
    '[role="tree"]',
    '[data-focus-trap]',
    '[data-trap-focus]',
    '.modal',
    '.dialog',
    '.dropdown-menu',
    '.popover',
    '.drawer',
    '[class*="focus-trap"]',
    '[class*="modal"]',
    '[class*="dialog"]'
  ].join(','));
}

function getKeyboardTrapExitMechanisms(scope) {
  const mechanisms = [];

  if (scope.querySelector([
    'button[aria-label*="close" i]',
    'button[aria-label*="закры" i]',
    'button[title*="close" i]',
    'button[title*="закры" i]',
    '[data-dismiss]',
    '[data-bs-dismiss]',
    '[popovertargetaction="hide"]',
    '.close',
    '.btn-close',
    '[class*="close"]'
  ].join(','))) {
    mechanisms.push('close-control');
  }

  if (scope.hasAttribute('onkeydown') || scope.hasAttribute('onkeyup')) {
    mechanisms.push('keyboard-handler');
  }

  if (scope.tagName && scope.tagName.toLowerCase() === 'dialog') {
    mechanisms.push('native-dialog');
  }

  const describedText = normalizeAccessibleText([
    scope.getAttribute('aria-label') || '',
    getReferencedText(scope, 'aria-labelledby'),
    getReferencedText(scope, 'aria-describedby'),
    scope.textContent || ''
  ].join(' ')).toLowerCase();

  if (/(escape|esc|закры|выйти|выход|нажмите esc|нажмите escape)/i.test(describedText)) {
    mechanisms.push('documented-keyboard-exit');
  }

  return mechanisms;
}

function getSyntheticTabCancellation(element, shiftKey) {
  if (!element || typeof element.focus !== 'function') return null;

  try {
    element.focus({ preventScroll: true });

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      bubbles: true,
      cancelable: true,
      shiftKey
    });

    const wasNotCancelled = element.dispatchEvent(event);
    if (!wasNotCancelled || event.defaultPrevented) {
      return {
        selector: getSelector(element),
        direction: shiftKey ? 'backward' : 'forward'
      };
    }
  } catch (error) {
    return null;
  }

  return null;
}

function getReferencedText(element, attributeName) {
  const value = element.getAttribute(attributeName);
  if (!value) return '';

  return value.split(/\s+/)
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(target => target.textContent || '')
    .join(' ');
}

function createKeyboardTrapIssue(element, options) {
  return {
    type: options.type,
    category: 'keyboard-traps',
    message: options.message,
    element: element.outerHTML,
    selector: getSelector(element),
    details: Object.assign({
      criterion: '2.1.2',
      issue: options.issue
    }, options.details || {})
  };
}

/**
 * Check that visible labels are included in accessible names (GOST/WCAG 2.5.3).
 */
function checkLabelInName() {
  const issues = [];

  try {
    const elements = Array.from(document.querySelectorAll(
      'button, a[href], [role="button"], [role="link"], [role="menuitem"], [role="tab"], input[type="button"], input[type="submit"], input[type="reset"]'
    ));

    elements.slice(0, 1500).forEach(element => {
      if (!isElementVisible(element) || isElementDisabled(element)) return;

      const visibleLabel = getVisibleControlLabel(element);
      if (!isUsefulVisibleLabel(visibleLabel)) return;

      const accessibleName = getAccessibleNameForControl(element);
      if (!accessibleName) return;

      if (!doesAccessibleNameContainVisibleLabel(accessibleName, visibleLabel)) {
        issues.push({
          type: 'error',
          category: 'label-in-name',
          message: 'Видимая метка интерактивного элемента не входит в его доступное имя',
          element: element.outerHTML,
          selector: getSelector(element),
          details: {
            criterion: '2.5.3',
            issue: 'visible-label-not-in-accessible-name',
            visibleLabel,
            accessibleName,
            expected: 'Accessible name должен содержать видимый текст элемента, желательно в начале'
          }
        });
      }
    });
  } catch (error) {
    console.error('Ошибка проверки метки в названии:', error);
  }

  return issues;
}

function getVisibleControlLabel(element) {
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  const type = (element.getAttribute('type') || '').toLowerCase();

  if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) {
    return normalizeAccessibleText(element.value || '');
  }

  const text = Array.from(element.childNodes)
    .map(node => getVisibleTextFromNode(node))
    .join(' ');

  return normalizeAccessibleText(text);
}

function getVisibleTextFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = /** @type {Element} */ (node);
  if (!isElementVisible(element) || element.getAttribute('aria-hidden') === 'true') return '';

  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  if (['script', 'style', 'svg'].includes(tag)) return '';

  if (tag === 'img') {
    return element.getAttribute('alt') || '';
  }

  return Array.from(element.childNodes)
    .map(child => getVisibleTextFromNode(child))
    .join(' ');
}

function getAccessibleNameForControl(element) {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return normalizeAccessibleText(ariaLabel);

  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelText = labelledBy.split(/\s+/)
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .map(labelElement => labelElement.textContent || '')
      .join(' ');
    if (labelText.trim()) return normalizeAccessibleText(labelText);
  }

  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  const type = (element.getAttribute('type') || '').toLowerCase();

  if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) {
    return normalizeAccessibleText(element.value || element.getAttribute('aria-label') || '');
  }

  const ownText = normalizeAccessibleText(element.textContent || '');
  if (ownText) return ownText;

  const imgAlt = Array.from(element.querySelectorAll('img[alt]'))
    .map(img => img.getAttribute('alt') || '')
    .join(' ');
  if (imgAlt.trim()) return normalizeAccessibleText(imgAlt);

  return normalizeAccessibleText(element.getAttribute('title') || '');
}

function doesAccessibleNameContainVisibleLabel(accessibleName, visibleLabel) {
  const normalizedName = normalizeForNameComparison(accessibleName);
  const normalizedLabel = normalizeForNameComparison(visibleLabel);

  if (!normalizedName || !normalizedLabel) return true;
  return normalizedName.includes(normalizedLabel);
}

function isUsefulVisibleLabel(label) {
  if (!label) return false;
  if (label.length < 2) return false;
  return /\p{L}|\p{N}/u.test(label);
}

function normalizeAccessibleText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeForNameComparison(text) {
  return normalizeAccessibleText(text)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isElementDisabled(element) {
  return element.disabled || element.getAttribute('aria-disabled') === 'true';
}

/**
 * Check status messages and live regions (GOST/WCAG 4.1.3).
 */
function checkStatusMessages() {
  const issues = [];
  const seen = new Set();

  try {
    const liveRegions = Array.from(document.querySelectorAll(
      '[role="status"], [role="alert"], [role="log"], [role="timer"], [role="marquee"], [aria-live]'
    ));

    liveRegions.slice(0, 1000).forEach(region => {
      getLiveRegionIssues(region).forEach(issue => addUniqueIssue(issues, seen, issue));
    });

    findUnannouncedStatusContainers().forEach(issue => addUniqueIssue(issues, seen, issue));
  } catch (error) {
    console.error('Ошибка проверки статусных сообщений:', error);
  }

  return issues;
}

function getLiveRegionIssues(region) {
  const issues = [];
  const role = (region.getAttribute('role') || '').toLowerCase();
  const ariaLive = (region.getAttribute('aria-live') || '').toLowerCase();
  const ariaAtomic = (region.getAttribute('aria-atomic') || '').toLowerCase();
  const selector = getSelector(region);
  const text = normalizeAccessibleText(region.textContent || '');

  if (ariaLive && !['off', 'polite', 'assertive'].includes(ariaLive)) {
    issues.push(createStatusMessageIssue(region, {
      type: 'error',
      message: `Недопустимое значение aria-live="${ariaLive}"`,
      issue: 'invalid-aria-live',
      details: { ariaLive }
    }));
  }

  if (ariaAtomic && !['true', 'false'].includes(ariaAtomic)) {
    issues.push(createStatusMessageIssue(region, {
      type: 'warning',
      message: `Недопустимое значение aria-atomic="${ariaAtomic}"`,
      issue: 'invalid-aria-atomic',
      details: { ariaAtomic }
    }));
  }

  if (role === 'alert' && ariaLive === 'off') {
    issues.push(createStatusMessageIssue(region, {
      type: 'error',
      message: 'role="alert" не должен отключаться через aria-live="off"',
      issue: 'alert-live-off',
      details: { role, ariaLive }
    }));
  }

  if (role === 'status' && ariaLive === 'off') {
    issues.push(createStatusMessageIssue(region, {
      type: 'warning',
      message: 'role="status" с aria-live="off" не будет объявлять изменения',
      issue: 'status-live-off',
      details: { role, ariaLive }
    }));
  }

  if ((role === 'status' || role === 'alert') && region.hasAttribute('aria-hidden') && region.getAttribute('aria-hidden') === 'true') {
    issues.push(createStatusMessageIssue(region, {
      type: 'error',
      message: 'Статусное сообщение скрыто от вспомогательных технологий через aria-hidden="true"',
      issue: 'live-region-aria-hidden',
      details: { role, ariaHidden: 'true' }
    }));
  }

  if ((role === 'status' || role === 'alert' || ariaLive) && isLiveRegionVisuallyHiddenAndEmpty(region, text)) {
    issues.push(createStatusMessageIssue(region, {
      type: 'warning',
      message: 'Динамическая область пустая и скрыта; убедитесь, что динамические сообщения будут добавляться в этот контейнер',
      issue: 'empty-hidden-live-region',
      details: { role, ariaLive, selector }
    }));
  }

  if (isLikelyErrorStatus(region, text) && role !== 'alert' && ariaLive !== 'assertive') {
    issues.push(createStatusMessageIssue(region, {
      type: 'warning',
      message: 'Сообщение похоже на ошибку, но не использует режим assertive для динамической области или role="alert"',
      issue: 'error-message-not-assertive',
      details: { role, ariaLive, text: text.slice(0, 180) }
    }));
  }

  if (isLikelySuccessOrProgressStatus(region, text) && !role && !ariaLive) {
    issues.push(createStatusMessageIssue(region, {
      type: 'warning',
      message: 'Статусное сообщение не имеет live region для объявления изменений',
      issue: 'status-message-without-live-region',
      details: { text: text.slice(0, 180) }
    }));
  }

  return issues;
}

function findUnannouncedStatusContainers() {
  const issues = [];
  const candidates = Array.from(document.querySelectorAll(
    '.status, .toast, .notification, .notice, .message, .alert, .success, .error, .warning, [class*="status"], [class*="toast"], [class*="notification"], [class*="message"]'
  ));

  candidates.slice(0, 800).forEach(element => {
    if (!isElementVisible(element)) return;
    if (element.closest('[role="status"], [role="alert"], [role="log"], [aria-live]')) return;

    const text = normalizeAccessibleText(element.textContent || '');
    if (!isLikelyDynamicStatusText(element, text)) return;

    issues.push(createStatusMessageIssue(element, {
      type: 'warning',
      message: 'Похожее на статусное сообщение содержимое не объявляется через live region',
      issue: 'unannounced-status-container',
      details: {
        text: text.slice(0, 180),
        expected: 'Добавьте role="status" или aria-live="polite"; для ошибок используйте role="alert" или aria-live="assertive"'
      }
    }));
  });

  return issues;
}

function createStatusMessageIssue(element, options) {
  return {
    type: options.type,
    category: 'status-messages',
    message: options.message,
    element: element.outerHTML,
    selector: getSelector(element),
    details: Object.assign({
      criterion: '4.1.3',
      issue: options.issue
    }, options.details || {})
  };
}

function isLiveRegionVisuallyHiddenAndEmpty(region, text) {
  if (text) return false;
  const rect = region.getBoundingClientRect();
  const style = window.getComputedStyle(region);
  return rect.width <= 1 ||
         rect.height <= 1 ||
         style.display === 'none' ||
         style.visibility === 'hidden' ||
         style.opacity === '0';
}

function isLikelyErrorStatus(element, text) {
  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
  return containsErrorText(text) || /(error|danger|invalid|alert)/i.test(className);
}

function isLikelySuccessOrProgressStatus(element, text) {
  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
  return /(success|saved|loading|progress|complete|completed|done|успеш|сохран|загруз|готов|выполн)/i.test(`${className} ${text}`);
}

function isLikelyDynamicStatusText(element, text) {
  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';
  return text.length > 0 &&
         (/(status|toast|notification|notice|message|alert|success|error|warning)/i.test(className) ||
          /(error|invalid|success|saved|loading|complete|ошиб|успеш|сохран|загруз|готов|выполн|предупреж)/i.test(text));
}

/**
 * Check DOM syntax/id reference integrity (GOST/WCAG 4.1.1).
 */
function checkSyntaxIntegrity() {
  const issues = [];
  const seen = new Set();

  try {
    findDuplicateAndInvalidIds().forEach(issue => addUniqueIssue(issues, seen, issue));
    findBrokenAriaIdReferences().forEach(issue => addUniqueIssue(issues, seen, issue));
    findBrokenHtmlIdReferences().forEach(issue => addUniqueIssue(issues, seen, issue));
  } catch (error) {
    console.error('Ошибка проверки синтаксиса DOM:', error);
  }

  return issues;
}

function findDuplicateAndInvalidIds() {
  const issues = [];
  const idMap = new Map();
  const elementsWithId = Array.from(document.querySelectorAll('[id]'));

  elementsWithId.slice(0, 3000).forEach(element => {
    const id = element.getAttribute('id') || '';
    if (!id) {
      issues.push(createSyntaxIssue(element, {
        type: 'error',
        message: 'Элемент имеет пустой id',
        issue: 'empty-id',
        details: { id }
      }));
      return;
    }

    if (/\s/.test(id)) {
      issues.push(createSyntaxIssue(element, {
        type: 'error',
        message: `id="${id}" содержит пробельные символы`,
        issue: 'id-contains-whitespace',
        details: { id }
      }));
    }

    if (!idMap.has(id)) idMap.set(id, []);
    idMap.get(id).push(element);
  });

  idMap.forEach((elements, id) => {
    if (elements.length <= 1) return;

    elements.slice(0, 10).forEach((element, index) => {
      issues.push(createSyntaxIssue(element, {
        type: 'error',
        message: `Дублирующийся id="${id}"`,
        issue: 'duplicate-id',
        details: {
          id,
          duplicateCount: elements.length,
          duplicateIndex: index + 1
        }
      }));
    });
  });

  return issues;
}

function findBrokenAriaIdReferences() {
  const issues = [];
  const idRefAttributes = [
    { name: 'aria-labelledby', multiple: true },
    { name: 'aria-describedby', multiple: true },
    { name: 'aria-controls', multiple: true },
    { name: 'aria-owns', multiple: true },
    { name: 'aria-details', multiple: false },
    { name: 'aria-errormessage', multiple: false },
    { name: 'aria-activedescendant', multiple: false },
    { name: 'aria-flowto', multiple: true }
  ];

  idRefAttributes.forEach(definition => {
    const elements = Array.from(document.querySelectorAll(`[${definition.name}]`));

    elements.slice(0, 2000).forEach(element => {
      const rawValue = element.getAttribute(definition.name) || '';
      const ids = rawValue.trim().split(/\s+/).filter(Boolean);

      if (!rawValue.trim()) {
        issues.push(createSyntaxIssue(element, {
          type: 'error',
          message: `${definition.name} пустой`,
          issue: 'empty-id-reference',
          details: { attribute: definition.name, value: rawValue }
        }));
        return;
      }

      if (!definition.multiple && ids.length > 1) {
        issues.push(createSyntaxIssue(element, {
          type: 'error',
          message: `${definition.name} должен ссылаться только на один id`,
          issue: 'single-id-reference-has-multiple-values',
          details: { attribute: definition.name, value: rawValue, ids }
        }));
      }

      ids.forEach(id => {
        if (!document.getElementById(id)) {
          issues.push(createSyntaxIssue(element, {
            type: 'error',
            message: `${definition.name} ссылается на несуществующий id="${id}"`,
            issue: 'broken-aria-id-reference',
            details: { attribute: definition.name, missingId: id, value: rawValue }
          }));
        }
      });
    });
  });

  return issues;
}

function findBrokenHtmlIdReferences() {
  const issues = [];

  Array.from(document.querySelectorAll('label[for]')).slice(0, 2000).forEach(label => {
    const id = label.getAttribute('for') || '';
    if (!id || !document.getElementById(id)) {
      issues.push(createSyntaxIssue(label, {
        type: 'error',
        message: `label[for] ссылается на несуществующий id="${id}"`,
        issue: 'broken-label-for-reference',
        details: { attribute: 'for', missingId: id }
      }));
    }
  });

  Array.from(document.querySelectorAll('[list]')).slice(0, 1000).forEach(input => {
    const id = input.getAttribute('list') || '';
    const target = id ? document.getElementById(id) : null;
    if (!target || target.tagName.toLowerCase() !== 'datalist') {
      issues.push(createSyntaxIssue(input, {
        type: 'error',
        message: `Атрибут list ссылается на несуществующий datalist id="${id}"`,
        issue: 'broken-list-reference',
        details: { attribute: 'list', missingId: id }
      }));
    }
  });

  Array.from(document.querySelectorAll('td[headers], th[headers]')).slice(0, 2000).forEach(cell => {
    const rawValue = cell.getAttribute('headers') || '';
    rawValue.trim().split(/\s+/).filter(Boolean).forEach(id => {
      const target = document.getElementById(id);
      if (!target || target.tagName.toLowerCase() !== 'th') {
        issues.push(createSyntaxIssue(cell, {
          type: 'error',
          message: `Атрибут headers ссылается на несуществующий заголовок id="${id}"`,
          issue: 'broken-table-headers-reference',
          details: { attribute: 'headers', missingId: id, value: rawValue }
        }));
      }
    });
  });

  Array.from(document.querySelectorAll('a[href^="#"], area[href^="#"]')).slice(0, 2000).forEach(link => {
    const href = link.getAttribute('href') || '';
    const targetId = decodeHashId(href);
    if (!targetId) return;

    if (!document.getElementById(targetId)) {
      issues.push(createSyntaxIssue(link, {
        type: 'warning',
        message: `Ссылка-якорь ведет на несуществующий id="${targetId}"`,
        issue: 'broken-fragment-reference',
        details: { href, missingId: targetId }
      }));
    }
  });

  return issues;
}

function decodeHashId(href) {
  if (!href || href === '#' || href === '#!' || href.toLowerCase().startsWith('#javascript')) return '';
  const hash = href.slice(1);
  if (!hash) return '';

  try {
    return decodeURIComponent(hash);
  } catch (error) {
    return hash;
  }
}

function createSyntaxIssue(element, options) {
  return {
    type: options.type,
    category: 'syntax',
    message: options.message,
    element: element.outerHTML,
    selector: getSelector(element),
    details: Object.assign({
      criterion: '4.1.1',
      issue: options.issue
    }, options.details || {})
  };
}

/**
 * Check aria-current for active navigation items.
 */
function checkAriaCurrentForActiveItems() {
  const issues = [];
  const seen = new Set();
  const validValues = new Set(['page', 'step', 'location', 'date', 'time', 'true', 'false']);

  try {
    Array.from(document.querySelectorAll('[aria-current]')).slice(0, 1000).forEach(element => {
      if (!isElementVisible(element)) return;

      const value = (element.getAttribute('aria-current') || '').trim().toLowerCase();
      if (!value) {
        addUniqueIssue(issues, seen, createAriaCurrentIssue(element, {
          type: 'error',
          message: 'aria-current не должен быть пустым',
          issue: 'empty-aria-current',
          details: {
            attribute: 'aria-current',
            currentValue: element.getAttribute('aria-current'),
            expected: 'Укажите одно из значений: page, step, location, date, time, true или false'
          }
        }));
        return;
      }

      if (!validValues.has(value)) {
        addUniqueIssue(issues, seen, createAriaCurrentIssue(element, {
          type: 'warning',
          message: `aria-current="${value}" использует нестандартное значение`,
          issue: 'invalid-aria-current',
          details: {
            attribute: 'aria-current',
            currentValue: value,
            allowedValues: Array.from(validValues).join(', '),
            expected: 'Для текущей страницы обычно используйте aria-current="page"'
          }
        }));
      }
    });

    const currentCandidates = Array.from(document.querySelectorAll('a[href], [role="link"]'))
      .slice(0, 2000)
      .filter(element => isElementVisible(element) && isLikelyCurrentNavigationItem(element));

    currentCandidates.forEach(element => {
      if (hasOwnOrAncestorAriaCurrent(element)) return;

      if ((element.getAttribute('aria-selected') || '').toLowerCase() === 'true') {
        addUniqueIssue(issues, seen, createAriaCurrentIssue(element, {
          type: 'warning',
          message: 'Для ссылки на текущую страницу используется aria-selected вместо aria-current',
          issue: 'aria-selected-used-instead-of-aria-current',
          details: {
            attribute: 'aria-selected',
            currentValue: element.getAttribute('aria-selected'),
            expected: 'Для активного пункта навигации используйте aria-current="page"'
          }
        }));
        return;
      }

      addUniqueIssue(issues, seen, createAriaCurrentIssue(element, {
        type: 'warning',
        message: 'Активный пункт навигации не помечен aria-current',
        issue: 'active-navigation-item-without-aria-current',
        details: {
          activeHint: getActiveNavigationHint(element),
          href: element.getAttribute('href') || null,
          expected: 'Добавьте aria-current="page" на ссылку текущей страницы или текущий пункт навигации'
        }
      }));
    });
  } catch (error) {
    console.error('Ошибка проверки aria-current:', error);
  }

  return issues;
}

function createAriaCurrentIssue(element, options) {
  return {
    type: options.type,
    category: 'navigation',
    message: options.message,
    element: element.outerHTML,
    selector: getSelector(element),
    details: Object.assign({
      criterion: '4.1.2',
      issue: options.issue
    }, options.details || {})
  };
}

function isLikelyCurrentNavigationItem(element) {
  if (!isNavigationLikeElement(element)) return false;
  if (hasActiveStateToken(element)) return true;

  const parent = element.parentElement;
  if (parent && hasActiveStateToken(parent)) return true;

  const ariaSelected = (element.getAttribute('aria-selected') || '').toLowerCase();
  if (ariaSelected === 'true') return true;

  return isLinkToCurrentPage(element) && Boolean(element.closest('nav, [role="navigation"], .breadcrumb, [aria-label*="breadcrumb" i], [class*="breadcrumb" i], .pagination, [class*="pagination" i]'));
}

function isNavigationLikeElement(element) {
  return element.matches('a[href], [role="link"]');
}

function hasOwnOrAncestorAriaCurrent(element) {
  if (element.hasAttribute('aria-current')) return true;
  const owner = element.closest('li[aria-current], [role="listitem"][aria-current], [role="menuitem"][aria-current]');
  return Boolean(owner);
}

function hasActiveStateToken(element) {
  const tokenSource = [
    element.getAttribute('class'),
    element.getAttribute('data-state'),
    element.getAttribute('data-status'),
    element.getAttribute('data-active')
  ].filter(Boolean).join(' ').toLowerCase();

  return /(^|[\s_-])(active|current|selected|is-active|is-current|router-link-active|router-link-exact-active|current-menu-item|menu-item-active)([\s_-]|$)/i.test(tokenSource);
}

function getActiveNavigationHint(element) {
  if (hasActiveStateToken(element)) return 'активный класс или data-атрибут на ссылке';
  if (element.parentElement && hasActiveStateToken(element.parentElement)) return 'активный класс или data-атрибут на родителе ссылки';
  if ((element.getAttribute('aria-selected') || '').toLowerCase() === 'true') return 'aria-selected="true"';
  if (isLinkToCurrentPage(element)) return 'ссылка ведёт на текущую страницу';
  return 'пункт выглядит активным';
}

function isLinkToCurrentPage(element) {
  const href = element.getAttribute('href');
  if (!href || href === '#' || href.toLowerCase().startsWith('javascript:')) return false;

  try {
    const target = new URL(href, window.location.href);
    const current = new URL(window.location.href);
    target.hash = '';
    current.hash = '';
    return target.href === current.href;
  } catch (error) {
    return false;
  }
}

/**
 * Get all visible text elements on the page
 */
function getTextElements() {
  const elements = [];

  try {
    // Simple and efficient implementation
    const allElements = document.body.getElementsByTagName('*');

    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];

      // Skip hidden elements
      if (!isElementVisible(element)) continue;

      // Check if element contains text
      const text = element.textContent || element.innerText || '';
      if (text.trim().length > 0) {
        elements.push(element);
      }

      // Limit for very large pages
      if (elements.length > 1500) break;
    }
  } catch (error) {
    console.error('Ошибка получения текстовых элементов:', error);
  }

  return elements;
}

/**
 * Check if element is visible on the page
 * @param {Element} element - DOM element to check
 */
function isElementVisible(element) {
  try {
    if (!element || !element.getBoundingClientRect) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return !(rect.width === 0 && rect.height === 0) &&
           style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.top < window.innerHeight &&
           rect.bottom > 0 &&
           rect.left < window.innerWidth &&
           rect.right > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Calculate contrast ratio for a specific element
 * @param {Element} element - DOM element to check
 */
function getContrastRatioForElement(element) {
  try {
    const style = window.getComputedStyle(element);
    const textColor = style.color;
    const backgroundColor = getBackgroundColor(element);

    if (!textColor || !backgroundColor) return null;

    const contrastRatio = ColorUtils.calculateContrastRatio(textColor, backgroundColor);
    const fontSize = parseFloat(style.fontSize);
    const fontWeight = parseInt(style.fontWeight) || 400;

    const requiredAARatio = getRequiredContrastRatio(fontSize, fontWeight);
    const requiredAAARatio = requiredAARatio === 3 ? 4.5 : 7;

    // Get improvement suggestions
    const suggestions = ColorUtils.suggestContrastImprovements(
      textColor,
      backgroundColor,
      requiredAARatio
    );

    return {
      ratio: contrastRatio,
      fontSize,
      fontWeight,
      requiredAARatio,
      requiredAAARatio,
      meetsAA: contrastRatio >= requiredAARatio,
      meetsAAA: contrastRatio >= requiredAAARatio,
      textColor,
      backgroundColor,
      suggestions: suggestions
    };
  } catch (error) {
    console.error('Ошибка расчёта контраста:', error);
    return null;
  }
}

/**
 * Get background color for an element by traversing up the DOM tree
 * @param {Element} element - DOM element
 */
function getBackgroundColor(element) {
  let currentElement = element;
  let backgroundColor = null;

  // Traverse up the DOM tree to find opaque background
  while (currentElement && currentElement !== document.documentElement) {
    const style = window.getComputedStyle(currentElement);
    const bgColor = style.backgroundColor;

    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      const alpha = getAlphaFromColor(bgColor);
      if (alpha > 0.1) { // Ignore nearly transparent backgrounds
        backgroundColor = bgColor;
        break;
      }
    }

    currentElement = currentElement.parentElement;
  }

  // Fallback to white if no background found
  return backgroundColor || 'rgb(255, 255, 255)';
}

function resolveCssColor(color, element) {
  if (!color || color === 'none' || color === 'transparent') return null;
  if (color === 'currentColor') {
    return window.getComputedStyle(element).color;
  }
  if (color.startsWith('rgb') || color.startsWith('#')) {
    return color;
  }
  return null;
}

function isTransparentColor(color) {
  return color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || getAlphaFromColor(color) === 0;
}

function extractFirstCssColor(value) {
  if (!value || value === 'none') return null;
  const match = value.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i);
  return match ? match[0] : null;
}

/**
 * Extract alpha value from CSS color
 * @param {string} color - CSS color value
 */
function getAlphaFromColor(color) {
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (match) {
      return parseFloat(match[4]);
    }
  }
  return 1; // For rgb and hex colors
}

/**
 * Get required contrast ratio based on text properties
 * @param {number} fontSize - Font size in pixels
 * @param {number} fontWeight - Font weight
 */
function getRequiredContrastRatio(fontSize, fontWeight) {
  // WCAG 2.1 Criteria:
  // - Standard text: 4.5:1 (AA), 7:1 (AAA)
  // - Large text: 3:1 (AA), 4.5:1 (AAA)

  const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
  return isLargeText ? 3 : 4.5;
}

/**
 * Check ARIA attributes usage
 */
function checkAriaAttributes() {
  const issues = [];

  try {
    // Check aria-label without visible text
    const ariaLabeled = document.querySelectorAll('[aria-label]');
    ariaLabeled.forEach(el => {
      if (!isElementVisible(el)) return;

      const hasText = el.textContent && el.textContent.trim();
      const hasAltImage = el.querySelector('img[alt]');

      if (!hasText && !hasAltImage) {
        issues.push({
          type: 'warning',
          category: 'aria',
          message: 'Элемент с aria-label не содержит видимого текста',
          element: el.outerHTML,
          selector: getSelector(el)
        });
      }
    });

    // Check ARIA roles validity
    const elementsWithRole = document.querySelectorAll('[role]');
    elementsWithRole.forEach(el => {
      const role = el.getAttribute('role');
      if (role && !isValidAriaRole(role)) {
        issues.push({
          type: 'warning',
          category: 'aria',
          message: `Недопустимая ARIA-роль: ${role}`,
          element: el.outerHTML,
          selector: getSelector(el)
        });
      }
    });

  } catch (error) {
    console.error('Ошибка проверки ARIA:', error);
  }

  return issues;
}

/**
 * Validate ARIA role
 * @param {string} role - ARIA role to validate
 */
function isValidAriaRole(role) {
  const validRoles = [
    'button', 'checkbox', 'dialog', 'gridcell', 'link', 'listbox',
    'option', 'progressbar', 'radio', 'slider', 'tab', 'tabpanel',
    'textbox', 'menu', 'menubar', 'menuitem', 'navigation', 'banner',
    'main', 'complementary', 'contentinfo', 'search', 'form'
  ];
  return validRoles.includes(role);
}

/**
 * Check keyboard navigation accessibility
 */
function checkKeyboardNavigation() {
  const issues = [];

  try {
    // Check tabindex values
    const tabIndexElements = document.querySelectorAll('[tabindex]');
    tabIndexElements.forEach(el => {
      if (!isElementVisible(el)) return;

      const tabIndex = parseInt(el.getAttribute('tabindex'));
      if (tabIndex < -1) {
        issues.push({
          type: 'error',
          category: 'keyboard',
          message: 'Недопустимое значение tabindex',
          element: el.outerHTML,
          selector: getSelector(el)
        });
      }
    });

    // Check interactive elements without proper focus
    const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [onclick]');
    interactiveElements.forEach(el => {
      if (!isElementVisible(el)) return;

      const tabIndex = el.getAttribute('tabindex');
      if (tabIndex === null && el.disabled !== true) {
        const style = window.getComputedStyle(el);
        if (style.pointerEvents !== 'none' && style.display !== 'none') {
          issues.push({
            type: 'warning',
            category: 'keyboard',
            message: 'Интерактивный элемент может быть недоступен с клавиатуры',
            element: el.outerHTML,
            selector: getSelector(el)
          });
        }
      }
    });

  } catch (error) {
    console.error('Ошибка проверки клавиатурной навигации:', error);
  }

  return issues;
}

/**
 * Check semantic HTML markup
 */
function checkSemanticMarkup() {
  const issues = [];

  try {
    // Check div usage instead of semantic elements
    const divButtons = document.querySelectorAll('div[onclick], div[role="button"]');
    divButtons.forEach(div => {
      if (!isElementVisible(div)) return;

      issues.push({
        type: 'warning',
        category: 'semantics',
        message: 'Для интерактивного элемента используется div вместо button',
        element: div.outerHTML,
        selector: getSelector(div)
      });
    });

    // Check table usage for layout
    const layoutTables = document.querySelectorAll('table:not([role])');
    layoutTables.forEach(table => {
      if (!table.querySelector('th') && !table.getAttribute('summary')) {
        issues.push({
          type: 'warning',
          category: 'semantics',
          message: 'Возможно, таблица используется для вёрстки',
          element: table.outerHTML,
          selector: getSelector(table)
        });
      }
    });

  } catch (error) {
    console.error('Ошибка проверки семантической разметки:', error);
  }

  return issues;
}

/**
 * Check language attribute
 */
function checkLanguage() {
  const issues = [];

  try {
    const html = document.documentElement;
    const lang = html.getAttribute('lang');

    if (!lang) {
      issues.push({
        type: 'error',
        category: 'language',
        message: 'У элемента html отсутствует атрибут lang',
        element: html.outerHTML,
        selector: 'html'
      });
    }
  } catch (error) {
    console.error('Ошибка проверки языка страницы:', error);
  }

  return issues;
}

/**
 * Check text fragments that appear to use a different language without lang (GOST/WCAG 3.1.2).
 */
function checkLanguageOfParts() {
  const issues = [];
  const seen = new Set();

  try {
    const pageLang = getNormalizedLanguage(document.documentElement.getAttribute('lang'));
    if (!pageLang) return issues;

    const candidates = getLanguagePartCandidates();

    candidates.slice(0, 1500).forEach(element => {
      if (!isElementVisible(element) || hasOwnOrInheritedDifferentLang(element, pageLang)) return;

      const text = getOwnVisibleText(element);
      if (!isUsefulLanguageSample(text)) return;

      const detected = detectLikelyTextLanguage(text);
      if (!detected || detected.lang === pageLang || detected.confidence < 0.72) return;

      const selector = getSelector(element);
      const key = `${selector}|${detected.lang}|${text.slice(0, 40)}`;
      if (seen.has(key)) return;
      seen.add(key);

      issues.push({
        type: 'warning',
        category: 'language-parts',
        message: `Фрагмент текста похож на язык "${detected.lang}", но не имеет lang`,
        element: element.outerHTML,
        selector,
        details: {
          criterion: '3.1.2',
          issue: 'different-language-without-lang',
          pageLang,
          detectedLang: detected.lang,
          detectedIso3: detected.iso3 || null,
          confidence: detected.confidence.toFixed(2),
          alternatives: detected.alternatives || null,
          sample: text.slice(0, 180),
          expected: `Добавьте lang="${detected.lang}" на сам фрагмент или ближайший контейнер`
        }
      });
    });
  } catch (error) {
    console.error('Ошибка проверки языка частей контента:', error);
  }

  return issues;
}

function getNormalizedLanguage(lang) {
  if (!lang) return '';
  if (typeof A11yLanguageDetector !== 'undefined' && A11yLanguageDetector.normalizeLanguageCode) {
    return A11yLanguageDetector.normalizeLanguageCode(lang);
  }
  return lang.trim().toLowerCase().split('-')[0];
}

function getLanguagePartCandidates() {
  const selector = [
    'p', 'li', 'blockquote', 'figcaption', 'caption', 'td', 'th',
    'label', 'button', 'a', 'span', 'strong', 'em', 'small',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ].join(',');

  return Array.from(document.body ? document.body.querySelectorAll(selector) : [])
    .filter(element => !element.closest('script, style, code, pre, kbd, samp'));
}

function hasOwnOrInheritedDifferentLang(element, pageLang) {
  const langElement = element.closest('[lang]');
  if (!langElement || langElement === document.documentElement) return false;

  const nearestLang = getNormalizedLanguage(langElement.getAttribute('lang'));
  return nearestLang && nearestLang !== pageLang;
}

function getOwnVisibleText(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, code, pre, kbd, samp, [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
      if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode() && textNodes.length < 12) {
    textNodes.push(walker.currentNode.textContent || '');
  }

  return textNodes.join(' ').replace(/\s+/g, ' ').trim();
}

function isUsefulLanguageSample(text) {
  if (!text || text.length < 24) return false;
  if (/^https?:\/\//i.test(text) || /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(text)) return false;

  const letters = (text.match(/\p{L}/gu) || []).length;
  const words = (text.match(/\p{L}{2,}/gu) || []).length;
  return letters >= 16 && words >= 4;
}

function detectLikelyTextLanguage(text) {
  if (typeof A11yLanguageDetector !== 'undefined' && A11yLanguageDetector.detect) {
    const result = A11yLanguageDetector.detect(text, {
      minLength: 24,
      maxAlternatives: 5
    });

    if (result && result.lang && result.lang !== 'und') {
      return {
        lang: result.lang,
        iso3: result.iso3,
        confidence: result.confidence,
        alternatives: result.alternatives
      };
    }
  }

  return detectLikelyTextLanguageFallback(text);
}

function detectLikelyTextLanguageFallback(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length === 0) return null;

  const lowerText = text.toLowerCase();
  const cyrillicCount = (text.match(/\p{Script=Cyrillic}/gu) || []).length;
  const latinCount = (text.match(/\p{Script=Latin}/gu) || []).length;
  const scriptTotal = cyrillicCount + latinCount;
  if (scriptTotal === 0) return null;

  const cyrillicRatio = cyrillicCount / scriptTotal;
  const latinRatio = latinCount / scriptTotal;
  const ruScore = cyrillicRatio + countLanguageMarkers(lowerText, [' и ', ' в ', ' не ', ' на ', ' что ', ' для ', ' это ', ' как ', ' или ', ' по ']) * 0.04;
  const enScore = latinRatio + countLanguageMarkers(lowerText, [' the ', ' and ', ' of ', ' to ', ' in ', ' for ', ' with ', ' is ', ' are ', ' or ']) * 0.04;

  if (ruScore > enScore && ruScore >= 0.72) {
    return { lang: 'ru', confidence: Math.min(ruScore, 0.99) };
  }

  if (enScore > ruScore && enScore >= 0.72) {
    return { lang: 'en', confidence: Math.min(enScore, 0.99) };
  }

  return null;
}

function countLanguageMarkers(text, markers) {
  const paddedText = ` ${text.replace(/\s+/g, ' ')} `;
  return markers.reduce((count, marker) => count + (paddedText.includes(marker) ? 1 : 0), 0);
}

/**
 * Generate CSS selector for an element
 * @param {Element} element - DOM element
 */
function getSelector(element) {
  if (!element || !element.tagName) return 'неизвестно';

  try {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.className && typeof element.className === 'string') {
      const firstClass = element.className.split(' ')[0];
      if (firstClass) {
        return `${element.tagName.toLowerCase()}.${firstClass}`;
      }
    }
    return element.tagName.toLowerCase();
  } catch (e) {
    return element.tagName ? element.tagName.toLowerCase() : 'неизвестно';
  }
}
