(function(root) {
  'use strict';

  const MAX_ELEMENTS = 2500;
  const MAX_ISSUES = 40;
  let session = null;

  function getElements() {
    const elements = [];
    const pending = [document];
    while (pending.length && elements.length <= MAX_ELEMENTS) {
      const scope = pending.shift();
      for (const element of scope.querySelectorAll('*')) {
        if (elements.length > MAX_ELEMENTS) break;
        elements.push(element);
        if (element.shadowRoot) pending.push(element.shadowRoot);
      }
    }
    return elements;
  }

  function getParent(element) {
    return element.parentElement || element.getRootNode().host || null;
  }

  function isRendered(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  }

  function getTextRects(element) {
    const rects = [];
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      rects.push(...Array.from(range.getClientRects()).filter(rect => rect.width && rect.height));
    }
    return rects;
  }

  function getClipping(element, rects) {
    if (!rects.length) return false;
    let parent = element;
    while (parent && parent !== document.documentElement) {
      const style = getComputedStyle(parent);
      const clipX = ['hidden', 'clip'].includes(style.overflowX);
      const clipY = ['hidden', 'clip'].includes(style.overflowY);
      if (clipX || clipY) {
        const box = parent.getBoundingClientRect();
        const left = box.left + parent.clientLeft;
        const top = box.top + parent.clientTop;
        const right = left + parent.clientWidth;
        const bottom = top + parent.clientHeight;
        if (rects.some(rect => (clipX && (rect.left < left - 2 || rect.right > right + 2)) ||
          (clipY && (rect.top < top - 2 || rect.bottom > bottom + 2)))) return true;
      }
      parent = getParent(parent);
    }
    return false;
  }

  function getFocusStyle(element) {
    const style = getComputedStyle(element);
    const pseudoStyle = pseudo => {
      const computed = getComputedStyle(element, pseudo);
      return ['content', 'display', 'visibility', 'opacity', 'outline', 'border', 'backgroundColor', 'boxShadow', 'width', 'height', 'transform'].map(key => computed[key]).join('|');
    };
    return {
      outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor, boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor, color: style.color,
      border: style.border, textDecoration: style.textDecoration,
      before: pseudoStyle('::before'),
      after: pseudoStyle('::after')
    };
  }

  function getSelector(element) {
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let part = current.localName;
      if (current.id) part += '#' + CSS.escape(current.id);
      else if (current.parentElement) {
        part += `:nth-child(${Array.from(current.parentElement.children).indexOf(current) + 1})`;
      }
      parts.unshift(part);
      const parent = getParent(current);
      if (current.getRootNode().host && !current.parentElement) parts.unshift('>>>');
      current = parent;
    }
    return parts.join(' ');
  }

  function requireSession() {
    if (!session) throw new Error('Сценарная проверка не подготовлена');
    if (session.url !== location.href) throw new Error('Адрес страницы изменился во время сценарной проверки');
  }

  function prepare() {
    const sampled = getElements();
    const elements = sampled.slice(0, MAX_ELEMENTS);
    const active = getActiveElement();
    session = {
      url: location.href, scrollX, scrollY, active,
      elements, baseline: new Map(), fonts: [], nodes: new Map(),
      sampledElements: sampled.length,
      width: innerWidth, height: innerHeight
    };
    return captureBaseline();
  }

  function captureBaseline() {
    requireSession();
    session.baseline.clear();
    session.elements.forEach((element, index) => {
      session.nodes.set(element, index + 1);
      if (!isRendered(element)) return;
      const rects = getTextRects(element);
      session.baseline.set(element, {
        html: element.outerHTML, selector: getSelector(element),
        clipped: getClipping(element, rects),
        focusStyle: element.matches('a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]') ? getFocusStyle(element) : null
      });
    });
    return {
      url: session.url, width: innerWidth, height: innerHeight,
      vertical: getComputedStyle(document.documentElement).writingMode.startsWith('vertical'),
      elementLimitReached: session.sampledElements > MAX_ELEMENTS,
      limits: [{ id: 'scenario-elements', label: 'Элементы сценарного снимка', limit: MAX_ELEMENTS, total: session.sampledElements, totalIsLowerBound: session.sampledElements > MAX_ELEMENTS, processed: session.elements.length, truncated: session.sampledElements > MAX_ELEMENTS }]
    };
  }

  async function waitForLayout(width, height, timeoutMs = 2000) {
    const deadline = performance.now() + timeoutMs;
    let previous = null;
    do {
      const rect = getActiveElement()?.getBoundingClientRect();
      const signature = [innerWidth, innerHeight, document.documentElement.scrollWidth, document.documentElement.scrollHeight,
        rect?.x, rect?.y, rect?.width, rect?.height].join('|');
      const matches = (width === undefined || Math.abs(innerWidth - width) <= 2) && (height === undefined || Math.abs(innerHeight - height) <= 2);
      if (matches && document.readyState !== 'loading' && document.fonts.status !== 'loading' && previous === signature) return { matched: true };
      previous = signature;
      if (performance.now() >= deadline) throw new Error('Не удалось дождаться контрольного состояния layout');
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (true);
  }

  function createIssue(element, category, criterion, message, details) {
    const baseline = session.baseline.get(element);
    return {
      type: 'warning', outcome: 'incomplete', category,
      message: 'Требуется ручная проверка: ' + message,
      element: baseline ? baseline.html : element.outerHTML,
      selector: baseline ? baseline.selector : getSelector(element),
      details: {
        criterion,
        'Стандарты': criterion === '2.4.11' ? ['WCAG 2.2'] : ['WCAG 2.2', 'ГОСТ Р 52872-2019'],
        'Результат': 'Требуется ручная проверка',
        ...details
      }
    };
  }

  function inspectReflow(vertical) {
    requireSession();
    const expected = vertical ? 256 : 320;
    const actual = vertical ? innerHeight : innerWidth;
    if (Math.abs(actual - expected) > 2) throw new Error('Не удалось установить контрольный размер viewport');
    const issues = [];
    for (const element of session.elements) {
      if (issues.length >= MAX_ISSUES) break;
      if (!isRendered(element) || element.closest('pre, code, svg, canvas')) continue;
      const rects = getTextRects(element);
      if (!rects.length) continue;
      const baseline = session.baseline.get(element);
      const wideLine = rects.some(rect => (vertical ? rect.height : rect.width) > expected + 2);
      const clipped = getClipping(element, rects);
      if (!wideLine && (!clipped || baseline?.clipped)) continue;
      issues.push(createIssue(element, 'reflow', '1.4.10',
        wideLine ? 'строка текста не помещается в контрольную область' : 'текст обрезается после изменения viewport', {
          'Размер viewport': `${innerWidth} × ${innerHeight} CSS px`,
          'Признак проблемы': wideLine ? 'Слишком длинная строка' : 'Новое обрезание текста',
          'Ограничение': 'Проверьте потерю содержимого и применимые исключения для двумерного контента'
        }));
    }
    return { issues, issueLimitReached: issues.length >= MAX_ISSUES,
      limits: [{ id: 'reflow-issues', label: 'Замечания адаптации (нижняя граница)', limit: MAX_ISSUES, total: issues.length, processed: issues.length, truncated: issues.length >= MAX_ISSUES }] };
  }

  function beginTextResize() {
    requireSession();
    if (session.fonts.length) throw new Error('Увеличение текста уже выполняется');
    // Capture computed sizes before changing any ancestor to avoid compound scaling.
    const fonts = session.elements.filter(element => isRendered(element) &&
      !element.closest('svg, canvas, video, audio')).map(element => {
        const styleAttribute = element.getAttribute('style');
        return {
          element, styleAttribute, size: parseFloat(getComputedStyle(element).fontSize),
          value: element.style.getPropertyValue('font-size'),
          priority: element.style.getPropertyPriority('font-size'),
          clipped: getClipping(element, getTextRects(element))
        };
      });
    session.fonts = fonts;
    fonts.forEach(item => {
      if (Number.isFinite(item.size)) item.element.style.setProperty('font-size', `${item.size * 2}px`, 'important');
      item.appliedStyle = item.element.getAttribute('style');
    });
    return { changedElements: fonts.length };
  }

  function inspectTextResize() {
    requireSession();
    const issues = [];
    for (const item of session.fonts) {
      if (issues.length >= MAX_ISSUES) break;
      const element = item.element;
      if (!isRendered(element)) continue;
      if (!item.clipped && getClipping(element, getTextRects(element))) {
        issues.push(createIssue(element, 'text-resize', '1.4.4', 'текст обрезается при увеличении шрифта до 200%', {
          'Исходный размер шрифта': `${item.size}px`,
          'Контрольный размер шрифта': `${item.size * 2}px`,
          'Способ проверки': 'Удвоение вычисленного размера шрифта с сохранением viewport',
          'Ограничение': 'Проверьте доступный пользователю способ увеличения текста; это не тест всех режимов браузерного масштаба'
        }));
      }
    }
    return { issues, issueLimitReached: issues.length >= MAX_ISSUES,
      limits: [{ id: 'resize-issues', label: 'Замечания увеличения текста (нижняя граница)', limit: MAX_ISSUES, total: issues.length, processed: issues.length, truncated: issues.length >= MAX_ISSUES }] };
  }

  function restoreText() {
    if (!session) return;
    session.fonts.forEach(item => {
      if (item.element.getAttribute('style') === item.appliedStyle) {
        if (item.styleAttribute === null) item.element.removeAttribute('style');
        else item.element.setAttribute('style', item.styleAttribute);
      } else if (item.element.style.getPropertyValue('font-size') === `${item.size * 2}px`) {
        // Preserve unrelated style changes made by the page during the test.
        if (item.value) item.element.style.setProperty('font-size', item.value, item.priority);
        else item.element.style.removeProperty('font-size');
      }
    });
    session.fonts = [];
  }

  function getActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  function startKeyboard(direction = 'forward') {
    requireSession();
    const body = document.body;
    if (!body) throw new Error('На странице отсутствует body');
    if (session.keyboardAnchor) session.keyboardAnchor.remove();
    const anchor = document.createElement('span');
    anchor.tabIndex = direction === 'forward' ? 1 : 0;
    anchor.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
    if (direction === 'backward') body.append(anchor);
    else body.prepend(anchor);
    session.keyboardAnchor = anchor;
    anchor.focus({ preventScroll: true });
    // Keep the boundary anchor until the first real key event has moved focus.
    scrollTo(0, 0);
  }

  function removeKeyboardAnchor() {
    if (session && session.keyboardAnchor) {
      session.keyboardAnchor.remove();
      session.keyboardAnchor = null;
    }
  }

  function inspectFocus() {
    requireSession();
    const element = getActiveElement();
    if (!element || element === document.body || element === document.documentElement) return { escaped: true, issues: [] };
    if (!session.nodes.has(element)) session.nodes.set(element, session.nodes.size + 1);
    const result = {
      nodeId: session.nodes.get(element), issues: [],
      frame: element.localName === 'iframe',
      modal: Boolean(element.closest('dialog[open], [aria-modal="true"]'))
    };
    if (result.frame) return result;
    if (!result.modal) {
      result.cycleIssue = createIssue(element, 'keyboard-traps', '2.1.2', 'последовательность клавиатурного фокуса повторяется до выхода из документа', {
        'Ограничение': 'Проверьте возможность выхода из компонента; повторение само по себе не доказывает клавиатурную ловушку'
      });
    }
    const rect = element.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(innerWidth, rect.right);
    const bottom = Math.min(innerHeight, rect.bottom);
    let visiblePoint = false;
    if (right > left && bottom > top) {
      const scope = element.getRootNode();
      for (const xPart of [0.1, 0.5, 0.9]) {
        for (const yPart of [0.1, 0.5, 0.9]) {
          const x = left + (right - left) * xPart;
          const y = top + (bottom - top) * yPart;
          const hit = document.elementFromPoint(x, y);
          const localHit = scope === document ? hit : scope.elementFromPoint(x, y);
          if (hit === element || element.contains(hit) ||
            (scope.host && hit === scope.host && (localHit === element || element.contains(localHit)))) visiblePoint = true;
        }
      }
    }
    if (!visiblePoint) {
      result.issues.push(createIssue(element, 'focus-visibility', '2.4.11', 'элемент с клавиатурным фокусом перекрыт или находится вне viewport', {
        'Способ проверки': 'Реальный Tab / Shift+Tab и девять контрольных точек',
        'Ограничение': 'Геометрический тест не различает прозрачные перекрытия и все варианты отрисовки'
      }));
    }
    const before = session.baseline.get(element)?.focusStyle;
    const after = getFocusStyle(element);
    const outline = after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0;
    const changed = before && Object.keys(after).some(key => after[key] !== before[key]);
    if (!outline && !changed) {
      result.issues.push(createIssue(element, 'focus-visibility', '2.4.7', 'не обнаружено изменение оформления при клавиатурном фокусе', {
        'Ограничение': 'Проверьте видимый индикатор вручную, включая оформление родителя и псевдоэлементов'
      }));
    }
    return result;
  }

  function restore() {
    if (!session) return;
    restoreText();
    removeKeyboardAnchor();
    if (session.active && session.active.isConnected && typeof session.active.focus === 'function') {
      session.active.focus({ preventScroll: true });
    } else if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    scrollTo(session.scrollX, session.scrollY);
    session = null;
  }

  root.A11yScenarioChecks = {
    prepare, captureBaseline, inspectReflow, beginTextResize, inspectTextResize, waitForLayout,
    restoreText, startKeyboard, removeKeyboardAnchor, inspectFocus, restore
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
