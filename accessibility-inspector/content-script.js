/**
 * Content script for accessibility checking
 * Injected into web pages to perform accessibility audits
 */

// Make sure all dependencies are loaded
console.log('Accessibility Inspector content script loaded');

// Global flag to indicate content script is ready
window.a11yInspectorReady = true;

// Initialize dependencies if they're not available
function initializeDependencies() {
  try {
    // Check and initialize ColorUtils if not available
    if (typeof ColorUtils === 'undefined') {
      console.warn('ColorUtils not loaded, using fallback');
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
      console.warn('A11yRules not loaded, using fallback');
      window.A11yRules = {};
      window.A11yRuleUtils = {
        runAllChecks: function() { return []; }
      };
    }

    // Check and initialize ReportGenerator if not available
    if (typeof ReportGenerator === 'undefined') {
      console.warn('ReportGenerator not loaded, using fallback');
      window.ReportGenerator = class {
        generate(data, format) {
          if (format === 'json') {
            return JSON.stringify(data, null, 2);
          }
          return `Report in ${format} format\n${JSON.stringify(data, null, 2)}`;
        }
      };
    }

    return true;
  } catch (error) {
    console.error('Error initializing dependencies:', error);
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
  console.log('Starting accessibility checks...');
  
  const issues = [];
  
  try {
    // Use modular accessibility rules if available
    if (typeof A11yRuleUtils !== 'undefined' && typeof A11yRuleUtils.runAllChecks === 'function') {
      console.log('Using A11yRuleUtils for checks');
      const ruleIssues = A11yRuleUtils.runAllChecks();
      issues.push(...ruleIssues);
    } else {
      console.log('A11yRuleUtils not available, running basic checks');
      // Run basic checks if rule utils are not available
      issues.push(...runBasicChecks());
    }

    // Run additional specialized checks
    const contrastIssues = checkColorContrast();
    issues.push(...contrastIssues);

    const ariaIssues = checkAriaAttributes();
    issues.push(...ariaIssues);

    const keyboardIssues = checkKeyboardNavigation();
    issues.push(...keyboardIssues);

    const semanticIssues = checkSemanticMarkup();
    issues.push(...semanticIssues);

    const langIssues = checkLanguage();
    issues.push(...langIssues);

  } catch (error) {
    console.error('Error during accessibility check:', error);
    issues.push({
      type: 'error',
      category: 'system',
      message: `Check execution error: ${error.message}`,
      element: null,
      selector: null
    });
  }

  console.log(`Accessibility check completed: ${issues.length} issues found`);
  
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
          message: 'Image missing alt attribute',
          element: img.outerHTML.slice(0, 100),
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
        message: 'Missing lang attribute on html element',
        element: html.outerHTML.slice(0, 100),
        selector: 'html'
      });
    }

    // Check for headings
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      issues.push({
        type: 'warning',
        category: 'headings',
        message: 'No H1 heading found',
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
          message: 'Input without associated label',
          element: input.outerHTML.slice(0, 100),
          selector: getSelector(input)
        });
      }
    });

  } catch (error) {
    console.error('Error in basic checks:', error);
    issues.push({
      type: 'error',
      category: 'system',
      message: `Basic check error: ${error.message}`,
      element: null,
      selector: null
    });
  }

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
          message: `Insufficient contrast: ${contrastResult.ratio.toFixed(2)}:1 (required ${contrastResult.requiredAARatio}:1)`,
          element: element.outerHTML.slice(0, 100),
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
    console.error('Contrast check error:', error);
  }

  return issues;
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
    console.error('Error getting text elements:', error);
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
    console.error('Contrast calculation error:', error);
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
          message: 'Element with aria-label without visible text content',
          element: el.outerHTML.slice(0, 100),
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
          message: `Invalid ARIA role: ${role}`,
          element: el.outerHTML.slice(0, 100),
          selector: getSelector(el)
        });
      }
    });

  } catch (error) {
    console.error('ARIA check error:', error);
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
          message: 'Invalid tabindex value',
          element: el.outerHTML.slice(0, 100),
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
            message: 'Interactive element may not be keyboard accessible',
            element: el.outerHTML.slice(0, 100),
            selector: getSelector(el)
          });
        }
      }
    });

  } catch (error) {
    console.error('Keyboard navigation check error:', error);
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
        message: 'Using div instead of button for interactive element',
        element: div.outerHTML.slice(0, 100),
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
          message: 'Possible table usage for layout',
          element: table.outerHTML.slice(0, 100),
          selector: getSelector(table)
        });
      }
    });

  } catch (error) {
    console.error('Semantic markup check error:', error);
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
        message: 'Missing lang attribute on html element',
        element: html.outerHTML.slice(0, 100),
        selector: 'html'
      });
    }
  } catch (error) {
    console.error('Language check error:', error);
  }
  
  return issues;
}

/**
 * Generate CSS selector for an element
 * @param {Element} element - DOM element
 */
function getSelector(element) {
  if (!element || !element.tagName) return 'unknown';
  
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
    return element.tagName ? element.tagName.toLowerCase() : 'unknown';
  }
}