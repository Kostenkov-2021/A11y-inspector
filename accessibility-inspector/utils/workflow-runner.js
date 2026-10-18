(function(root) {
  'use strict';

  const patterns = Object.freeze({
    accordion: 'button[aria-expanded], [role="button"][aria-expanded]',
    alert: '[role="alert"]', alertdialog: '[role="alertdialog"]',
    breadcrumb: 'nav, [role="navigation"]', button: 'button, input[type="button"], input[type="submit"], [role="button"]',
    carousel: '[aria-roledescription], [role="region"], [role="group"]',
    checkbox: 'input[type="checkbox"], [role="checkbox"]', combobox: '[role="combobox"], input[list], select:not([multiple])',
    dialog: 'dialog, [role="dialog"]', disclosure: 'button[aria-expanded], [role="button"][aria-expanded]',
    feed: '[role="feed"]', grid: '[role="grid"]',
    landmarks: 'main, nav, aside, header, footer, form, section[aria-label], [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"], [role="region"], [role="form"]',
    link: 'a[href], [role="link"]', listbox: 'select, [role="listbox"]',
    'menu-menubar': '[role="menu"], [role="menubar"]', 'menu-button': '[aria-haspopup="menu"], [aria-haspopup="true"]',
    meter: 'meter, [role="meter"]', 'radio-group': '[role="radiogroup"], input[type="radio"]',
    slider: 'input[type="range"], [role="slider"]', 'slider-multithumb': 'input[type="range"], [role="slider"]',
    spinbutton: 'input[type="number"], [role="spinbutton"]', switch: '[role="switch"]',
    table: 'table, [role="table"]', tabs: '[role="tablist"]', toolbar: '[role="toolbar"]',
    tooltip: '[role="tooltip"]', 'tree-view': '[role="tree"]', treegrid: '[role="treegrid"]',
    'window-splitter': '[role="separator"][aria-valuenow]'
  });
  const keyCodes = { Tab: 9, Escape: 27, Enter: 13, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
    Home: 36, End: 35, PageUp: 33, PageDown: 34, Backspace: 8, Delete: 46, F2: 113, F10: 121 };
  const characterKey = key => typeof key === 'string' && /^[\p{L}\p{N}]$/u.test(key);

  function validKey(command) {
    if (!command || typeof command !== 'object' || typeof command.key !== 'string' ||
      !(Object.hasOwn(keyCodes, command.key) || characterKey(command.key)) || Object.keys(command).some(key => !['key', 'modifiers', 'expect'].includes(key))) return false;
    const modifiers = command.modifiers ?? 0;
    if (!Number.isInteger(modifiers) || modifiers < 0 || modifiers > 15) return false;
    if (command.key === 'Tab' && ![0, 8].includes(modifiers)) return false;
    // Printable shortcuts are limited to the APG select-all command, not browser/OS commands.
    return !characterKey(command.key) || modifiers === 0 || modifiers === 8 || command.key.toLowerCase() === 'a' && modifiers === 2;
  }

  function createWebAudioMonitor(send) {
    const contexts = new Map(), nodes = new Map(), connections = new Map(), events = [], limits = new Map();
    let active = false, enabled = false, started = 0, stopped = 0;
    let eventTotal = 0, contextTotal = 0, nodeTotal = 0, connectionTotal = 0;
    const errors = [];
    const limit = (id, label, total, maximum, processed) => limits.set(id, { id, label, total, limit: maximum, processed, truncated: total > maximum });
    const error = message => { if (errors.length < 20 && !errors.includes(message)) errors.push(message); };
    const handleEvent = (method, params) => {
      if (!active || !method.startsWith('WebAudio.')) return;
      eventTotal++;
      if (events.length < 300) events.push({ type: method.slice(9), timeMs: Date.now() - started,
        contextId: params.contextId || params.context?.contextId || params.node?.contextId,
        nodeId: params.nodeId || params.node?.nodeId, ...(params.node ? { nodeType: params.node.nodeType } : {}) });
      limit('web-audio-events', 'События Web Audio', eventTotal, 300, events.length);
      if (params.context) {
        const context = params.context;
        let record = contexts.get(context.contextId);
        if (!record) {
          if (contexts.size >= 20 && method !== 'WebAudio.contextCreated') return;
          contextTotal++;
          limit('web-audio-contexts', 'Контексты Web Audio', contextTotal, 20, Math.min(contextTotal, 20));
          if (contexts.size >= 20) return;
          record = { contextId: context.contextId, contextType: context.contextType, samples: [], state: context.contextState,
            sampleRate: context.sampleRate, runMs: 0, longestRunningMs: 0, previous: null };
          contexts.set(context.contextId, record);
        }
        if (record.state !== context.contextState) { record.previous = null; record.runMs = 0; }
        record.state = context.contextState;
      }
      if (method === 'WebAudio.contextWillBeDestroyed' && contexts.has(params.contextId)) {
        const record = contexts.get(params.contextId);
        record.state = 'closed'; record.destroyed = true; record.previous = null;
        for (const [key, connection] of connections) if (connection.contextId === params.contextId) connections.delete(key);
        for (const [key, node] of nodes) if (node.contextId === params.contextId) nodes.delete(key);
      }
      if (method === 'WebAudio.audioNodeCreated') {
        nodeTotal++;
        if (nodes.size < 200) nodes.set(params.node.nodeId, { nodeId: params.node.nodeId, contextId: params.node.contextId, nodeType: params.node.nodeType });
        limit('web-audio-nodes', 'Узлы Web Audio', nodeTotal, 200, Math.min(nodeTotal, 200));
      }
      if (method === 'WebAudio.audioNodeWillBeDestroyed') {
        nodes.delete(params.nodeId);
        for (const [key, connection] of connections) if (connection.sourceId === params.nodeId || connection.destinationId === params.nodeId) connections.delete(key);
      }
      if (method === 'WebAudio.nodesConnected' || method === 'WebAudio.nodeParamConnected') {
        const connection = { contextId: params.contextId, sourceId: params.sourceId, destinationId: params.destinationId, sourceOutputIndex: params.sourceOutputIndex ?? 0, destinationInputIndex: params.destinationInputIndex ?? 0 };
        const key = JSON.stringify(connection);
        connectionTotal++;
        if (connections.size < 200) connections.set(key, connection);
        limit('web-audio-connections', 'Соединения Web Audio', connectionTotal, 200, Math.min(connectionTotal, 200));
      }
      if (method === 'WebAudio.nodesDisconnected' || method === 'WebAudio.nodeParamDisconnected') {
        for (const [key, connection] of connections) if (connection.contextId === params.contextId && connection.sourceId === params.sourceId &&
          (!params.destinationId || connection.destinationId === params.destinationId) &&
          (params.sourceOutputIndex === undefined || connection.sourceOutputIndex === params.sourceOutputIndex) &&
          (params.destinationInputIndex === undefined || connection.destinationInputIndex === params.destinationInputIndex)) connections.delete(key);
      }
    };
    const snapshot = () => ({ webAudioObservation: { enabled, durationMs: (stopped || Date.now()) - started,
      contexts: Array.from(contexts.values(), ({ previous, runMs, ...record }) => ({ ...record, samples: record.samples.slice() })),
      nodes: Array.from(nodes.values()), connections: Array.from(connections.values()), events: events.slice(), errors: errors.slice(),
      limitation: 'Наблюдаются контексты, граф и часы Web Audio, но не звуковые отсчёты, слышимость, громкость выхода, причина запуска и доступность управления. События до включения могут отсутствовать; OOPIF и worker-контексты вне сессии не исследуются' }, limits: Array.from(limits.values()) });
    return {
      handleEvent,
      start: async () => {
        if (active) return;
        started = Date.now(); active = true;
        try { await send('WebAudio.enable'); enabled = true; }
        catch (cause) { active = false; stopped = Date.now(); error('Не удалось включить наблюдение Web Audio: ' + cause.message); throw new Error('Наблюдение Web Audio недоступно'); }
      },
      sample: async () => {
        if (active) for (const record of contexts.values()) {
          if (record.contextType !== 'realtime' || record.destroyed || record.state === 'closed') continue;
          try {
            const { realtimeData } = await send('WebAudio.getRealtimeData', { contextId: record.contextId });
            const at = Date.now(), currentTime = realtimeData.currentTime;
            if (record.previous && record.state === 'running' && currentTime > record.previous.currentTime) record.runMs += Math.min(at - record.previous.at, (currentTime - record.previous.currentTime) * 1000);
            else record.runMs = 0;
            record.longestRunningMs = Math.floor(Math.max(record.longestRunningMs, record.runMs));
            record.previous = { at, currentTime };
            record.sampleTotal = (record.sampleTotal || 0) + 1;
            if (record.samples.length < 100) record.samples.push({ timeMs: at - started, currentTime, state: record.state });
            limit('web-audio-samples-' + record.contextId, 'Измерения часов контекста Web Audio', record.sampleTotal, 100, record.samples.length);
          } catch (cause) {
            record.previous = null; record.runMs = 0;
            if (!record.destroyed && record.state !== 'closed') error('Не удалось измерить часы контекста Web Audio: ' + cause.message);
          }
        }
        return snapshot();
      },
      stop: async () => {
        if (active) {
          active = false; stopped = Date.now();
          try { await send('WebAudio.disable'); } catch (cause) { error('Не удалось отключить наблюдение Web Audio: ' + cause.message); throw cause; }
        }
      },
      snapshot
    };
  }

  function validate(plan, url) {
    if (!plan || plan.origin !== new URL(url).origin || !Array.isArray(plan.steps) || plan.steps.length > 30) throw new Error('Сценарий должен содержать origin проверяемого сайта и не более 30 шагов');
    const actions = new Set(['fill', 'click', 'key', 'drag', 'wait', 'observe', 'media', 'web-audio', 'pattern', 'check', 'paste-probe', 'checkbox', 'select', 'radio', 'multiple', 'listbox', 'aria']);
    for (const step of plan.steps) {
      if (!step || !actions.has(step.action)) throw new Error('Неизвестное действие сценария');
      if (['fill', 'click', 'drag', 'paste-probe', 'checkbox', 'select', 'radio', 'multiple', 'listbox', 'aria', 'media', 'pattern'].includes(step.action) && (typeof step.selector !== 'string' || !step.selector.trim() || step.selector.length > 500)) throw new Error('Не указан допустимый селектор');
      if (step.action === 'pattern') {
        if (!Object.hasOwn(patterns, step.pattern) || !Array.isArray(step.keys) || step.keys.length > 30 || step.keys.some(command => !validKey(command))) throw new Error('Недопустимый ARIA-паттерн или набор клавиш');
        if (step.keys.length && !step.expect) throw new Error('Интерактивный ARIA-паттерн требует постусловия expect');
        if (step.focus !== undefined && (typeof step.focus !== 'string' || !step.focus.trim() || step.focus.length > 500)) throw new Error('Недопустимая цель фокуса паттерна');
        for (const command of step.keys) if (command.expect !== undefined) validate({ origin: plan.origin, steps: [{ action: 'check', expect: command.expect }] }, url);
      }
      if (['fill', 'select'].includes(step.action) && (typeof step.value !== 'string' || step.value.length > 2000)) throw new Error('Недопустимое значение ввода');
      if (step.action === 'checkbox' && typeof step.checked !== 'boolean') throw new Error('Для checkbox нужно логическое checked');
      if (step.action === 'aria' && (!['checked', 'selected', 'expanded', 'pressed'].includes(step.state) || typeof step.value !== 'boolean')) throw new Error('Для aria нужны state и логическое value');
      if (['multiple', 'listbox'].includes(step.action)) {
        const values = step.action === 'multiple' ? step.values : step.options;
        if (!Array.isArray(values) || values.length > 100 || new Set(values).size !== values.length || values.some(value => typeof value !== 'string' || value.length > 500 || step.action === 'listbox' && !value.trim())) throw new Error('Недопустимые варианты списка');
      }
      if (step.action === 'drag' && (typeof step.target !== 'string' || !step.target.trim() || step.target.length > 500 || step.mode !== undefined && !['pointer', 'native'].includes(step.mode) || step.scroll !== undefined && typeof step.scroll !== 'boolean' || step.autoScroll !== undefined && typeof step.autoScroll !== 'boolean')) throw new Error('Недопустимые параметры перетаскивания');
      if (step.action === 'key' && !['Tab', 'Escape', 'Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(step.key)) throw new Error('Недопустимая клавиша');
      if (step.action === 'wait' && (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 2000)) throw new Error('Ожидание должно составлять 0–2000 мс');
      if (step.action === 'observe' && (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 5000)) throw new Error('Наблюдение должно составлять 0–5000 мс');
      if (step.action === 'check' && step.expectedText !== undefined && (typeof step.expectedText !== 'string' || step.expectedText.length > 2000 || typeof step.selector !== 'string' || !step.selector.trim() || step.selector.length > 500)) throw new Error('Для проверки текста нужны допустимые selector и expectedText');
      if (step.timeoutMs !== undefined && (!Number.isInteger(step.timeoutMs) || step.timeoutMs < 0 || step.timeoutMs > 5000)) throw new Error('Тайм-аут шага должен составлять 0–5000 мс');
      if (step.expect !== undefined) {
        const expect = step.expect;
        const supported = new Set(['selector', 'text', 'value', 'values', 'checked', 'selected', 'expanded', 'pressed', 'visible', 'enabled', 'focused', 'attributes']);
        if (!expect || typeof expect !== 'object' || Array.isArray(expect) || typeof expect.selector !== 'string' || !expect.selector.trim() || expect.selector.length > 500 || !Object.keys(expect).some(key => key !== 'selector' && expect[key] !== undefined) || Object.keys(expect).some(key => !supported.has(key))) throw new Error('Недопустимое постусловие expect');
        for (const key of ['text', 'value']) if (expect[key] !== undefined && (typeof expect[key] !== 'string' || expect[key].length > 2000)) throw new Error('Недопустимая строка постусловия');
        for (const key of ['checked', 'selected', 'expanded', 'pressed', 'visible', 'enabled', 'focused']) if (expect[key] !== undefined && typeof expect[key] !== 'boolean') throw new Error('Состояние постусловия должно быть логическим');
        if (expect.values !== undefined && (!Array.isArray(expect.values) || expect.values.length > 100 || new Set(expect.values).size !== expect.values.length || expect.values.some(value => typeof value !== 'string' || value.length > 2000))) throw new Error('Недопустимый набор значений постусловия');
        if (expect.attributes !== undefined && (!expect.attributes || typeof expect.attributes !== 'object' || Array.isArray(expect.attributes) || !Object.keys(expect.attributes).length || Object.keys(expect.attributes).length > 20 || Object.entries(expect.attributes).some(([name, value]) => !/^aria-[a-z]+(?:-[a-z]+)*$/.test(name) || value !== null && (typeof value !== 'string' || value.length > 2000)))) throw new Error('Недопустимые атрибуты постусловия');
      }
    }
  }

  function createTransport(tabId, origin) {
    const target = { tabId };
    let stopped = null;
    let mainFrameId;
    let navigating = false;
    let detached = false;
    let detaching = false;
    let connectionLost = false;
    let everAttached = false;
    let detachReason;
    let dragData = null;
    const pending = new Set();
    const cleanupReads = new Set(['getCoverage', 'stopObservation', 'inspectMediaObservation', 'inspectChanges']);
    const command = async (method, params) => {
      if (connectionLost) throw new Error(stopped);
      try { return await chrome.debugger.sendCommand(target, method, params); }
      catch (error) {
        await verifyConnection();
        throw error;
      }
    };
    const webAudio = createWebAudioMonitor(command);
    const onDetach = (source, reason) => {
      if (source.tabId !== tabId || source.sessionId || connectionLost) return;
      detached = true;
      if (!detaching) {
        connectionLost = true;
        detachReason = reason;
        stopped = reason === 'target_closed' ? 'Вкладка пользовательского сценария закрыта' : 'Соединение с отладчиком потеряно';
      }
    };
    const removeListeners = () => {
      chrome.debugger.onEvent.removeListener(onEvent);
      chrome.debugger.onDetach.removeListener(onDetach);
    };
    const verifyConnection = async () => {
      if (connectionLost) throw new Error(stopped);
      // getTargets().attached can refer to another debugger, not this extension's session.
      try { await chrome.debugger.sendCommand(target, 'Page.getFrameTree'); }
      catch (error) {
        if (connectionLost) throw new Error(stopped);
        const current = (await chrome.debugger.getTargets()).find(item => item.tabId === tabId);
        if (!current) onDetach(target, 'target_closed');
        else if (!current.attached || /not attached/i.test(error.message)) onDetach(target, 'not_attached');
        else throw error;
      }
      if (connectionLost) throw new Error(stopped);
    };
    const onEvent = (source, method, params) => {
      if (source.tabId !== tabId || source.sessionId || connectionLost) return;
      webAudio.handleEvent(method, params);
      if (method === 'Input.dragIntercepted') dragData = params.data;
      if (method === 'Page.frameStartedLoading' && params.frameId === mainFrameId) navigating = true;
      if (method === 'Page.frameStoppedLoading' && params.frameId === mainFrameId) navigating = false;
      if (method === 'Page.frameNavigated' && !params.frame.parentId) {
        mainFrameId = params.frame.id;
        navigating = false;
        if (new URL(params.frame.url).origin !== origin) stopped = 'Сценарий остановлен: изменился origin';
      }
      if (method !== 'Fetch.requestPaused') return;
      if (params.frameId === mainFrameId) navigating = true;
      const foreign = new URL(params.request.url).origin !== origin;
      if (foreign) stopped = 'Сценарий остановлен: переход на другой origin заблокирован';
      // Hold document requests before the network; a later origin check alone races with input.
      const request = command(foreign ? 'Fetch.failRequest' : 'Fetch.continueRequest', foreign ? { requestId: params.requestId, errorReason: 'Aborted' } : { requestId: params.requestId });
      pending.add(request);
      request.catch(() => { if (!connectionLost) stopped = 'Не удалось безопасно обработать переход документа'; }).finally(() => pending.delete(request));
    };
    const retryable = new Set(['waitForReady', 'snapshot', 'getCoverage', 'inspectChanges', 'inspectForms', 'checkState', 'waitForText', 'waitForInput', 'waitForCondition', 'inspectMediaObservation']);
    return {
      attach: async () => {
        await chrome.debugger.attach(target, '1.3');
        everAttached = true;
        try {
          chrome.debugger.onEvent.addListener(onEvent);
          chrome.debugger.onDetach.addListener(onDetach);
          await command('Page.enable');
          mainFrameId = (await command('Page.getFrameTree')).frameTree.frame.id;
          await command('Fetch.enable', { patterns: [{ resourceType: 'Document', requestStage: 'Request' }] });
        } catch (error) {
          removeListeners();
          if (!detached) await chrome.debugger.detach(target);
          throw error;
        }
      },
      detach: async () => {
        if (connectionLost) { removeListeners(); return; }
        try {
          if (navigating || stopped) await command('Page.stopLoading');
          await Promise.allSettled(Array.from(pending));
          await command('Fetch.disable');
        } finally {
          removeListeners();
          if (!detached) {
            detaching = true;
            await chrome.debugger.detach(target);
            detached = true;
          }
        }
      },
      getDebuggerState: () => ({ attached: everAttached, detached, connectionLost, ...(detachReason ? { detachReason } : {}) }),
      startWebAudio: webAudio.start, sampleWebAudio: webAudio.sample, stopWebAudio: webAudio.stop, getWebAudio: webAudio.snapshot,
      waitForDrag: async timeoutMs => {
        const deadline = Date.now() + timeoutMs;
        while (!dragData && Date.now() < deadline) {
          await verifyConnection();
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        if (!dragData) throw new Error('Нативное перетаскивание не началось');
        const data = dragData;
        dragData = null;
        if (data.files?.length || data.items.length > 100) throw new Error('Перетаскивание файлов или более 100 элементов данных не разрешено');
        return data;
      },
      send: (method, params) => {
        if (stopped && method.startsWith('Input.')) throw new Error(stopped);
        return command(method, params);
      },
      inspect: async (method, args = []) => {
        if (stopped && !cleanupReads.has(method)) throw new Error(stopped);
        const deadline = Date.now() + 2000;
        do {
          if (stopped && !cleanupReads.has(method)) throw new Error(stopped);
          if (!cleanupReads.has(method)) await verifyConnection();
          if (navigating && method === 'actionContext') throw new Error('Сценарий остановлен: начался переход документа внутри действия');
          if (navigating && method === 'waitForReady') {
            if (Date.now() >= deadline) throw new Error('Не удалось дождаться завершения перехода документа');
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
          }
          let results;
          try { results = await chrome.scripting.executeScript({ target, args: [origin, method, args], func: async (origin, method, args) => {
            if (location.origin !== origin) return { error: 'Сценарий остановлен: изменился origin' };
            if (document.readyState === 'loading' || typeof A11yInteractionChecks === 'undefined') return { pending: true };
            try { return { value: await A11yInteractionChecks[method](...args) }; }
            catch (error) { return { error: error.message }; }
          } }); }
          catch (error) {
            // A navigation can remove the old frame between readiness and inspection.
            if (connectionLost) throw new Error(stopped);
            if (!retryable.has(method) || Date.now() >= deadline) throw error;
            const tab = await chrome.tabs.get(tabId);
            if (new URL(tab.url).origin !== origin) throw new Error('Сценарий остановлен: изменился origin');
            await new Promise(resolve => setTimeout(resolve, 50));
            continue;
          }
          if (!cleanupReads.has(method)) await verifyConnection();
          if (stopped && !cleanupReads.has(method)) throw new Error(stopped);
          const response = results[0]?.result;
          if (!response) throw new Error('Сценарный модуль недоступен');
          if (response.error) throw new Error(response.error);
          if (!response.pending) return response.value;
          if (Date.now() >= deadline) throw new Error('Не удалось дождаться модуля после перехода');
          await new Promise(resolve => setTimeout(resolve, 50));
        } while (true);
      }
    };
  }

  async function run(tabId, plan, url, transport) {
    validate(plan, url);
    transport = transport || createTransport(tabId, plan.origin);
    const issues = [];
    const coverage = { status: 'incomplete', steps: [], checks: [], limits: [], mediaObservations: [], playerObservations: [], statusObservations: [], patternObservations: [], dragObservations: [], debugger: { attached: false, detached: false }, limitations: [
      'Выполняются только явно заданные действия; значения ввода в журнал шагов не записываются',
      'Перетаскивание проверяет указательную последовательность, но не доказывает эквивалентность альтернативы',
      'Вставка исследуется синтетической пробой, а не чтением системного буфера обмена',
      'Без expect подтверждается только отправка действия или состояние нативного поля, но не прикладной результат',
      'Медиасобытия не доказывают слышимость и автоматический запуск; промежутки между документами не наблюдаются',
      'Изменения сайта после разрешённых действий не откатываются; используется отдельная вкладка'
    ] };
    let attached = false;
    let before;
    let actionDocumentId;
    let lastDocumentId;
    let guardAction = false;
    let guardKeyboard = false;
    let webAudioRequested = false;
    const purposes = new Map();
    const started = Date.now();
    const limits = new Map();
    const remaining = step => Math.max(0, Math.min(step?.timeoutMs ?? 2000, 30000 - (Date.now() - started)));
    const collect = result => {
      if (result.patternObservation) coverage.patternObservations.push(result.patternObservation);
      if (result.webAudioObservation) coverage.webAudioObservation = result.webAudioObservation;
      if (result.playerObservation) coverage.playerObservations.push(result.playerObservation);
      if (result.statusObservation) {
        const index = coverage.statusObservations.findIndex(item => item.documentId === result.statusObservation.documentId);
        if (index < 0) coverage.statusObservations.push(result.statusObservation);
        else coverage.statusObservations[index] = result.statusObservation;
      }
      if (result.mediaObservation) {
        const index = coverage.mediaObservations.findIndex(item => item.documentId === result.mediaObservation.documentId);
        if (index < 0) coverage.mediaObservations.push(result.mediaObservation);
        else coverage.mediaObservations[index] = result.mediaObservation;
      }
      for (const record of result.limits || []) {
        const previous = limits.get(record.id);
        limits.set(record.id, { ...record, total: Math.max(record.total, previous?.total || 0), processed: Math.max(record.processed, previous?.processed || 0), truncated: Boolean(record.truncated || previous?.truncated), totalIsLowerBound: Boolean(record.totalIsLowerBound || previous?.totalIsLowerBound) });
      }
      coverage.limits = Array.from(limits.values());
      for (const issue of result.issues || []) {
        if (!issues.some(item => item.selector === issue.selector && item.message === issue.message)) issues.push(issue);
      }
    };
    const sendInput = async (method, params, release = false) => {
      if (Date.now() - started >= 30000) throw new Error('Достигнут лимит времени пользовательского сценария');
      const context = await transport.inspect('actionContext', [guardAction && !release, guardKeyboard && !release && (method === 'Input.dispatchKeyEvent' || method === 'Input.insertText')]);
      if (context.origin !== plan.origin) throw new Error('Сценарий остановлен: изменился origin');
      if (context.documentId !== actionDocumentId) throw new Error('Сценарий остановлен: документ изменился внутри действия');
      if (context.frameFocused && method !== 'Input.dispatchMouseEvent') throw new Error('Ввод в iframe пользовательским сценарием не поддерживается');
      return transport.send(method, params);
    };
    const pressKey = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
      const params = { key, code, windowsVirtualKeyCode, modifiers };
      await sendInput('Input.dispatchKeyEvent', { ...params, type: 'rawKeyDown' });
      await sendInput('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
    };
    const click = async selector => {
      let point = await transport.inspect('prepareClick', [selector]);
      await sendInput('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      point = await transport.inspect('prepareClick', [selector, point]);
      await sendInput('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      point = await transport.inspect('prepareClick', [selector, point]);
      await sendInput('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    const edgeScroll = async (step, data, index) => {
      const observation = { step: index + 1, ticks: 0, assistedScrolls: 0, completed: false, durationMs: 0 };
      coverage.dragObservations.push(observation);
      const at = Date.now(), budget = remaining(step), deadline = at + budget;
      let previous, wheelPosition;
      try {
        for (let tick = 0; tick < 100 && Date.now() <= deadline; tick++) {
          const state = await transport.inspect('dragEdgeState', [step.target]);
          if (state.done) { observation.completed = true; return state.point; }
          observation.ticks++;
          if (data) await sendInput('Input.dispatchDragEvent', { type: 'dragOver', ...state.point, data });
          else await sendInput('Input.dispatchMouseEvent', { type: 'mouseMoved', ...state.point, button: 'left', buttons: 1 });
          // Allow application scrolling; native interception may need a bounded scrollBy fallback.
          const slow = previous && previous.container === state.container && Math.abs(previous.scrollLeft - state.scrollLeft) + Math.abs(previous.scrollTop - state.scrollTop) < 120;
          if (slow) {
            if ((data || wheelPosition === state.position) && (await transport.inspect('advanceDragEdge', [step.target, state.container])).advanced) observation.assistedScrolls++;
            else await sendInput('Input.dispatchMouseEvent', { type: 'mouseWheel', ...state.point, deltaX: state.dx, deltaY: state.dy, buttons: 1 });
            wheelPosition = state.position;
          } else wheelPosition = null;
          previous = state;
          await new Promise(resolve => setTimeout(resolve, Math.min(40, Math.max(0, deadline - Date.now()))));
        }
        throw new Error('Достигнут лимит краевой автопрокрутки');
      } finally {
        observation.durationMs = Date.now() - at;
        observation.timedOut = !observation.completed && Date.now() >= deadline;
        collect({ limits: [{ id: 'drag-edge-' + (index + 1), label: 'Итерации краевой автопрокрутки', limit: 100,
          total: observation.ticks + (!observation.completed && observation.ticks >= 100 ? 1 : 0), processed: observation.ticks, truncated: !observation.completed && observation.ticks >= 100,
          totalIsLowerBound: !observation.completed && observation.ticks >= 100 },
          { id: 'drag-edge-duration-' + (index + 1), label: 'Время краевой автопрокрутки, мс', limit: budget, total: observation.durationMs,
            processed: Math.min(observation.durationMs, budget), truncated: observation.timedOut }] });
      }
    };
    try {
      await transport.attach();
      attached = true;
      coverage.debugger.attached = true;
      await transport.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await transport.inspect('startObservation');
      for (let index = 0; index < plan.steps.length; index++) {
        if (Date.now() - started > 30000) throw new Error('Достигнут лимит времени пользовательского сценария');
        const step = plan.steps[index];
        collect(await transport.inspect('waitForReady', [remaining()]));
        before = await transport.inspect('snapshot');
        actionDocumentId = before.documentId;
        collect(before);
        const arrived = Boolean(lastDocumentId && lastDocumentId !== before.documentId);
        if (arrived) {
          coverage.steps[coverage.steps.length - 1].navigated = true;
          await transport.inspect('startObservation');
        }
        for (const field of before.fields) {
          if (!field.empty && field.purpose && !purposes.has(field.purpose)) purposes.set(field.purpose, { step: index + 1, selector: field.selector });
        }
        collect(await transport.inspect('inspectMediaObservation'));
        guardAction = ['fill', 'click', 'checkbox', 'select', 'radio', 'multiple', 'listbox', 'aria', 'drag', 'paste-probe', 'key', 'pattern'].includes(step.action);
        guardKeyboard = ['fill', 'select', 'multiple'].includes(step.action);
        if (guardAction) await transport.inspect('beginAction', [step.selector, step.action === 'drag' ? step.target : undefined]);
        if (step.action === 'fill') {
          const prepared = await transport.inspect('prepareInput', [step.selector]);
          const selectAll = { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: prepared.selectAllModifiers };
          await sendInput('Input.dispatchKeyEvent', { ...selectAll, type: 'rawKeyDown' });
          await sendInput('Input.dispatchKeyEvent', { ...selectAll, type: 'keyUp' });
          if (step.value) await sendInput('Input.insertText', { text: step.value });
          else {
            await sendInput('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
            await sendInput('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
          }
          const input = await transport.inspect('waitForInput', [step.selector, step.value, remaining(step)]);
          if (!input.matched) throw new Error('Шаг ' + (index + 1) + ': ввод не подтверждён фактическим значением поля');
        } else if (step.action === 'click') {
          await click(step.selector);
        } else if (['checkbox', 'radio', 'aria'].includes(step.action)) {
          const stateName = step.action === 'aria' ? step.state : 'checked';
          const desired = step.action === 'radio' ? true : step.action === 'aria' ? step.value : step.checked;
          const state = await transport.inspect('prepareToggle', [step.selector, step.action, stateName]);
          if (state.checked !== desired) await click(step.selector);
          if (!(await transport.inspect('waitForToggle', [step.selector, step.action, stateName, desired, remaining(step)])).matched) throw new Error('Состояние элемента управления не подтверждено');
        } else if (step.action === 'select') {
          const prepared = await transport.inspect('prepareSelect', [step.selector, step.value]);
          if (!prepared.unchanged) {
            let committed = false;
            try {
              if (prepared.dropdown !== false) await pressKey('ArrowDown', 'ArrowDown', 40, 1);
              await pressKey('Home', 'Home', 36);
              for (let move = 0; move < prepared.moves; move++) await pressKey('ArrowDown', 'ArrowDown', 40);
              await pressKey('Enter', 'Enter', 13);
              committed = true;
            } finally { if (!committed) await pressKey('Escape', 'Escape', 27); }
          }
          if (!(await transport.inspect('waitForCondition', [{ selector: step.selector, value: step.value }, remaining(step)])).matched) throw new Error('Выбор select не подтверждён');
        } else if (step.action === 'multiple') {
          const prepared = await transport.inspect('prepareMultiple', [step.selector, step.values]);
          await pressKey('Home', 'Home', 36, prepared.modifiers);
          for (let index = 0; index < prepared.toggles.length; index++) {
            if (index) await pressKey('ArrowDown', 'ArrowDown', 40, prepared.modifiers);
            if (prepared.toggles[index]) await pressKey(' ', 'Space', 32, prepared.modifiers);
          }
          if (!(await transport.inspect('multipleState', [step.selector, step.values])).matched) throw new Error('Набор multiple не подтверждён');
        } else if (step.action === 'listbox') {
          const prepared = await transport.inspect('prepareListbox', [step.selector, step.options]);
          for (const selector of prepared.clicks) await click(selector);
          if (!(await transport.inspect('listboxState')).matched) throw new Error('Набор listbox не подтверждён');
        } else if (step.action === 'pattern') {
          collect(await transport.inspect('preparePattern', [step.selector, step.pattern, patterns[step.pattern], step.focus || (step.keys.length ? step.selector : undefined), 'before']));
          for (const command of step.keys) {
            await transport.inspect('patternFocus');
            const key = command.key === 'Space' ? ' ' : command.key;
            const character = characterKey(command.key);
            const code = character ? /^[a-z]$/i.test(key) ? 'Key' + key.toUpperCase() : /^[0-9]$/.test(key) ? 'Digit' + key : '' : command.key;
            const params = { key, code, windowsVirtualKeyCode: keyCodes[command.key] || (/^[a-z0-9]$/i.test(key) ? key.toUpperCase().charCodeAt(0) : 0), modifiers: command.modifiers || 0 };
            await sendInput('Input.dispatchKeyEvent', { ...params, type: character ? 'keyDown' : 'rawKeyDown', ...(character && !((command.modifiers || 0) & 7) ? { text: key } : {}) });
            await sendInput('Input.dispatchKeyEvent', { ...params, type: 'keyUp' }, true);
            if (command.expect && !(await transport.inspect('waitForCondition', [command.expect, remaining(step)])).matched) throw new Error('Промежуточное состояние ARIA-паттерна не достигнуто');
          }
          collect(await transport.inspect('finishPattern', [step.selector, step.pattern, patterns[step.pattern], step.expect?.selector === step.selector && step.expect.visible === false]));
        } else if (step.action === 'web-audio') {
          if (!['startWebAudio', 'sampleWebAudio', 'stopWebAudio', 'getWebAudio'].every(method => typeof transport[method] === 'function')) throw new Error('Транспорт не поддерживает Web Audio');
          webAudioRequested = true;
          await transport.startWebAudio();
          collect(await transport.sampleWebAudio());
        } else if (step.action === 'media') {
          collect(await transport.inspect('inspectPlayer', [step.selector]));
        } else if (step.action === 'key') {
          const key = step.key === 'Space' ? ' ' : step.key;
          const codes = { Tab: 9, Escape: 27, Enter: 13, Space: 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
          const params = { key, code: step.key, windowsVirtualKeyCode: codes[step.key] };
          await sendInput('Input.dispatchKeyEvent', { ...params, type: 'rawKeyDown' });
          await sendInput('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
        } else if (step.action === 'drag') {
          let { start, end } = await transport.inspect('prepareDrag', [step.selector, step.target, step.scroll === true || step.autoScroll === true]);
          const native = step.mode === 'native';
          if (native) await transport.send('Input.setInterceptDrags', { enabled: true });
          let pressed = false;
          try {
            await sendInput('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start });
            await sendInput('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 });
            pressed = true;
            if (native) {
              await sendInput('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + 10, y: start.y, button: 'left', buttons: 1 });
              const data = await transport.waitForDrag(remaining(step));
              if (step.autoScroll) end = await edgeScroll(step, data, index);
              else if (step.scroll) end = await transport.inspect('scrollDragTarget', [step.target]);
              for (const type of ['dragEnter', 'dragOver', 'drop']) {
                end = await transport.inspect('dragDropPoint', [step.target]);
                await sendInput('Input.dispatchDragEvent', { type, ...end, data });
              }
            } else {
              if (step.autoScroll) end = await edgeScroll(step, null, index);
              else if (step.scroll) end = await transport.inspect('scrollDragTarget', [step.target]);
              for (let part = 1; part <= 10; part++) await sendInput('Input.dispatchMouseEvent', {
                type: 'mouseMoved', x: start.x + (end.x - start.x) * part / 10, y: start.y + (end.y - start.y) * part / 10, button: 'left', buttons: 1
              });
            }
          } finally {
            if (native) {
              try { await transport.send('Input.cancelDragging'); }
              finally { await transport.send('Input.setInterceptDrags', { enabled: false }); }
            } else if (pressed && end) {
              end = await transport.inspect('dragDropPoint', [step.target, end]);
              await sendInput('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', buttons: 0, clickCount: 1 });
            }
          }
        } else if (step.action === 'paste-probe') {
          await transport.inspect('startPasteProbe', [step.selector]);
          await new Promise(resolve => setTimeout(resolve, 0));
          collect(await transport.inspect('inspectPasteProbe', [step.selector]));
        } else if (step.action === 'check' && step.expectedText !== undefined) {
          const state = await transport.inspect('waitForText', [step.selector, step.expectedText, remaining(step)]);
          if (!state.matched) throw new Error('Шаг ' + (index + 1) + ': ожидаемое состояние не достигнуто');
          coverage.checks.push({ step: index + 1, check: 'expected-text', outcome: 'passed', assessment: 'automatic' });
        }
        if (guardAction && step.action !== 'pattern' && (await transport.inspect('actionContext')).documentId === actionDocumentId) await transport.inspect('assertAction');
        guardAction = false;
        if (step.action === 'wait') await new Promise(resolve => setTimeout(resolve, step.ms));
        if (step.action === 'observe') {
          const deadline = Date.now() + Math.min(step.ms, remaining({ timeoutMs: step.ms }));
          do {
            collect(await transport.inspect('inspectChanges', [true]));
            collect(await transport.inspect('inspectMediaObservation'));
            if (webAudioRequested) collect(await transport.sampleWebAudio());
            if (Date.now() >= deadline) break;
            await new Promise(resolve => setTimeout(resolve, Math.min(100, deadline - Date.now())));
          } while (true);
        }
        if (step.expect) {
          const state = await transport.inspect('waitForCondition', [step.expect, remaining(step)]);
          if (!state.matched) throw new Error('Шаг ' + (index + 1) + ': постусловие действия не достигнуто');
          coverage.checks.push({ step: index + 1, check: 'postcondition', conditions: Object.keys(step.expect).filter(key => key !== 'selector'), outcome: 'passed', assessment: 'automatic' });
        }
        collect(await transport.inspect('waitForReady', [remaining()]));
        collect(await transport.inspect('inspectChanges'));
        collect(await transport.inspect('inspectForms'));
        const after = await transport.inspect('snapshot');
        collect(after);
        const navigated = before.documentId !== after.documentId;
        if (navigated) await transport.inspect('startObservation');
        lastDocumentId = after.documentId;
        collect(await transport.inspect('inspectMediaObservation'));
        if (webAudioRequested) collect(await transport.sampleWebAudio());
        for (const field of after.fields) {
          if (!field.empty && field.purpose && !purposes.has(field.purpose)) purposes.set(field.purpose, { step: index + 1, selector: field.selector });
        }
        for (const field of after.fields) {
          const previous = before.fields.find(item => item.selector === field.selector && item.purpose === field.purpose);
          const source = purposes.get(field.purpose);
          const newlyKnown = source?.step === index + 1 && source.selector !== field.selector;
          if (field.required && field.empty && field.purpose && source && (navigated || arrived || !previous || !previous.empty || !previous.required || newlyKnown)) {
            issues.push({ type: 'warning', outcome: 'incomplete', category: 'interaction', selector: field.selector,
              message: 'Требуется ручная проверка: на следующем шаге повторно запрашиваются ранее введённые данные',
              details: { criterion: '3.3.7', 'Основание': field.purpose.startsWith('label|') ? 'Обязательное пустое поле с точно совпадающей нормализованной подписью и областью формы' : 'Обязательное пустое поле с тем же нормализованным назначением и областью autocomplete',
                'Назначение и область': field.purpose, 'Ранее заполненное поле': source.selector, 'Шаг наблюдения': source.step,
                'Ограничение': 'Проверьте смысл подписи, возможность выбора ранее введённых данных и применимые исключения; разные подписи и области не сопоставляются' } });
          }
        }
        const confirmation = step.expect ? 'postcondition' : step.action === 'check' && step.expectedText !== undefined ? 'expected-text' : ['fill', 'checkbox', 'select', 'radio', 'multiple', 'listbox', 'aria'].includes(step.action) ? 'control-state' : ['observe', 'media', 'web-audio', 'pattern'].includes(step.action) ? 'observation-only' : 'dispatch-only';
        coverage.steps.push({ index: index + 1, action: step.action, status: 'completed', navigated, confirmation });
      }
      coverage.status = coverage.limits.some(record => record.truncated) ? 'incomplete' : 'completed';
    } catch (error) {
      issues.push({ type: 'warning', outcome: 'incomplete', category: 'system', message: 'Пользовательский сценарий выполнен не полностью', details: { 'Причина': error.message } });
    } finally {
      if (attached) {
        if (webAudioRequested && transport.stopWebAudio) {
          try { collect(await transport.sampleWebAudio()); }
          catch (error) { coverage.status = 'incomplete'; }
          try { await transport.stopWebAudio(); }
          catch (error) { coverage.status = 'incomplete'; }
          collect(transport.getWebAudio());
          if (coverage.webAudioObservation?.errors.length) coverage.status = 'incomplete';
        }
        for (const cleanup of [async () => collect(await transport.inspect('inspectChanges')), async () => collect(await transport.inspect('inspectMediaObservation')), async () => collect(await transport.inspect('getCoverage')), () => transport.inspect('stopObservation'), () => transport.send('Emulation.setFocusEmulationEnabled', { enabled: false }), async () => { await transport.detach(); coverage.debugger.detached = true; }]) {
          try { await cleanup(); } catch (error) {
            coverage.status = 'incomplete';
            issues.push({ type: 'warning', outcome: 'incomplete', category: 'system', message: 'Не удалось полностью завершить пользовательский сценарий', details: { 'Причина': error.message } });
          }
        }
      }
      coverage.durationMs = Date.now() - started;
      if (transport.getDebuggerState) {
        const state = transport.getDebuggerState();
        Object.assign(coverage.debugger, state);
        if (state.connectionLost) coverage.status = 'incomplete';
      }
      coverage.limits.push({ id: 'workflow-steps', label: 'Шаги пользовательского сценария', limit: 30, total: plan.steps.length, processed: coverage.steps.length, truncated: false });
      coverage.limits.push({ id: 'workflow-duration', label: 'Время пользовательского сценария, мс', limit: 30000, total: coverage.durationMs, processed: Math.min(coverage.durationMs, 30000), truncated: coverage.durationMs > 30000 });
      if (coverage.limits.some(record => record.truncated)) coverage.status = 'incomplete';
    }
    return { issues, coverage };
  }

  root.A11yWorkflowRunner = { run, validate, patterns, createWebAudioMonitor };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.A11yWorkflowRunner;
})(typeof globalThis !== 'undefined' ? globalThis : window);
