const assert = require('node:assert/strict');
const { test } = require('node:test');
const workflow = require('../accessibility-inspector/utils/workflow-runner.js');

function chromeFixture({ blockNavigation = false, failSetup = false, failDisable = false, disconnectReason, emitDetach = true, anotherDebugger = false, unsupportedWebAudio = false } = {}) {
  const listeners = new Set(), detachListeners = new Set(), commands = [], inspections = [];
  let detached = 0;
  let connected = true;
  const chrome = {
    debugger: {
      attach: async () => {}, detach: async () => { detached++; },
      getTargets: async () => disconnectReason === 'target_closed' && !connected ? [] : [{ tabId: 1, attached: connected || anotherDebugger }],
      onEvent: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) },
      onDetach: { addListener: listener => detachListeners.add(listener), removeListener: listener => detachListeners.delete(listener) },
      sendCommand: async (target, method, params) => {
        commands.push({ method, params });
        if (!connected) throw new Error('Debugger is not attached to the tab with id: 1');
        if (failSetup && method === 'Page.enable') throw new Error('Setup failed');
        if (failDisable && method === 'Fetch.disable') throw new Error('Disable failed');
        if (unsupportedWebAudio && method === 'WebAudio.enable') throw new Error('Method not found');
        if (method === 'Page.getFrameTree') return { frameTree: { frame: { id: 'main' } } };
        if (disconnectReason && method === 'Input.dispatchKeyEvent' && params.type === 'rawKeyDown') {
          connected = false;
          if (emitDetach) for (const listener of detachListeners) listener({ tabId: 1 }, disconnectReason);
        }
        if (blockNavigation && method === 'Input.dispatchKeyEvent' && params.type === 'rawKeyDown') {
          for (const listener of listeners) listener({ tabId: 1 }, 'Fetch.requestPaused', { requestId: 'foreign', frameId: 'main', request: { url: 'https://foreign.test/' } });
        }
      }
    },
    scripting: { executeScript: async ({ args: [, method] }) => {
      inspections.push(method);
      if (disconnectReason === 'target_closed' && commands.some(command => command.method === 'Input.dispatchKeyEvent')) throw new Error('No tab with id: 1');
      return [{ result: { value:
      method === 'snapshot' ? { origin: 'https://example.test', documentId: 'document', fields: [], limits: [] } :
      method === 'actionContext' ? { origin: 'https://example.test', documentId: 'document', frameFocused: false } :
      method === 'prepareInput' ? { selectAllModifiers: 2 } : method === 'waitForInput' ? { matched: true } : { limits: [] }
      } }];
    } }
  };
  return { chrome, commands, inspections, listeners, detachListeners, detached: () => detached };
}

test('production transport aborts paused foreign navigation before sending text and removes its listener', async () => {
  const previous = globalThis.chrome;
  const fixture = chromeFixture({ blockNavigation: true });
  globalThis.chrome = fixture.chrome;
  try {
    const result = await workflow.run(1, { origin: 'https://example.test', steps: [{ action: 'fill', selector: '#field', value: 'test-only' }] }, 'https://example.test/');
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.ok(fixture.commands.some(command => command.method === 'Fetch.failRequest' && command.params.requestId === 'foreign'));
    assert.ok(!fixture.commands.some(command => command.method === 'Input.insertText'));
    assert.equal(result.coverage.debugger.detached, true);
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.detachListeners.size, 0);
  } finally { globalThis.chrome = previous; }
});

test('unsupported Web Audio stops the workflow with diagnostics and still detaches', async () => {
  const previous = globalThis.chrome;
  const fixture = chromeFixture({ unsupportedWebAudio: true });
  globalThis.chrome = fixture.chrome;
  try {
    const result = await workflow.run(1, { origin: 'https://example.test', steps: [{ action: 'web-audio' }, { action: 'fill', selector: '#field', value: 'never' }] }, 'https://example.test/');
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.equal(result.coverage.webAudioObservation.enabled, false);
    assert.ok(result.coverage.webAudioObservation.errors.some(error => /Не удалось включить/.test(error)));
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.detachListeners.size, 0);
    assert.equal(result.coverage.debugger.detached, true);
    assert.ok(!fixture.commands.some(command => command.method.startsWith('Input.')));
  } finally { globalThis.chrome = previous; }
});

test('production transport detaches on setup failure and attempts detachment after Fetch cleanup failure', async () => {
  for (const options of [{ failSetup: true }, { failDisable: true }]) {
    const previous = globalThis.chrome;
    const fixture = chromeFixture(options);
    globalThis.chrome = fixture.chrome;
    try {
      const result = await workflow.run(1, { origin: 'https://example.test', steps: [] }, 'https://example.test/');
      assert.equal(result.coverage.status, 'incomplete');
      assert.equal(fixture.detached(), 1);
      assert.equal(fixture.listeners.size, 0);
      assert.equal(fixture.detachListeners.size, 0);
    } finally { globalThis.chrome = previous; }
  }
});

test('debugger loss and tab closure stop input without detaching an already lost session', async () => {
  for (const reason of ['canceled_by_user', 'target_closed']) {
    const previous = globalThis.chrome;
    const fixture = chromeFixture({ disconnectReason: reason });
    globalThis.chrome = fixture.chrome;
    try {
      const result = await workflow.run(1, { origin: 'https://example.test', steps: [{ action: 'fill', selector: '#field', value: 'test-only' }] }, 'https://example.test/');
      assert.equal(result.coverage.status, 'incomplete');
      assert.equal(result.coverage.steps.length, 0);
      assert.equal(result.coverage.checks.length, 0);
      assert.equal(result.coverage.debugger.connectionLost, true);
      assert.equal(result.coverage.debugger.detached, true);
      assert.equal(result.coverage.debugger.detachReason, reason);
      assert.equal(fixture.detached(), 0);
      assert.equal(fixture.listeners.size, 0);
      assert.equal(fixture.detachListeners.size, 0);
      assert.ok(!fixture.commands.some(command => command.method === 'Input.insertText'));
      assert.ok(!fixture.commands.some(command => command.method === 'Fetch.disable'));
      if (reason === 'canceled_by_user') assert.ok(fixture.inspections.includes('stopObservation'));
    } finally { globalThis.chrome = previous; }
  }
});

test('loss without onDetach is detected even when another debugger is attached', async () => {
  const previous = globalThis.chrome;
  const fixture = chromeFixture({ disconnectReason: 'canceled_by_user', emitDetach: false, anotherDebugger: true });
  globalThis.chrome = fixture.chrome;
  try {
    const result = await workflow.run(1, { origin: 'https://example.test', steps: [{ action: 'fill', selector: '#field', value: 'test-only' }] }, 'https://example.test/');
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.debugger.connectionLost, true);
    assert.equal(result.coverage.debugger.detachReason, 'not_attached');
    assert.equal(fixture.detached(), 0);
    assert.ok(!fixture.commands.some(command => command.method === 'Input.insertText'));
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.detachListeners.size, 0);
  } finally { globalThis.chrome = previous; }
});
