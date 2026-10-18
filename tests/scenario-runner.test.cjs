const assert = require('node:assert/strict');
const { test } = require('node:test');
const runner = require('../accessibility-inspector/utils/scenario-runner.js');

test('debugger refusal is reported without attempting to detach another session', async () => {
  let detached = false;
  const result = await runner.run(1, {
    attach: async () => { throw new Error('Debugger unavailable'); },
    detach: async () => { detached = true; }
  });
  assert.equal(result.coverage.status, 'incomplete');
  assert.ok(result.issues.some(issue => issue.category === 'system'));
  assert.equal(detached, false);
});

test('every cleanup is attempted after an interrupted resize phase', async () => {
  const cleanup = [];
  const result = await runner.run(1, {
    attach: async () => {},
    detach: async () => { cleanup.push('detach'); },
    send: async method => { cleanup.push(method); },
    inspect: async method => {
      cleanup.push(method);
      if (method === 'captureBaseline') return { vertical: false };
      if (method === 'inspectReflow') return { issues: [] };
      if (method === 'inspectTextResize') throw new Error('Resize interrupted');
      if (method === 'restoreText') throw new Error('Restore interrupted');
    }
  });
  assert.equal(result.coverage.status, 'incomplete');
  assert.ok(cleanup.includes('restoreText'));
  assert.ok(cleanup.includes('restore'));
  assert.ok(cleanup.includes('Emulation.clearDeviceMetricsOverride'));
  assert.equal(cleanup.at(-1), 'detach');
});
