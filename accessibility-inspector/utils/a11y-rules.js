/**
 * Accessibility rules definitions and utilities
 * Modular system for defining and applying accessibility checks
 */

// Main accessibility rules object
const A11yRules = {
  // Rules for checking images
  images: {
    missingAlt: {
      check: (img) => !img.hasAttribute('alt'),
      message: 'Image missing alt attribute',
      type: 'error',
      category: 'images'
    },
    emptyAlt: {
      check: (img) => img.getAttribute('alt') === '',
      message: 'Empty alt attribute (decorative image)',
      type: 'warning',
      category: 'images'
    },
    longAlt: {
      check: (img) => {
        const alt = img.getAttribute('alt');
        return alt && alt.length > 125;
      },
      message: 'Alt attribute too long (over 125 characters)',
      type: 'warning',
      category: 'images'
    }
  },

  // Rules for forms
  forms: {
    missingLabel: {
      check: (input) => {
        // Skip hidden inputs
        if (input.type === 'hidden') return false;
        
        // If input is inside label, it's acceptable
        if (input.closest('label')) return false;
        
        // Check for associated label
        if (input.id) {
          const label = document.querySelector(`label[for="${input.id}"]`);
          if (label) return false;
        }
        
        // Check for aria-label or aria-labelledby
        if (input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby')) {
          return false;
        }
        
        // Check for title attribute as fallback
        if (input.hasAttribute('title')) {
          return false;
        }
        
        return true;
      },
      message: 'Form field without associated label',
      type: 'error',
      category: 'forms'
    },
    missingFormLabel: {
      check: (form) => {
        const id = form.getAttribute('id');
        if (!id) return true;
        
        const label = document.querySelector(`label[for="${id}"]`);
        return !label;
      },
      message: 'Form without label',
      type: 'warning',
      category: 'forms'
    }
  },

  // Rules for navigation
  navigation: {
    missingSkipLinks: {
      check: () => {
        const skipLinks = document.querySelectorAll(
          'a[href^="#main"], a[href^="#content"], a[href^="#navigation"], ' +
          'a[href*="skip"], a[href*="Skip"], .skip-link, [class*="skip"]'
        );
        return skipLinks.length === 0;
      },
      message: 'Missing skip navigation links',
      type: 'warning',
      category: 'navigation'
    },
    missingLandmarks: {
      check: () => {
        const landmarks = document.querySelectorAll(
          'main, nav, aside, header, footer, section[aria-label], section[aria-labelledby], ' +
          '[role="main"], [role="navigation"], [role="complementary"], ' +
          '[role="banner"], [role="contentinfo"]'
        );
        return landmarks.length === 0;
      },
      message: 'Missing semantic landmarks (main, nav, aside, etc.)',
      type: 'warning',
      category: 'navigation'
    }
  },

  // Rules for links
  links: {
    emptyLink: {
      check: (link) => {
        const text = link.textContent.trim();
        const ariaLabel = link.getAttribute('aria-label');
        const title = link.getAttribute('title');
        
        return !text && !ariaLabel && !title;
      },
      message: 'Link without text content',
      type: 'error',
      category: 'links'
    },
    genericLinkText: {
      check: (link) => {
        const text = link.textContent.trim().toLowerCase();
        const genericTexts = ['click here', 'read more', 'here', 'link', 'learn more'];
        return genericTexts.includes(text);
      },
      message: 'Link with non-informative text',
      type: 'warning',
      category: 'links'
    }
  },

  // Rules for headings
  headings: {
    missingH1: {
      check: () => document.querySelectorAll('h1').length === 0,
      message: 'Missing H1 heading',
      type: 'error',
      category: 'headings'
    },
    headingOrder: {
      check: () => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        let lastLevel = 0;
        
        for (const heading of headings) {
          const level = parseInt(heading.tagName.substring(1));
          
          if (level > lastLevel + 1) {
            return true; // Hierarchy violation
          }
          
          lastLevel = level;
        }
        
        return false;
      },
      message: 'Heading hierarchy violation',
      type: 'warning',
      category: 'headings'
    }
  },

  // Rules for interactive elements
  interactive: {
    buttonWithoutLabel: {
      check: (button) => {
        const text = button.textContent.trim();
        const ariaLabel = button.getAttribute('aria-label');
        const title = button.getAttribute('title');
        const imgAlt = button.querySelector('img[alt]');
        
        return !text && !ariaLabel && !title && !imgAlt;
      },
      message: 'Button without text label',
      type: 'error',
      category: 'interactive'
    },
    focusableWithoutIndicator: {
      check: (element) => {
        const style = window.getComputedStyle(element);
        return style.outline === 'none' && style.outlineOffset === '0px';
      },
      message: 'Focusable element without visual focus indicator',
      type: 'warning',
      category: 'interactive'
    }
  }
};

// Utility functions for working with accessibility rules
const A11yRuleUtils = {
  /**
   * Apply rule to a set of elements
   * @param {Object} rule - Rule definition
   * @param {Array} elements - DOM elements to check
   * @param {boolean} filterVisible - Filter only visible elements
   */
  applyRuleToElements: function(rule, elements, filterVisible = true) {
    const issues = [];
    
    elements.forEach(element => {
      if (filterVisible && !this.isElementVisible(element)) return;
      
      if (rule.check(element)) {
        issues.push({
          type: rule.type,
          category: rule.category,
          message: rule.message,
          element: element.outerHTML.slice(0, 100),
          selector: this.getElementSelector(element)
        });
      }
    });
    
    return issues;
  },

  /**
   * Apply global rule (without specific element)
   * @param {Object} rule - Rule definition
   */
  applyGlobalRule: function(rule) {
    if (rule.check()) {
      return [{
        type: rule.type,
        category: rule.category,
        message: rule.message,
        element: null,
        selector: null
      }];
    }
    return [];
  },

  /**
   * Check if element is visible
   * @param {Element} element - DOM element
   */
  isElementVisible: function(element) {
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
  },

  /**
   * Generate CSS selector for element
   * @param {Element} element - DOM element
   */
  getElementSelector: function(element) {
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
  },

  /**
   * Run all accessibility checks
   */
  runAllChecks: function() {
    const issues = [];
    
    try {
      // Image checks
      const images = document.querySelectorAll('img');
      issues.push(...this.applyRuleToElements(A11yRules.images.missingAlt, images));
      issues.push(...this.applyRuleToElements(A11yRules.images.emptyAlt, images));
      issues.push(...this.applyRuleToElements(A11yRules.images.longAlt, images));
      
      // Form checks
      const formInputs = document.querySelectorAll('input, select, textarea');
      issues.push(...this.applyRuleToElements(A11yRules.forms.missingLabel, formInputs));
      
      const forms = document.querySelectorAll('form');
      issues.push(...this.applyRuleToElements(A11yRules.forms.missingFormLabel, forms));
      
      // Navigation checks (global rules)
      issues.push(...this.applyGlobalRule(A11yRules.navigation.missingSkipLinks));
      issues.push(...this.applyGlobalRule(A11yRules.navigation.missingLandmarks));
      
      // Link checks
      const links = document.querySelectorAll('a[href]');
      issues.push(...this.applyRuleToElements(A11yRules.links.emptyLink, links));
      issues.push(...this.applyRuleToElements(A11yRules.links.genericLinkText, links));
      
      // Heading checks (global rules)
      issues.push(...this.applyGlobalRule(A11yRules.headings.missingH1));
      issues.push(...this.applyGlobalRule(A11yRules.headings.headingOrder));
      
      // Interactive element checks
      const buttons = document.querySelectorAll('button, [role="button"]');
      issues.push(...this.applyRuleToElements(A11yRules.interactive.buttonWithoutLabel, buttons));
      
      const focusableElements = document.querySelectorAll(
        'button, [role="button"], a[href], input, select, textarea, [tabindex]'
      );
      issues.push(...this.applyRuleToElements(A11yRules.interactive.focusableWithoutIndicator, focusableElements));
      
    } catch (error) {
      console.error('Error running accessibility checks:', error);
    }
    
    return issues;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { A11yRules, A11yRuleUtils };
} else {
  window.A11yRules = A11yRules;
  window.A11yRuleUtils = A11yRuleUtils;
}