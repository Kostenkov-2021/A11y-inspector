const assert = require('node:assert/strict');
const { test } = require('node:test');
const results = require('../accessibility-inspector/utils/audit-results.js');
const workflow = require('../accessibility-inspector/utils/workflow-runner.js');

const report = { issues: [
  { type: 'error', category: 'syntax', details: { criterion: '4.1.1' } },
  { outcome: 'violation', details: { criterion: '2.5.8' } },
  { outcome: 'incomplete', details: { criterion: '2.4.13' } },
  { type: 'warning', message: 'Эвристическое замечание' }
] };

test('profiles separate obsolete WCAG parsing, WCAG 2.2 additions and AAA', () => {
  const wcag = results.normalize(report, { profile: 'wcag22' });
  assert.equal(wcag.issues.length, 2);
  assert.equal(wcag.issues[0].details.criterion, '2.5.8');
  assert.deepEqual(wcag.issues[0].details['Стандарты'], ['WCAG 2.2']);
  const gost = results.normalize(report, { profile: 'gost2019' });
  assert.equal(gost.issues.length, 2);
  assert.equal(gost.issues[0].details.criterion, '4.1.1');
  assert.equal(gost.issues[0].outcome, 'incomplete');
  assert.ok(results.normalize(report, { profile: 'wcag22', level: 'AAA' }).issues.some(issue => issue.details.criterion === '2.4.13'));
  assert.deepEqual(results.normalize(gost, { profile: 'gost2019' }), gost);
});

test('workflow rejects foreign origins, unsupported actions and excessive waits before attaching', async () => {
  for (const plan of [
    { origin: 'https://other.test', steps: [] },
    { origin: 'https://example.test', steps: [{ action: 'evaluate' }] },
    { origin: 'https://example.test', steps: [{ action: 'wait', ms: 3000 }] }
  ]) await assert.rejects(workflow.run(1, plan, 'https://example.test/'), /Сценарий|Неизвестное|Ожидание/);
});

test('unmeasured checks are coverage gaps, not accessibility findings', () => {
  const output = results.normalize({ issues: [
    { outcome: 'not-tested', selector: '#gradient', details: { criterion: '1.4.3', 'Причина': 'Градиент' } },
    { outcome: 'violation', details: { criterion: '4.1.2' } },
    { outcome: 'incomplete', details: { criterion: '2.4.7' } },
    { assessment: 'manual', message: 'Оцените смысл изображения', details: { criterion: '1.1.1' } }
  ] });
  assert.equal(output.issues.length, 2);
  assert.deepEqual(output.issues.map(issue => issue.assessment), ['automatic', 'assisted']);
  assert.equal(output.coverage.notTested[0].reason, 'Градиент');
  assert.equal(output.coverage.policy.manualOnlyIncluded, false);
  assert.deepEqual(results.normalize(output), output);
});

test('workflow validates control operations and postconditions before attaching', async () => {
  for (const step of [
    { action: 'checkbox', selector: '#box', checked: 'true' },
    { action: 'select', selector: '#list', value: ['one'] },
    { action: 'select', selector: '', value: 'one' },
    { action: 'radio', selector: '' },
    { action: 'multiple', selector: '#list', values: ['a', 'a'] },
    { action: 'multiple', selector: '#list', values: 'a' },
    { action: 'listbox', selector: '#list', options: [''] },
    { action: 'aria', selector: '#toggle', state: 'value', value: true },
    { action: 'aria', selector: '#toggle', state: 'pressed', value: 'true' },
    { action: 'observe', ms: 5001 },
    { action: 'drag', selector: '#a', target: '#b', mode: 'script' },
    { action: 'drag', selector: '#a', target: '#b', autoScroll: 'true' },
    { action: 'pattern', selector: '#a', pattern: '__proto__', keys: [] },
    { action: 'pattern', selector: '#a', pattern: 'slider', keys: [{ key: 'ArrowRight' }] },
    { action: 'pattern', selector: '#a', pattern: 'slider', keys: [{ key: 'w', modifiers: 2 }], expect: { selector: '#a', visible: true } },
    { action: 'check', expect: { selector: '#a', attributes: { onclick: 'alert(1)' } } },
    { action: 'check', expect: { selector: '#list', values: ['a', 'a'] } },
    { action: 'click', selector: '#button', expect: {} },
    { action: 'click', selector: '#button', expect: { selector: '#result' } },
    { action: 'check', expect: { selector: '#result', visible: undefined } },
    { action: 'check', expect: { selector: '#result', visible: 'false' } },
    { action: 'check', expect: { selector: '#result', text: 42 } },
    { action: 'check', expect: { selector: '#result', script: 'alert(1)' } },
    { action: 'check', expectedText: 'x'.repeat(2001), selector: '#result' }
  ]) {
    let attached = false;
    await assert.rejects(workflow.run(1, { origin: 'https://example.test', steps: [step] }, 'https://example.test/', { attach: async () => { attached = true; } }));
    assert.equal(attached, false);
  }
  assert.doesNotThrow(() => workflow.validate({ origin: 'https://example.test', steps: [
    { action: 'checkbox', selector: '#box', checked: false },
    { action: 'select', selector: '#list', value: '' },
    { action: 'radio', selector: '#radio' },
    { action: 'multiple', selector: '#multi', values: [] },
    { action: 'listbox', selector: '#list', options: ['#a'] },
    { action: 'aria', selector: '#toggle', state: 'pressed', value: true },
    { action: 'observe', ms: 5000 },
    { action: 'media', selector: '#player' },
    { action: 'web-audio' },
    { action: 'pattern', selector: '#a', pattern: 'slider', keys: [{ key: 'ArrowRight' }], expect: { selector: '#a', attributes: { 'aria-valuenow': '2' } } },
    { action: 'drag', selector: '#a', target: '#b', mode: 'native', scroll: true },
    { action: 'check', expect: { selector: '#multi', values: ['a', 'b'] } },
    { action: 'click', selector: '#button', expect: { selector: '#result', text: '', visible: true, enabled: true } }
  ] }, 'https://example.test/'));
});
