const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createWebAudioMonitor } = require('../accessibility-inspector/utils/workflow-runner.js');

test('Web Audio monitor bounds contexts, nodes, graph edges, events and clock samples', async () => {
  const commands = [];
  let currentTime = 0;
  const monitor = createWebAudioMonitor(async method => {
    commands.push(method);
    if (method === 'WebAudio.getRealtimeData') return { realtimeData: { currentTime: currentTime += 0.1 } };
  });
  await monitor.start();
  for (let index = 0; index < 21; index++) monitor.handleEvent('WebAudio.contextCreated', { context: { contextId: 'c' + index, contextType: 'realtime', contextState: 'running', sampleRate: 48000 } });
  for (let index = 0; index < 201; index++) {
    monitor.handleEvent('WebAudio.audioNodeCreated', { node: { nodeId: 'n' + index, contextId: 'c0', nodeType: 'Gain' } });
    monitor.handleEvent('WebAudio.nodesConnected', { contextId: 'c0', sourceId: 'n' + index, destinationId: 'destination' });
  }
  for (let index = 0; index < 101; index++) await monitor.sample();
  const result = monitor.snapshot();
  assert.equal(result.webAudioObservation.contexts.length, 20);
  assert.equal(result.webAudioObservation.nodes.length, 200);
  assert.equal(result.webAudioObservation.connections.length, 200);
  assert.equal(result.webAudioObservation.events.length, 300);
  assert.equal(result.webAudioObservation.contexts[0].samples.length, 100);
  for (const id of ['web-audio-contexts', 'web-audio-nodes', 'web-audio-connections', 'web-audio-events', 'web-audio-samples-c0']) assert.ok(result.limits.some(limit => limit.id === id && limit.truncated), id);
  await monitor.stop();
  const stopped = monitor.snapshot();
  monitor.handleEvent('WebAudio.contextCreated', { context: { contextId: 'after' } });
  await monitor.sample();
  assert.deepEqual(monitor.snapshot(), stopped);
  assert.equal(commands.at(-1), 'WebAudio.disable');
});

test('Web Audio disconnect and context destruction remove stale graph edges', async () => {
  const monitor = createWebAudioMonitor(async () => {});
  await monitor.start();
  monitor.handleEvent('WebAudio.contextCreated', { context: { contextId: 'c', contextType: 'realtime', contextState: 'suspended' } });
  for (const nodeId of ['a', 'b']) monitor.handleEvent('WebAudio.audioNodeCreated', { node: { contextId: 'c', nodeId, nodeType: 'Gain' } });
  monitor.handleEvent('WebAudio.nodesConnected', { contextId: 'c', sourceId: 'a', destinationId: 'b' });
  monitor.handleEvent('WebAudio.nodesDisconnected', { contextId: 'c', sourceId: 'a', destinationId: 'b' });
  assert.equal(monitor.snapshot().webAudioObservation.connections.length, 0);
  monitor.handleEvent('WebAudio.nodesConnected', { contextId: 'c', sourceId: 'a', destinationId: 'b' });
  monitor.handleEvent('WebAudio.audioNodeWillBeDestroyed', { contextId: 'c', nodeId: 'b' });
  assert.equal(monitor.snapshot().webAudioObservation.connections.length, 0);
  monitor.handleEvent('WebAudio.contextWillBeDestroyed', { contextId: 'c' });
  assert.equal(monitor.snapshot().webAudioObservation.contexts[0].state, 'closed');
  assert.equal(monitor.snapshot().webAudioObservation.nodes.length, 0);
  await monitor.stop();
});

test('unsupported Web Audio domain and lost measurement report explicit diagnostics', async () => {
  const unavailable = createWebAudioMonitor(async () => { throw new Error('Method not found'); });
  await assert.rejects(unavailable.start(), /недоступно/);
  assert.equal(unavailable.snapshot().webAudioObservation.enabled, false);
  assert.ok(unavailable.snapshot().webAudioObservation.errors.some(error => /Не удалось включить/.test(error)));
  const monitor = createWebAudioMonitor(async method => { if (method === 'WebAudio.getRealtimeData') throw new Error('Context disappeared'); });
  await monitor.start();
  monitor.handleEvent('WebAudio.contextCreated', { context: { contextId: 'gone', contextType: 'realtime', contextState: 'running' } });
  const result = await monitor.sample();
  assert.equal(result.webAudioObservation.contexts[0].longestRunningMs, 0);
  assert.ok(result.webAudioObservation.errors.some(error => /Не удалось измерить/.test(error)));
  await monitor.stop();
  const closed = createWebAudioMonitor(async method => {
    if (method === 'WebAudio.getRealtimeData') {
      closed.handleEvent('WebAudio.contextWillBeDestroyed', { contextId: 'closed' });
      throw new Error('Context disappeared');
    }
  });
  await closed.start();
  closed.handleEvent('WebAudio.contextCreated', { context: { contextId: 'closed', contextType: 'realtime', contextState: 'running' } });
  assert.deepEqual((await closed.sample()).webAudioObservation.errors, []);
  await closed.stop();
});
