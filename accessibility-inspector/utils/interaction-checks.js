(function(root) {
  'use strict';

  let observer = null;
  let mutations = new Set();
  let pasteListener = null;
  let pasteCancelled = false;
  let observationOverflow = false;
  let droppedRecords = 0;
  let lastMutation = 0;
  let statusStates = new WeakMap();
  let mediaRecords = new Map();
  let mediaSeen = new WeakSet();
  let mediaTotal = 0;
  let mediaEvents = [];
  let mediaEventTotal = 0;
  let mediaStarted = null;
  let mediaStopped = 0;
  let mediaListener = null;
  let action = null;
  let observationActive = false;
  let statusEvents = [];
  let statusEventTotal = 0;
  const observedRoots = new Set();
  const limits = new Map();
  const MEDIA_EVENTS = ['play', 'playing', 'pause', 'ended', 'volumechange', 'timeupdate', 'waiting', 'stalled', 'emptied', 'loadstart', 'error', 'ratechange', 'seeking', 'seeked'];
  const AUTOFILL_FIELDS = new Set(('name honorific-prefix given-name additional-name family-name honorific-suffix nickname username organization-title organization street-address address-line1 address-line2 address-line3 address-level4 address-level3 address-level2 address-level1 country country-name postal-code cc-name cc-given-name cc-additional-name cc-family-name cc-number cc-exp cc-exp-month cc-exp-year cc-type transaction-currency transaction-amount language bday bday-day bday-month bday-year sex url photo tel tel-country-code tel-national tel-area-code tel-local tel-local-prefix tel-local-suffix tel-extension email impp').split(' '));
  const STATUS_SELECTOR = '[role="status"], [role="alert"], [role="log"], [aria-live], .status, .toast, .notification, .error';
  const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'password', 'tel', 'url']);
  const documentId = performance.timeOrigin + '-' + Math.random();
  const parentOf = element => element.parentElement || element.getRootNode().host || element.ownerDocument.defaultView.frameElement;
  const styleOf = element => element.ownerDocument.defaultView.getComputedStyle(element);
  const unavailable = element => {
    for (let node = element; node; node = parentOf(node)) if (node.matches(':disabled, [inert], [aria-disabled="true"]')) return true;
    return false;
  };
  const activeElement = document => {
    let element = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    if (element?.localName === 'iframe') {
      try { return activeElement(element.contentDocument) || element; } catch { return element; }
    }
    return element;
  };
  const visible = element => {
    if (!element || !element.isConnected || !element.getClientRects().length) return false;
    if (['hidden', 'collapse'].includes(styleOf(element).visibility)) return false;
    for (let node = element; node; node = parentOf(node)) {
      const style = styleOf(node);
      if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const statusState = element => ({ text: renderedText(element), visible: visible(element) });
  function renderedText(element) {
    const styles = new Map();
    const styleFor = node => {
      if (!styles.has(node)) styles.set(node, styleOf(node));
      return styles.get(node);
    };
    const range = element.ownerDocument.createRange();
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT, { acceptNode: node => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, template, noscript') || ['hidden', 'collapse'].includes(styleFor(parent).visibility)) return NodeFilter.FILTER_REJECT;
      for (let ancestor = parent; ancestor; ancestor = parentOf(ancestor)) {
        const style = styleFor(ancestor);
        if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) return NodeFilter.FILTER_REJECT;
      }
      range.selectNodeContents(node);
      return Array.from(range.getClientRects()).some(rect => rect.width > 0 && rect.height > 0) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    let text = '';
    while (walker.nextNode()) text += walker.currentNode.nodeValue;
    return text.trim();
  }
  const localSelector = element => {
    if (element.id) return '#' + CSS.escape(element.id);
    if (element === element.ownerDocument.documentElement) return element.localName;
    const parts = [];
    for (let node = element; node && (node.parentElement || node.parentNode?.host); node = node.parentElement) {
      parts.unshift(node.localName + ':nth-child(' + (Array.from(node.parentNode.children).indexOf(node) + 1) + ')');
    }
    return parts.join(' > ');
  };
  const selectorFor = element => {
    const scope = element.getRootNode();
    if (scope.host) return selectorFor(scope.host) + ' >>> ' + localSelector(element);
    const frame = element.ownerDocument.defaultView.frameElement;
    return frame ? selectorFor(frame) + ' >>frame>> ' + localSelector(element) : localSelector(element);
  };
  const issue = (element, criterion, message, details = {}) => ({
    type: 'warning', outcome: 'incomplete', category: 'interaction',
    message: 'Требуется ручная проверка: ' + message,
    element: element.outerHTML, selector: selectorFor(element),
    details: { criterion, ...details }
  });

  function recordLimit(id, label, total, limit, processed = Math.min(total, limit)) {
    const previous = limits.get(id);
    limits.set(id, { ...previous, id, label, limit, total: Math.max(previous?.total || 0, total),
      processed: Math.max(previous?.processed || 0, processed), truncated: Boolean(previous?.truncated || total > limit) });
  }

  function take(items, limit, id, label) {
    recordLimit(id, label, items.length, limit);
    return items.slice(0, limit);
  }

  function getCoverage() {
    recordLimit('status-nodes', 'Узлы наблюдения статусов', mutations.size + (observationOverflow ? 1 : 0), 200, mutations.size);
    const statusLimit = limits.get('status-nodes');
    statusLimit.totalIsLowerBound = Boolean(statusLimit.totalIsLowerBound || observationOverflow);
    const records = Array.from(limits.values());
    return { limits: records, limitReached: records.some(record => record.truncated) };
  }

  function resetCoverage() {
    limits.clear();
    mutations.clear();
    observationOverflow = false;
    droppedRecords = 0;
  }

  function uniqueElement(selector, allowMissing = false) {
    const parts = selector.split(/\s*(>>>|>>frame>>)\s*/);
    let scope = document;
    for (let index = 0; index < parts.length - 1; index += 2) {
      const hosts = scope.querySelectorAll(parts[index]);
      if (hosts.length !== 1) throw new Error('Контекст сценария отсутствует или неоднозначен');
      const host = hosts[0];
      if (parts[index + 1] === '>>>') {
        if (!host.shadowRoot) throw new Error('Доступен только открытый Shadow DOM');
        scope = host.shadowRoot;
      } else {
        if (host.localName !== 'iframe' || host.hasAttribute('sandbox') && !host.sandbox.contains('allow-same-origin')) throw new Error('Недоступный или изолированный iframe');
        try {
          scope = host.contentDocument;
          if (!scope || scope.location.origin !== location.origin) throw new Error();
        } catch { throw new Error('Разрешён только iframe с тем же origin'); }
        for (let ancestor = host; ancestor; ancestor = parentOf(ancestor)) if (styleOf(ancestor).transform !== 'none' || !['1', 'normal'].includes(styleOf(ancestor).zoom)) throw new Error('Преобразованный iframe не поддерживается');
      }
      if (observationActive) observeRoot(scope);
    }
    const elements = scope.querySelectorAll(parts[parts.length - 1]);
    if (elements.length > 1) throw new Error('Селектор неоднозначен: найдено несколько элементов');
    if (!elements.length) {
      if (allowMissing) return null;
      throw new Error('Элемент сценария не найден');
    }
    return elements[0];
  }

  function beginAction(selector, secondary) {
    action = { selector, element: selector ? uniqueElement(selector) : activeElement(document), secondary,
      destination: secondary ? uniqueElement(secondary) : null, options: null };
    action.controlType = action.element?.type;
    action.multiple = action.element?.multiple;
    action.size = action.element?.size;
    action.readOnly = action.element?.readOnly;
    if (action.element && !visible(action.element)) throw new Error('Цель действия не видна');
    return {};
  }

  function assertAction(keyboard = false, allowHidden = false) {
    if (!action) return;
    const element = action.element;
    if (!element?.isConnected || action.selector && uniqueElement(action.selector, true) !== element ||
      action.secondary && uniqueElement(action.secondary, true) !== action.destination) throw new Error('Цель действия исчезла или была заменена');
    if ((!allowHidden && !visible(element)) || unavailable(element)) throw new Error('Цель действия стала недоступна');
    if (element.type !== action.controlType || element.multiple !== action.multiple || element.size !== action.size || element.readOnly !== action.readOnly) throw new Error('Тип или режим элемента управления изменился во время действия');
    if (keyboard && activeElement(document) !== element) throw new Error('Фокус цели действия изменился');
    if (action.options) {
      const options = Array.from(element.options);
      if (options.length !== action.options.length || options.some((option, index) => {
        const saved = action.options[index];
        return option !== saved.element || option.value !== saved.value || option.text !== saved.text || option.label !== saved.label || optionAvailable(option) !== saved.enabled;
      })) throw new Error('Состав или доступность вариантов select изменились во время действия');
    }
    if (action.members) {
      const members = Array.from(element.querySelectorAll('[role="option"]')).filter(option => option.closest('[role="listbox"]') === element);
      if (members.length !== action.members.length || action.members.some((item, index) => members[index] !== item.element || !item.element.isConnected || uniqueElement(item.selector, true) !== item.element || unavailable(item.element) !== item.unavailable)) throw new Error('Варианты listbox изменились во время действия');
    }
  }

  const optionAvailable = option => !option.disabled && !option.closest('optgroup[disabled], optgroup[hidden]') && !option.hidden && styleOf(option).display !== 'none' && (option.parentElement.localName !== 'optgroup' || styleOf(option.parentElement).display !== 'none');

  async function waitUntil(predicate, timeoutMs = 2000) {
    const deadline = performance.now() + timeoutMs;
    do {
      if (predicate()) return { matched: true };
      if (performance.now() >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(50, deadline - performance.now())));
    } while (true);
    return { matched: false, timedOut: true };
  }

  async function waitForReady(timeoutMs = 2000) {
    const result = await waitUntil(() => document.readyState !== 'loading' && performance.now() - lastMutation >= 100, timeoutMs);
    if (!result.matched) throw new Error('Не удалось дождаться стабилизации документа');
    return getCoverage();
  }

  function startObservation() {
    stopObservation();
    resetCoverage();
    mutations = new Set();
    observationOverflow = false;
    droppedRecords = 0;
    lastMutation = performance.now();
    statusStates = new WeakMap();
    statusEvents = [];
    statusEventTotal = 0;
    startMediaObservation();
    const add = node => {
      if (!node || mutations.has(node)) return;
      if (mutations.size < 200) mutations.add(node);
      else { observationOverflow = true; droppedRecords++; }
    };
    observer = new MutationObserver(records => {
      lastMutation = performance.now();
      for (const record of records) {
        const node = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        add(node);
        for (const added of record.addedNodes || []) {
          if (added.nodeType === Node.ELEMENT_NODE) {
            add(added);
            if (added.matches('audio, video')) trackMedia(added);
            for (const media of added.querySelectorAll('audio, video')) trackMedia(media);
          }
        }
      }
    });
    observationActive = true;
    observeRoot(document);
    return { origin: location.origin };
  }

  function observeRoot(scope) {
    if (observedRoots.has(scope)) return;
    recordLimit('observation-contexts', 'Контексты наблюдения', observedRoots.size + 1, 20, Math.min(20, observedRoots.size + 1));
    if (observedRoots.size >= 20) throw new Error('Достигнут лимит 20 контекстов наблюдения');
    observedRoots.add(scope);
    for (const region of scope.querySelectorAll(STATUS_SELECTOR)) statusStates.set(region, statusState(region));
    for (const media of scope.querySelectorAll('audio, video')) trackMedia(media);
    observer.observe(scope.documentElement || scope, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-invalid', 'aria-live', 'role', 'hidden', 'class', 'style'] });
    if (scope !== document) for (const type of MEDIA_EVENTS) scope.addEventListener(type, mediaListener, true);
  }

  function stopObservation() {
    if (observer) observer.disconnect();
    observer = null;
    if (mediaListener) {
      for (const [element, record] of mediaRecords) updateMedia(element, record);
      mediaStopped = performance.now();
      for (const type of MEDIA_EVENTS) document.removeEventListener(type, mediaListener, true);
      for (const scope of observedRoots) if (scope !== document) for (const type of MEDIA_EVENTS) scope.removeEventListener(type, mediaListener, true);
    }
    mediaListener = null;
    if (pasteListener) document.removeEventListener('paste', pasteListener, true);
    pasteListener = null;
    observationActive = false;
    observedRoots.clear();
    action = null;
    mutations.clear();
  }

  function inspectChanges(rescan = false) {
    const issues = [];
    let changedStatuses = 0;
    const inspected = new Set();
    // CSS transitions and late visibility changes need not create a DOM mutation.
    if (observationActive && rescan) for (const scope of observedRoots) for (const region of scope.querySelectorAll(STATUS_SELECTOR)) inspected.add(region);
    for (const node of mutations) {
      const region = node.closest(STATUS_SELECTOR);
      if (region) inspected.add(region);
      for (const descendant of node.querySelectorAll(STATUS_SELECTOR)) inspected.add(descendant);
    }
    for (const region of take(Array.from(inspected), 200, 'status-regions', 'Сообщения в изменённых поддеревьях')) {
      const previous = statusStates.get(region);
      const current = statusState(region);
      statusStates.set(region, current);
      if (!current.visible || !current.text || previous && previous.visible && previous.text === current.text) continue;
      changedStatuses++;
      statusEventTotal++;
      if (statusEvents.length < 200) statusEvents.push({ selector: selectorFor(region), element: region.outerHTML, text: current.text, timeMs: Math.round(performance.now() - mediaStarted) });
      recordLimit('status-events', 'Сохранённые изменения сообщений', statusEventTotal, 200, statusEvents.length);
      const live = region.closest('[aria-live], [role="status"], [role="alert"], [role="log"]');
      if (!live || live.getAttribute('aria-live') === 'off' || live.closest('[aria-hidden="true"], [inert]')) {
        issues.push(issue(region, '4.1.3', 'изменившееся сообщение может не объявляться вспомогательными технологиями'));
      }
    }
    recordLimit('status-nodes', 'Узлы наблюдения статусов', mutations.size + (observationOverflow ? 1 : 0), 200, mutations.size);
    const coverage = getCoverage();
    const skippedRecords = droppedRecords;
    mutations.clear();
    observationOverflow = false;
    droppedRecords = 0;
    return { issues, changedStatuses, statusObservation: { documentId, events: statusEvents.slice(), durationMs: Math.round((mediaStopped || performance.now()) - mediaStarted) }, ...coverage, skippedRecords, limitation: 'При переполнении total — нижняя граница числа узлов; объявления скринридером не проверяются' };
  }

  function inspectForms() {
    const issues = [];
    for (const field of take(Array.from(document.querySelectorAll('input, select, textarea, [aria-invalid="true"]')), 1000, 'form-fields', 'Поля проверки ошибок')) {
      if (!visible(field) || field.disabled) continue;
      if (field.getAttribute('aria-invalid') !== 'true' && (!field.validity || field.validity.valid)) continue;
      const ids = ((field.getAttribute('aria-errormessage') || '') + ' ' + (field.getAttribute('aria-describedby') || '')).trim().split(/\s+/);
      const description = ids.some(id => {
        const element = document.getElementById(id);
        return element && element.textContent.trim() && !element.closest('[aria-hidden="true"], [inert]');
      });
      // Native validity messages are a browser-provided mechanism, not an automatic failure.
      if (field.getAttribute('aria-invalid') === 'true' && !description) issues.push(issue(field, '3.3.1', 'ошибочное поле не имеет связанного описания ошибки'));
    }
    return { issues, ...getCoverage() };
  }

  function inspectMedia() {
    const issues = [];
    const media = take(Array.from(document.querySelectorAll('audio, video')), 100, 'media', 'Медиаэлементы');
    for (const element of media) {
      if (element.localName === 'video' && !Array.from(element.querySelectorAll('track')).some(track => ['captions', 'subtitles'].includes(track.kind))) {
        issues.push(issue(element, '1.2.2', 'у видео не найдены встроенные дорожки субтитров', { 'Ограничение': 'Проверьте наличие речи, внешних субтитров и применимость критерия' }));
      }
      if (!element.controls) issues.push(issue(element, '2.1.1', 'нативные элементы управления медиаплеером отключены', { 'Ограничение': 'Проверьте пользовательский плеер и его клавиатурное управление' }));
    }
    return { issues, count: media.length, ...getCoverage(), limitation: 'Качество, синхронность и доступность файлов дорожек автоматически не подтверждаются' };
  }

  function updateMedia(element, record, type) {
    const now = performance.now();
    const position = element.currentTime;
    const delta = position - record.position;
    const playable = !element.paused && !element.ended && !element.muted && element.volume > 0 && element.playbackRate > 0 && element.isConnected;
    const loopBoundary = delta < 0 && record.active && playable && element.loop && Number.isFinite(element.duration) &&
      record.position >= element.duration - 0.5 * record.rate && position <= 0.25;
    if (loopBoundary) {
      record.loopCarryMs += record.runMs;
      record.pendingLoop = { at: now, source: element.currentSrc };
      record.runMs = 0;
    } else if (type === 'seeking' && !record.pendingLoop) {
      record.runMs = 0;
      record.loopCarryMs = 0;
    }
    // Bound playback evidence by both elapsed time and actual media progression.
    if (record.active && delta > 0) record.runMs += Math.min(now - record.at, delta * 1000 / record.rate);
    record.longestMs = Math.max(record.longestMs, record.runMs + (record.pendingLoop ? 0 : record.loopCarryMs));
    if (['waiting', 'emptied', 'loadstart', 'error'].includes(type)) record.blocked = true;
    if (type === 'playing') record.blocked = false;
    record.active = playable && !record.blocked;
    // Bridge only a short, observed loop boundary; real pauses and seeks start a new interval.
    if (record.pendingLoop && (!playable || !element.loop || element.currentSrc !== record.pendingLoop.source || now - record.pendingLoop.at > 250)) {
      record.pendingLoop = null;
      record.loopCarryMs = 0;
    }
    if (record.pendingLoop && type === 'playing') {
      record.loops++;
      record.pendingLoop = null;
    }
    if (!record.active && !record.pendingLoop || ['emptied', 'loadstart', 'error'].includes(type)) record.loopCarryMs = 0;
    if (!record.active || delta < 0 || ['emptied', 'loadstart'].includes(type)) record.runMs = 0;
    record.position = position;
    record.at = now;
    record.rate = element.playbackRate > 0 ? element.playbackRate : 1;
  }

  function trackMedia(element) {
    if (mediaSeen.has(element)) return mediaRecords.get(element);
    mediaSeen.add(element);
    mediaTotal++;
    recordLimit('observed-media', 'Медиаэлементы наблюдения', mediaTotal, 100, Math.min(mediaTotal, 100));
    if (mediaRecords.size >= 100) return null;
    const record = { at: performance.now(), position: element.currentTime, rate: element.playbackRate > 0 ? element.playbackRate : 1,
      active: !element.paused && !element.ended && !element.muted && element.volume > 0, blocked: false,
      runMs: 0, longestMs: 0, loopCarryMs: 0, pendingLoop: null, loops: 0, playingAtStart: !element.paused, playObserved: false, activationAtPlay: null };
    mediaRecords.set(element, record);
    return record;
  }

  function startMediaObservation() {
    mediaRecords = new Map();
    mediaSeen = new WeakSet();
    mediaTotal = 0;
    mediaEvents = [];
    mediaEventTotal = 0;
    mediaStarted = performance.now();
    mediaStopped = 0;
    for (const element of document.querySelectorAll('audio, video')) trackMedia(element);
    mediaListener = event => {
      if (!event.isTrusted || !event.target.matches?.('audio, video')) return;
      const element = event.target;
      const record = trackMedia(element);
      if (!record) return;
      updateMedia(element, record, event.type);
      if (event.type === 'play') {
        record.playObserved = true;
        record.activationAtPlay = Boolean(navigator.userActivation?.isActive);
      }
      mediaEventTotal++;
      if (mediaEvents.length < 200) mediaEvents.push({ type: event.type, timeMs: Math.round(performance.now() - mediaStarted), selector: selectorFor(element) });
      recordLimit('media-events', 'События медианаблюдения', mediaEventTotal, 200, mediaEvents.length);
    };
    for (const type of MEDIA_EVENTS) document.addEventListener(type, mediaListener, true);
  }

  function inspectMediaObservation() {
    if (mediaStarted === null) return getCoverage();
    const issues = [], elements = [];
    for (const [element, record] of mediaRecords) {
      if (mediaListener) updateMedia(element, record);
      const longestPotentialAudioMs = Math.floor(record.longestMs);
      elements.push({ selector: selectorFor(element), longestPotentialAudioMs, loops: record.loops, playingAtStart: record.playingAtStart,
        playObserved: record.playObserved, activationAtPlay: record.activationAtPlay, autoplayAttribute: element.autoplay });
      if (longestPotentialAudioMs > 3000) issues.push(issue(element, '1.4.2', 'наблюдалось потенциально звуковое воспроизведение более трёх секунд', {
        'Наблюдаемый интервал, мс': longestPotentialAudioMs,
        'Ограничение': 'Проверьте фактический звук, автоматический запуск и механизм остановки; DOM-события этого не доказывают'
      }));
    }
    return { issues, mediaObservation: { documentId, durationMs: Math.round((mediaStopped || performance.now()) - mediaStarted), elements, events: mediaEvents.slice(),
      limitation: 'Наблюдается продвижение currentTime при ненулевой громкости без muted; наличие звуковой дорожки и причина запуска не подтверждаются. Граница loop объединяется только при возврате от конца ресурса и продолжении до 250 мс; это эвристика, а не оценка слышимости разрыва. События до начала наблюдения не восстанавливаются; playingAtStart относится к моменту регистрации элемента' }, ...getCoverage() };
  }

  function tooltipCandidates() {
    const candidates = Array.from(document.querySelectorAll('[aria-describedby], [aria-controls]')).flatMap(trigger => {
      const ids = ((trigger.getAttribute('aria-describedby') || '') + ' ' + (trigger.getAttribute('aria-controls') || '')).trim().split(/\s+/);
      return ids.map(id => document.getElementById(id)).filter(popup => popup && popup.getAttribute('role') === 'tooltip' && visible(trigger)).map(popup => ({ trigger: selectorFor(trigger), popup: selectorFor(popup) }));
    });
    return take(candidates, 10, 'tooltips', 'Связанные подсказки');
  }

  function target(selector, focus = false) {
    const element = uniqueElement(selector);
    if (!visible(element)) throw new Error('Элемент сценария не виден');
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    if (focus) element.focus({ preventScroll: true });
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function hitPoint(element) {
    const rect = element.getBoundingClientRect();
    const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const scope = element.getRootNode();
    const hit = scope.elementFromPoint(point.x, point.y);
    if (hit?.matches('iframe, frame, object, embed')) throw new Error('Указательное действие во встроенном документе не поддерживается');
    if (!visible(element) || !hit || (hit !== element && !element.contains(hit))) throw new Error('Цель указателя находится вне viewport или перекрыта');
    for (let frame = element.ownerDocument.defaultView.frameElement; frame; frame = frame.ownerDocument.defaultView.frameElement) {
      const box = frame.getBoundingClientRect();
      point.x += box.left + frame.clientLeft;
      point.y += box.top + frame.clientTop;
      if (frame.ownerDocument.elementFromPoint(point.x, point.y) !== frame) throw new Error('iframe перекрыт или находится вне viewport');
    }
    return point;
  }

  function prepareClick(selector, expectedPoint) {
    assertAction();
    const element = uniqueElement(selector);
    if (element.matches(':disabled') || element.closest('[inert]')) throw new Error('Цель клика недоступна для взаимодействия');
    if (!expectedPoint) target(selector);
    const point = hitPoint(element);
    // Hover can reveal an overlay or move the target before the press.
    if (expectedPoint && (Math.abs(point.x - expectedPoint.x) > 1 || Math.abs(point.y - expectedPoint.y) > 1)) throw new Error('Цель клика переместилась после наведения');
    return point;
  }

  function prepareDrag(sourceSelector, targetSelector, scroll = false) {
    const source = uniqueElement(sourceSelector);
    const destination = uniqueElement(targetSelector);
    if (source.ownerDocument !== document || destination.ownerDocument !== document) throw new Error('Перетаскивание внутри iframe и между документами не поддерживается');
    if (!visible(source) || !visible(destination)) throw new Error('Источник или цель перетаскивания не видны');
    source.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const startBox = source.getBoundingClientRect();
    const endBox = destination.getBoundingClientRect();
    const left = Math.min(startBox.left, endBox.left), right = Math.max(startBox.right, endBox.right);
    const top = Math.min(startBox.top, endBox.top), bottom = Math.max(startBox.bottom, endBox.bottom);
    if (right - left > innerWidth || bottom - top > innerHeight) {
      if (scroll) return { start: hitPoint(source), end: null };
      throw new Error('Перетаскивание с автопрокруткой требует явного разрешения: источник и цель не помещаются в один viewport');
    }
    scrollBy({ left: left < 0 ? left : Math.max(0, right - innerWidth), top: top < 0 ? top : Math.max(0, bottom - innerHeight), behavior: 'instant' });
    // Measure both endpoints only after the final scroll, before pressing the pointer.
    return { start: hitPoint(source), end: hitPoint(destination) };
  }

  function scrollDragTarget(selector) {
    assertAction();
    target(selector);
    return hitPoint(uniqueElement(selector));
  }

  function dragEdgeState(selector, allowPending = false) {
    assertAction();
    const destination = uniqueElement(selector);
    if (destination.ownerDocument !== document) throw new Error('Краевая прокрутка во фрейме не поддерживается');
    try { return { done: true, point: hitPoint(destination) }; } catch {}
    const box = destination.getBoundingClientRect();
    const targetX = box.left + box.width / 2, targetY = box.top + box.height / 2;
    for (let node = parentOf(destination); node; node = parentOf(node)) {
      const viewport = node === document.scrollingElement;
      const style = styleOf(node);
      const bounds = viewport ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight } : node.getBoundingClientRect();
      const left = Math.max(0, bounds.left + (viewport ? 0 : node.clientLeft));
      const top = Math.max(0, bounds.top + (viewport ? 0 : node.clientTop));
      const right = Math.min(innerWidth, viewport ? innerWidth : bounds.left + node.clientLeft + node.clientWidth);
      const bottom = Math.min(innerHeight, viewport ? innerHeight : bounds.top + node.clientTop + node.clientHeight);
      if (right - left < 8 || bottom - top < 8) continue;
      const x = viewport || /auto|scroll/.test(style.overflowX);
      const y = viewport || /auto|scroll/.test(style.overflowY);
      const rtl = style.direction === 'rtl';
      const dx = x && targetX > right && (rtl ? node.scrollLeft < -1 : node.scrollLeft < node.scrollWidth - node.clientWidth - 1) ? 120 :
        x && targetX < left && (rtl ? node.scrollLeft > -(node.scrollWidth - node.clientWidth) + 1 : node.scrollLeft > 0) ? -120 : 0;
      const dy = y && targetY > bottom && node.scrollTop < node.scrollHeight - node.clientHeight - 1 ? 120 : y && targetY < top && node.scrollTop > 0 ? -120 : 0;
      if (!dx && !dy) continue;
      const point = { x: Math.min(right - 4, Math.max(left + 4, dx > 0 ? right - 4 : dx < 0 ? left + 4 : targetX)),
        y: Math.min(bottom - 4, Math.max(top + 4, dy > 0 ? bottom - 4 : dy < 0 ? top + 4 : targetY)) };
      const hit = node.getRootNode().elementFromPoint(point.x, point.y);
      if (!hit || hit.matches('iframe, frame, object, embed') || !viewport && hit !== node && !node.contains(hit) && hit.getRootNode().host !== node) continue;
      const container = selectorFor(node);
      const position = container + ':' + node.scrollLeft + ':' + node.scrollTop;
      action.scrollNode = node;
      return { done: false, point, dx, dy, position, container, scrollLeft: node.scrollLeft, scrollTop: node.scrollTop };
    }
    const reason = 'Не найден доступный край прокрутки; цель перекрыта или область непрокручиваема';
    if (allowPending) return { done: false, waiting: true, reason };
    throw new Error(reason);
  }

  function advanceDragEdge(selector, container, assist = true) {
    const state = dragEdgeState(selector, true);
    if (state.done || state.waiting || state.container !== container) return { advanced: false, changed: true };
    if (!assist) return { advanced: false, state };
    const node = action.scrollNode;
    const left = node.scrollLeft, top = node.scrollTop;
    node.scrollBy({ left: state.dx, top: state.dy, behavior: 'instant' });
    return { advanced: node.scrollLeft !== left || node.scrollTop !== top, state };
  }

  function dragDropPoint(selector, expected) {
    assertAction();
    const point = hitPoint(uniqueElement(selector));
    if (expected && (Math.abs(point.x - expected.x) > 1 || Math.abs(point.y - expected.y) > 1)) throw new Error('Цель перетаскивания переместилась перед отпусканием');
    return point;
  }

  function preparePattern(selector, pattern, candidateSelector, focusSelector, phase = 'snapshot', allowHidden = false) {
    assertAction(false, allowHidden);
    const container = uniqueElement(selector);
    const candidates = [...(container.matches(candidateSelector) ? [container] : []), ...container.querySelectorAll(candidateSelector)];
    if (!candidates.length || pattern === 'slider-multithumb' && candidates.length < 2) throw new Error('Структура не соответствует указанному ARIA-паттерну');
    if (focusSelector) {
      const focus = uniqueElement(focusSelector);
      if (focus !== container && !container.contains(focus)) throw new Error('Начальная цель фокуса находится вне паттерна');
      target(focusSelector, true);
      if (activeElement(document) !== focus) throw new Error('Элемент паттерна не получил фокус');
    }
    const elements = take(candidates, 200, 'pattern-elements', 'Элементы ARIA-паттерна');
    return { patternObservation: { pattern, selector, phase, elements: elements.map(element => ({ selector: selectorFor(element), element: element.outerHTML,
      role: element.getAttribute('role') || element.localName, attributes: Object.fromEntries(Array.from(element.attributes).filter(attribute => attribute.name.startsWith('aria-')).map(attribute => [attribute.name, attribute.value])) })),
      limitation: 'Проверяются явно заданные клавиши и состояния; распознавание структуры не доказывает полноту паттерна, смысл и работу скринридера' }, ...getCoverage() };
  }

  function patternFocus() {
    assertAction();
    const focused = activeElement(document), container = action.element;
    const ownsFocus = element => element === focused || element.contains(focused);
    if (ownsFocus(container)) return;
    const scope = container.getRootNode();
    const owners = [container, ...container.querySelectorAll('[aria-controls], [aria-owns]')];
    for (const owner of owners) for (const id of ((owner.getAttribute('aria-controls') || '') + ' ' + (owner.getAttribute('aria-owns') || '')).split(/\s+/)) {
      const popup = id && scope.getElementById(id);
      if (popup && ownsFocus(popup)) return;
    }
    throw new Error('Фокус вышел за пределы ARIA-паттерна и связанных компонентов');
  }

  function finishPattern(selector, pattern, candidateSelector, allowHidden) {
    if (allowHidden && !uniqueElement(selector, true) && !action.element.isConnected) return {
      patternObservation: { selector, pattern, phase: 'after', removed: true, elements: [], limitation: 'Зафиксировано удаление цели; ожидаемое отсутствие проверяется отдельно' }, ...getCoverage()
    };
    return preparePattern(selector, pattern, candidateSelector, undefined, 'after', allowHidden);
  }

  function tooltipState(selector) {
    const element = document.querySelector(selector);
    return { visible: visible(element) };
  }

  function tooltipIssue(selector, reason) {
    const element = document.querySelector(selector);
    return { issues: element ? [issue(element, '1.4.13', reason, { 'Ограничение': 'Учтите исключения, альтернативные способы закрытия и ограниченное время наблюдения' })] : [] };
  }

  function prepareInput(selector) {
    const element = uniqueElement(selector);
    if (!(element.localName === 'textarea' || element.localName === 'input' && TEXT_INPUT_TYPES.has(element.type)) || element.disabled || element.readOnly || element.closest('[inert]')) throw new Error('fill поддерживает только доступные текстовые поля');
    target(selector, true);
    if (activeElement(document) !== element) throw new Error('Поле не получило фокус для ввода');
    element.select();
    return { selectAllModifiers: /Mac/.test(navigator.platform) ? 4 : 2 };
  }

  function inputState(selector, expectedValue) {
    const element = uniqueElement(selector);
    return { matched: visible(element) && element.value === expectedValue };
  }

  function prepareCheckbox(selector) {
    const element = uniqueElement(selector);
    if (element.localName !== 'input' || element.type !== 'checkbox' || element.matches(':disabled') || element.closest('[inert]') || !visible(element)) throw new Error('checkbox поддерживает только доступный видимый нативный флажок');
    if (element.indeterminate) throw new Error('Промежуточное состояние checkbox не поддерживается');
    return { checked: element.checked };
  }

  function prepareSelect(selector, value) {
    const element = uniqueElement(selector);
    if (element.localName !== 'select' || element.multiple || element.matches(':disabled') || element.closest('[inert]') || !visible(element)) throw new Error('select поддерживает только доступный нативный список с одиночным выбором');
    target(selector, true);
    if (activeElement(document) !== element || uniqueElement(selector) !== element) throw new Error('Список не получил фокус или был заменён');
    const options = Array.from(element.options);
    recordLimit('select-options', 'Варианты нативного списка', options.length, 100, options.length > 100 ? 0 : options.length);
    if (options.length > 100) throw new Error('Достигнут лимит 100 вариантов select');
    const enabled = options.filter(optionAvailable);
    if (action) action.options = options.map(option => ({ element: option, value: option.value, text: option.text, label: option.label, enabled: optionAvailable(option) }));
    const matches = enabled.filter(option => option.value === value);
    if (matches.length !== 1) throw new Error('Значение select отсутствует, недоступно или неоднозначно');
    return { unchanged: element.value === value, moves: enabled.indexOf(matches[0]), dropdown: element.size <= 1 };
  }

  function prepareToggle(selector, kind, state = 'checked') {
    assertAction();
    const element = uniqueElement(selector);
    const native = element.matches('input[type="radio"], input[type="checkbox"]');
    if (kind === 'checkbox' && !(element.matches('input[type="checkbox"]') || ['checkbox', 'switch'].includes(element.getAttribute('role')))) throw new Error('checkbox требует нативный флажок или роль checkbox/switch');
    if (native && element.indeterminate) throw new Error('Промежуточное состояние checkbox не поддерживается');
    if (kind === 'radio' && !(element.matches('input[type="radio"]') || element.getAttribute('role') === 'radio')) throw new Error('radio требует нативную кнопку или role="radio"');
    if (kind === 'aria' && (!['checked', 'selected', 'expanded', 'pressed'].includes(state) || !element.hasAttribute('aria-' + state))) throw new Error('Не найдено заданное состояние ARIA');
    if (!visible(element) || element.matches(':disabled, [aria-disabled="true"]') || element.closest('[inert]')) throw new Error('Элемент управления недоступен');
    const value = native ? element.checked : element.getAttribute('aria-' + state);
    if (!native && !['true', 'false'].includes(value)) throw new Error('Неоднозначное или смешанное состояние ARIA');
    return { checked: native ? value : value === 'true' };
  }

  function prepareMultiple(selector, values) {
    const element = uniqueElement(selector);
    if (element.localName !== 'select' || !element.multiple || element.matches(':disabled') || element.closest('[inert]') || !visible(element)) throw new Error('multiple требует доступный нативный select multiple');
    target(selector, true);
    if (activeElement(document) !== element) throw new Error('Список не получил фокус');
    const options = Array.from(element.options);
    recordLimit('select-options', 'Варианты нативного списка', options.length, 100, Math.min(options.length, 100));
    if (options.length > 100) throw new Error('Достигнут лимит 100 вариантов select');
    const enabled = options.filter(optionAvailable);
    for (const value of values) if (enabled.filter(option => option.value === value).length !== 1) throw new Error('Вариант multiple отсутствует, недоступен или неоднозначен');
    if (options.some(option => option.selected && !optionAvailable(option) && !values.includes(option.value))) throw new Error('Нельзя снять выбор недоступного варианта');
    if (action) action.options = options.map(option => ({ element: option, value: option.value, text: option.text, label: option.label, enabled: optionAvailable(option) }));
    return { toggles: enabled.map(option => option.selected !== values.includes(option.value)), modifiers: /Mac/.test(navigator.platform) ? 4 : 2 };
  }

  function multipleState(selector, values) {
    const element = uniqueElement(selector);
    const selected = Array.from(element.selectedOptions, option => option.value);
    return { matched: selected.length === values.length && values.every(value => selected.includes(value)) };
  }

  function prepareListbox(selector, options) {
    const element = uniqueElement(selector);
    if (element.getAttribute('role') !== 'listbox' || !visible(element) || element.closest('[aria-disabled="true"], [inert]')) throw new Error('listbox требует доступный role="listbox"');
    const members = Array.from(element.querySelectorAll('[role="option"]')).filter(option => option.closest('[role="listbox"]') === element);
    recordLimit('listbox-options', 'Варианты ARIA-списка', members.length, 100, Math.min(members.length, 100));
    if (members.length > 100 || element.hasAttribute('aria-owns') || members.some(option => Number(option.getAttribute('aria-setsize')) > members.length)) throw new Error('Виртуальный, внешний или слишком большой listbox не поддерживается');
    const requested = options.map(selector => uniqueElement(selector));
    if (new Set(requested).size !== requested.length || requested.some(option => !members.includes(option)) || requested.length > 1 && element.getAttribute('aria-multiselectable') !== 'true') throw new Error('Недопустимый набор вариантов listbox');
    const records = members.map(option => {
      const attribute = option.hasAttribute('aria-selected') ? 'aria-selected' : 'aria-checked';
      if (option.hasAttribute('aria-selected') && option.hasAttribute('aria-checked') || !['true', 'false'].includes(option.getAttribute(attribute))) throw new Error('Неоднозначное состояние варианта listbox');
      const selected = option.getAttribute(attribute) === 'true';
      const desired = requested.includes(option);
      if (selected !== desired && (!visible(option) || option.closest('[aria-disabled="true"], [inert]'))) throw new Error('Вариант listbox недоступен');
      return { selector: selectorFor(option), element: option, attribute, desired, change: selected !== desired, unavailable: unavailable(option) };
    });
    if (action) action.members = records;
    const multi = element.getAttribute('aria-multiselectable') === 'true';
    return { clicks: records.filter(item => item.change && (multi || item.desired)).map(item => item.selector) };
  }

  function listboxState() {
    assertAction();
    return { matched: Boolean(action?.members && action.members.every(item => item.element.getAttribute(item.attribute) === String(item.desired))) };
  }

  function inspectPlayer(selector) {
    const player = uniqueElement(selector);
    if (!visible(player)) throw new Error('Контейнер медиаплеера не виден');
    const scopes = [player];
    for (let index = 0; index < scopes.length; index++) {
      const scope = scopes[index];
      for (const host of [...(scope.shadowRoot ? [scope] : []), ...scope.querySelectorAll('*')]) if (host.shadowRoot) {
        if (scopes.length >= 20) { recordLimit('player-contexts', 'Контексты медиаплеера', scopes.length + 1, 20, 20); throw new Error('Достигнут лимит 20 контекстов медиаплеера'); }
        scopes.push(host.shadowRoot);
        if (observationActive) observeRoot(host.shadowRoot);
      }
    }
    recordLimit('player-contexts', 'Контексты медиаплеера', scopes.length, 20, scopes.length);
    const media = scopes.flatMap(scope => [...(scope.matches?.('audio, video') ? [scope] : []), ...scope.querySelectorAll('audio, video')]);
    for (const element of media) trackMedia(element);
    const controls = scopes.flatMap(scope => Array.from(scope.querySelectorAll('button, input, select, [role="button"], [role="slider"], [role="switch"]')));
    return { playerObservation: { selector, media: take(media, 100, 'player-media', 'Медиа пользовательского плеера').map(selectorFor),
      controls: take(controls, 100, 'player-controls', 'Элементы управления плеером').map(element => ({ selector: selectorFor(element), role: element.getAttribute('role') || element.localName, visible: visible(element) })),
      limitation: 'Наблюдаются HTMLMediaElement и найденные элементы управления; их связь, клавиатурная доступность, Web Audio и фактический звук автоматически не подтверждаются' }, ...getCoverage() };
  }

  function startPasteProbe(selector) {
    target(selector, true);
    pasteCancelled = false;
    pasteListener = event => { queueMicrotask(() => { pasteCancelled = event.defaultPrevented; }); };
    document.addEventListener('paste', pasteListener, true);
    // Synthetic probe only: it cannot establish the behaviour of a trusted OS paste.
    const data = new DataTransfer();
    data.setData('text/plain', 'a11y-test');
    uniqueElement(selector).dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  }

  function inspectPasteProbe(selector) {
    if (pasteListener) document.removeEventListener('paste', pasteListener, true);
    pasteListener = null;
    const element = uniqueElement(selector);
    return { issues: pasteCancelled ? [issue(element, '3.3.8', 'обработчик отменяет пробное событие вставки', { 'Ограничение': 'Событие синтетическое; проверьте реальную вставку, менеджер паролей и альтернативный способ входа' })] : [], trusted: false };
  }

  function autofillPurpose(value) {
    const tokens = value.replace(/[A-Z]/g, character => character.toLowerCase()).split(/[\t\n\f\r ]+/).filter(Boolean);
    let section = '', address = '', contact = '';
    if (tokens[0]?.startsWith('section-')) {
      section = tokens.shift();
      if (section.length === 8) return null;
    }
    if (['shipping', 'billing'].includes(tokens[0])) address = tokens.shift();
    if (['home', 'work', 'mobile', 'fax', 'pager'].includes(tokens[0])) contact = tokens.shift();
    const field = tokens.shift();
    if (!AUTOFILL_FIELDS.has(field) || contact && !/^(tel(?:-.+)?|email|impp)$/.test(field)) return null;
    if (tokens[0] === 'webauthn') tokens.shift();
    if (tokens.length) return null;
    return [section, address, contact, field].join('|');
  }

  function snapshot() {
    const fields = Array.from(observedRoots.size ? observedRoots : [document]).flatMap(scope => Array.from(scope.querySelectorAll('input, textarea, select'))).filter(element => visible(element) && !element.matches(':disabled') && !element.readOnly && !element.closest('[inert]') && !['password', 'hidden', 'file', 'checkbox', 'radio'].includes(element.type));
    return { fields: take(fields, 100, 'workflow-fields', 'Поля снимка сценария').map(element => ({ selector: selectorFor(element),
      purpose: element.hasAttribute('autocomplete') ? autofillPurpose(element.getAttribute('autocomplete')) : labelPurpose(element), empty: !element.value,
      required: element.required || element.getAttribute('aria-required') === 'true' })), origin: location.origin, documentId, ...getCoverage() };
  }

  function conditionState(condition) {
    const element = uniqueElement(condition.selector, true);
    if (!element) return { matched: condition.visible === false && Object.keys(condition).length === 2 };
    const shown = visible(element);
    if (condition.visible !== undefined && condition.visible !== shown) return { matched: false };
    if (condition.text !== undefined && (!shown || renderedText(element) !== condition.text)) return { matched: false };
    if (condition.value !== undefined && (!shown || !element.matches('input, textarea, select') || element.value !== condition.value)) return { matched: false };
    if (condition.checked !== undefined) {
      const native = element.matches('input[type="checkbox"], input[type="radio"]');
      if (!shown || native && (element.indeterminate || element.checked !== condition.checked) || !native && element.getAttribute('aria-checked') !== String(condition.checked)) return { matched: false };
    }
    for (const state of ['selected', 'expanded', 'pressed']) if (condition[state] !== undefined && (!shown || element.getAttribute('aria-' + state) !== String(condition[state]))) return { matched: false };
    if (condition.attributes !== undefined && (!shown && condition.visible !== false || Object.entries(condition.attributes).some(([name, value]) => element.getAttribute(name) !== value))) return { matched: false };
    if (condition.values !== undefined && (!shown || !element.matches('select[multiple]') || !multipleState(condition.selector, condition.values).matched)) return { matched: false };
    if (condition.enabled !== undefined && condition.enabled !== (!element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[inert]'))) return { matched: false };
    if (condition.focused !== undefined && condition.focused !== (activeElement(document) === element)) return { matched: false };
    return { matched: true };
  }

  function checkState(selector, expectedText) {
    const element = uniqueElement(selector, true);
    return { matched: Boolean(element && visible(element) && renderedText(element) === expectedText) };
  }

  function actionContext(guard = false, keyboard = false) {
    if (guard) assertAction(keyboard);
    return { origin: location.origin, documentId, frameFocused: Boolean(document.activeElement?.matches('iframe, frame, object, embed')) && !action?.selector?.includes('>>frame>>') };
  }

  function labelPurpose(element) {
    const scope = element.getRootNode();
    const ids = (element.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
    const label = ids.length ? ids.map(id => scope.getElementById(id)).filter(Boolean).map(renderedText).join(' ') :
      element.getAttribute('aria-label') || Array.from(element.labels || []).map(renderedText).join(' ');
    const normalized = label.normalize('NFKC').toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim();
    // Exact labels are candidates only; do not infer semantics from names, IDs or entered values.
    const form = element.form;
    const area = form ? form.getAttribute('aria-label') || form.name || form.id || selectorFor(form) : '';
    const context = scope.host ? selectorFor(scope.host) : element.ownerDocument.defaultView.frameElement ? selectorFor(element.ownerDocument.defaultView.frameElement) : '';
    return normalized ? ['label', context, area, element.localName + ':' + element.type, normalized].join('|') : null;
  }

  const waitForText = (selector, text, timeoutMs) => waitUntil(() => checkState(selector, text).matched, timeoutMs);
  const waitForInput = (selector, value, timeoutMs) => waitUntil(() => inputState(selector, value).matched, timeoutMs);
  const waitForTooltip = (selector, expected, timeoutMs) => waitUntil(() => tooltipState(selector).visible === expected, timeoutMs);
  const waitForCondition = (condition, timeoutMs) => waitUntil(() => conditionState(condition).matched, timeoutMs);
  const waitForToggle = (selector, kind, state, desired, timeoutMs) => waitUntil(() => prepareToggle(selector, kind, state).checked === desired, timeoutMs);

  root.A11yInteractionChecks = { startObservation, stopObservation, inspectChanges, inspectForms, inspectMedia,
    tooltipCandidates, target, tooltipState, tooltipIssue, prepareInput, prepareClick, prepareDrag, scrollDragTarget, dragEdgeState, advanceDragEdge, dragDropPoint, preparePattern, patternFocus, finishPattern, prepareCheckbox, prepareSelect, prepareToggle, prepareMultiple, multipleState, prepareListbox, listboxState, inspectPlayer, inputState,
    startPasteProbe, inspectPasteProbe, snapshot, checkState, conditionState, actionContext, beginAction, assertAction, inspectMediaObservation, getCoverage, resetCoverage, waitForReady, waitForText, waitForInput, waitForTooltip, waitForCondition, waitForToggle };
})(typeof globalThis !== 'undefined' ? globalThis : window);
