(function(root) {
  'use strict';

  const MAX_TAB_STEPS = 60;
  const MAX_DURATION = 25000;

  function createTransport(tabId) {
    const target = { tabId };
    return {
      attach: () => chrome.debugger.attach(target, '1.3'),
      detach: () => chrome.debugger.detach(target),
      send: (method, params) => chrome.debugger.sendCommand(target, method, params),
      inspect: async (method, args = []) => {
        const results = await chrome.scripting.executeScript({
          target, args: [method, args],
          func: async (name, values) => {
            try { return { value: await A11yScenarioChecks[name](...values) }; }
            catch (error) { return { error: error.message }; }
          }
        });
        if (!results[0] || !Object.hasOwn(results[0], 'result')) throw new Error('Сценарный модуль страницы недоступен');
        if (results[0].result.error) throw new Error(results[0].result.error);
        return results[0].result.value;
      },
      interaction: async (method, args = []) => {
        const results = await chrome.scripting.executeScript({
          target, args: [method, args], func: async (name, values) => {
            try { return { value: await A11yInteractionChecks[name](...values) }; }
            catch (error) { return { error: error.message }; }
          }
        });
        if (!results[0] || !Object.hasOwn(results[0], 'result')) throw new Error('Модуль интерактивных проверок недоступен');
        if (results[0].result.error) throw new Error(results[0].result.error);
        return results[0].result.value;
      }
    };
  }

  async function run(tabId, transport = createTransport(tabId)) {
    const issues = [];
    const coverage = {
      status: 'incomplete', completedPhases: [], keyboard: [], limits: [], timeouts: [],
      debugger: { attached: false, detached: false },
      scope: 'Основной документ и открытые Shadow DOM; содержимое iframe и закрытые Shadow DOM не проверяются',
      limitations: [
        'Результаты геометрии требуют ручной проверки; отсутствие замечаний не подтверждает соответствие',
        'Проверяются только достигнутые состояния; элементы не активируются нажатием Enter или Space',
        'Увеличение текста выполняется через вычисленные размеры шрифта, без проверки всех режимов браузерного масштаба'
      ]
    };
    let attached = false;
    let prepared = false;
    const started = Date.now();
    const seen = new Set();
    const limits = new Map();
    const collect = result => {
      for (const record of result.limits || []) {
        const previous = limits.get(record.id);
        limits.set(record.id, { ...record, total: Math.max(record.total, previous?.total || 0), processed: Math.max(record.processed, previous?.processed || 0), truncated: Boolean(record.truncated || previous?.truncated), totalIsLowerBound: Boolean(record.totalIsLowerBound || previous?.totalIsLowerBound) });
      }
      coverage.limits = Array.from(limits.values());
      if (result.issueLimitReached) coverage.issueLimitReached = true;
      for (const issue of result.issues || []) {
        const key = issue.selector + '|' + issue.details.criterion + '|' + issue.message;
        if (!seen.has(key)) {
          seen.add(key);
          issues.push(issue);
        }
      }
    };
    const settle = () => transport.inspect('waitForLayout');
    const setViewport = async (width, height) => {
      await transport.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await transport.inspect('waitForLayout', [width, height]);
    };

    try {
      await transport.attach();
      attached = true;
      coverage.debugger.attached = true;
      await transport.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await transport.inspect('prepare');
      prepared = true;
      // Use a desktop baseline before testing the narrow viewport.
      await setViewport(1280, 800);
      const baseline = await transport.inspect('captureBaseline');
      collect(baseline);
      coverage.elementLimitReached = baseline.elementLimitReached;
      await setViewport(baseline.vertical ? 1280 : 320, baseline.vertical ? 256 : 800);
      collect(await transport.inspect('inspectReflow', [baseline.vertical]));
      coverage.completedPhases.push('reflow');
      await setViewport(1280, 800);
      await transport.inspect('beginTextResize');
      await settle();
      collect(await transport.inspect('inspectTextResize'));
      await transport.inspect('restoreText');
      coverage.completedPhases.push('text-resize');

      if (transport.interaction) {
        await transport.interaction('startObservation');
        const tooltips = await transport.interaction('tooltipCandidates');
        collect(await transport.interaction('getCoverage'));
        coverage.tooltips = { candidates: tooltips.length, observed: 0 };
        for (const tooltip of tooltips) {
          if (Date.now() - started > MAX_DURATION) throw new Error('Достигнут лимит времени сценарной проверки');
          const initial = await transport.interaction('tooltipState', [tooltip.popup]);
          if (initial.visible) continue;
          const point = await transport.interaction('target', [tooltip.trigger]);
          await transport.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
          await transport.interaction('waitForReady');
          const appeared = await transport.interaction('waitForTooltip', [tooltip.popup, true, 1000]);
          if (!appeared.matched) coverage.timeouts.push({ check: 'tooltip-hover', selector: tooltip.popup });
          const hover = await transport.interaction('tooltipState', [tooltip.popup]);
          if (hover.visible) {
            coverage.tooltips.observed++;
            const popupPoint = await transport.interaction('target', [tooltip.popup]);
            await transport.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...popupPoint });
            await transport.interaction('waitForReady');
            if (!(await transport.interaction('tooltipState', [tooltip.popup])).visible) collect(await transport.interaction('tooltipIssue', [tooltip.popup, 'подсказка исчезает при переходе указателя на неё']));
          }
          await transport.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
          await transport.interaction('target', [tooltip.trigger, true]);
          await transport.interaction('waitForReady');
          const focused = await transport.interaction('waitForTooltip', [tooltip.popup, true, 1000]);
          if (!focused.matched) coverage.timeouts.push({ check: 'tooltip-focus', selector: tooltip.popup });
          const focus = await transport.interaction('tooltipState', [tooltip.popup]);
          if (hover.visible && !focus.visible) collect(await transport.interaction('tooltipIssue', [tooltip.popup, 'подсказка появляется при наведении, но не при фокусе']));
          if (focus.visible) {
            await transport.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await transport.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            const dismissed = await transport.interaction('waitForTooltip', [tooltip.popup, false, 1000]);
            if (!dismissed.matched) coverage.timeouts.push({ check: 'tooltip-dismiss', selector: tooltip.popup });
            if ((await transport.interaction('tooltipState', [tooltip.popup])).visible) collect(await transport.interaction('tooltipIssue', [tooltip.popup, 'подсказка остаётся видимой после Escape']));
          }
        }
        coverage.completedPhases.push('tooltips');
      }

      for (const direction of ['forward', 'backward']) {
        await transport.inspect('startKeyboard', [direction]);
        const visited = new Set();
        const traversal = { direction, steps: 0, stopped: 'limit' };
        for (let step = 0; step < MAX_TAB_STEPS; step++) {
          if (Date.now() - started > MAX_DURATION) throw new Error('Достигнут лимит времени сценарной проверки');
          const params = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: direction === 'backward' ? 8 : 0 };
          await transport.send('Input.dispatchKeyEvent', { ...params, type: 'rawKeyDown' });
          await transport.send('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
          await settle();
          const focus = await transport.inspect('inspectFocus');
          if (step === 0) await transport.inspect('removeKeyboardAnchor');
          traversal.steps++;
          collect(focus);
          if (focus.escaped) {
            traversal.stopped = 'document-boundary';
            break;
          }
          if (focus.frame) {
            traversal.containsFrame = true;
            continue;
          }
          if (visited.has(focus.nodeId)) {
            traversal.stopped = focus.modal ? 'modal-cycle' : 'cycle';
            if (focus.cycleIssue) collect({ issues: [focus.cycleIssue] });
            break;
          }
          visited.add(focus.nodeId);
          traversal.visited = visited.size;
        }
        coverage.keyboard.push(traversal);
        limits.set('keyboard-' + direction, { id: 'keyboard-' + direction, label: direction === 'forward' ? 'Прямой обход Tab' : 'Обратный обход Shift+Tab', limit: MAX_TAB_STEPS, total: traversal.steps, processed: traversal.steps, truncated: traversal.stopped === 'limit' });
      }
      coverage.completedPhases.push('keyboard');
      if (transport.interaction) {
        const changes = await transport.interaction('inspectChanges');
        collect(changes);
        coverage.changedStatuses = changes.changedStatuses;
        coverage.completedPhases.push('status-observation');
        const media = await transport.interaction('inspectMediaObservation');
        collect(media);
        coverage.mediaObservation = media.mediaObservation;
        coverage.completedPhases.push('media-observation');
      }
      coverage.status = coverage.elementLimitReached || coverage.issueLimitReached || coverage.timeouts.length || coverage.limits.some(record => record.truncated) ||
        coverage.keyboard.some(item => item.stopped !== 'document-boundary' || item.containsFrame) ? 'incomplete' : 'completed';
    } catch (error) {
      issues.push({
        type: 'warning', outcome: 'incomplete', category: 'system',
        message: 'Сценарные проверки выполнены не полностью',
        details: { 'Причина': error.message, 'Завершённые этапы': coverage.completedPhases.slice() }
      });
    } finally {
      // Attempt every cleanup even when navigation or debugger detachment interrupted a phase.
      const cleanup = [];
      if (attached && transport.interaction) cleanup.push(async () => {
        const media = await transport.interaction('inspectMediaObservation');
        collect(media);
        coverage.mediaObservation = media.mediaObservation;
      });
      if (attached && transport.interaction) cleanup.push(async () => collect(await transport.interaction('getCoverage')));
      if (attached && transport.interaction) cleanup.push(() => transport.interaction('stopObservation'));
      if (prepared) cleanup.push(() => transport.inspect('restoreText'));
      if (attached) {
        cleanup.push(async () => {
          await transport.send('Emulation.clearDeviceMetricsOverride', {});
          await settle();
        });
        cleanup.push(() => transport.send('Emulation.setFocusEmulationEnabled', { enabled: false }));
      }
      if (prepared) cleanup.push(() => transport.inspect('restore'));
      if (attached) cleanup.push(async () => { await transport.detach(); coverage.debugger.detached = true; });
      for (const action of cleanup) {
        try { await action(); }
        catch (error) {
          coverage.status = 'incomplete';
          issues.push({
            type: 'warning', outcome: 'incomplete', category: 'system',
            message: 'Не удалось полностью восстановить состояние вкладки проверки',
            details: { 'Причина': error.message }
          });
        }
      }
      coverage.limits = Array.from(limits.values());
      coverage.durationMs = Date.now() - started;
      coverage.limits.push({ id: 'scenario-duration', label: 'Время сценарной проверки, мс', limit: MAX_DURATION, total: coverage.durationMs, processed: Math.min(coverage.durationMs, MAX_DURATION), truncated: coverage.durationMs > MAX_DURATION });
      if (coverage.limits.some(record => record.truncated)) coverage.status = 'incomplete';
    }
    return { issues, coverage };
  }

  root.A11yScenarioRunner = { run };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.A11yScenarioRunner;
})(typeof globalThis !== 'undefined' ? globalThis : window);
