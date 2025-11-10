function runA11yChecks() {
  const issues = [];
  
  // Проверка альтернативных текстов для изображений
  const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
  imagesWithoutAlt.forEach(img => {
    issues.push({
      type: 'error',
      category: 'images',
      message: 'Изображение без атрибута alt',
      element: img.outerHTML.slice(0, 100),
      selector: getSelector(img)
    });
  });

  // Проверка заголовков
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    issues.push({
      type: 'warning',
      category: 'headings',
      message: 'На странице отсутствуют заголовки',
      element: null,
      selector: null
    });
  }

  // Проверка контрастности (упрощенная)
  const lowContrastElements = checkColorContrast();
  issues.push(...lowContrastElements);

  // Проверка ARIA атрибутов
  const ariaIssues = checkAriaAttributes();
  issues.push(...ariaIssues);

  // Проверка клавиатурной навигации
  const keyboardIssues = checkKeyboardNavigation();
  issues.push(...keyboardIssues);

  // Проверка семантической разметки
  const semanticIssues = checkSemanticMarkup();
  issues.push(...semanticIssues);

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

function getSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.className) {
    return `.${element.className.split(' ')[0]}`;
  }
  return element.tagName.toLowerCase();
}

function checkColorContrast() {
  const issues = [];
  // Упрощенная проверка контрастности
  const elements = document.querySelectorAll('*');
  elements.forEach(el => {
    const style = window.getComputedStyle(el);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // Здесь должна быть реальная проверка контрастности
    // Для демонстрации возвращаем пустой массив
  });
  return issues;
}

function checkAriaAttributes() {
  const issues = [];
  
  // Проверка aria-label без соответствующего видимого текста
  const ariaLabeled = document.querySelectorAll('[aria-label]');
  ariaLabeled.forEach(el => {
    if (!el.textContent.trim() && !el.querySelector('img[alt]')) {
      issues.push({
        type: 'warning',
        category: 'aria',
        message: 'Элемент с aria-label без видимого текстового содержимого',
        element: el.outerHTML.slice(0, 100),
        selector: getSelector(el)
      });
    }
  });

  return issues;
}

function checkKeyboardNavigation() {
  const issues = [];
  
  // Проверка элементов с tabindex
  const tabIndexElements = document.querySelectorAll('[tabindex]');
  tabIndexElements.forEach(el => {
    const tabIndex = parseInt(el.getAttribute('tabindex'));
    if (tabIndex < -1) {
      issues.push({
        type: 'error',
        category: 'keyboard',
        message: 'Некорректное значение tabindex',
        element: el.outerHTML.slice(0, 100),
        selector: getSelector(el)
      });
    }
  });

  return issues;
}

function checkSemanticMarkup() {
  const issues = [];
  
  // Проверка использования div вместо семантических элементов
  const divButtons = document.querySelectorAll('div[onclick], div[role="button"]');
  divButtons.forEach(div => {
    issues.push({
      type: 'warning',
      category: 'semantics',
      message: 'Использование div вместо button для интерактивного элемента',
      element: div.outerHTML.slice(0, 100),
      selector: getSelector(div)
    });
  });

  return issues;
}