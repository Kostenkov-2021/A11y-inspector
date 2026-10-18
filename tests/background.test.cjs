const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ReportGenerator = require('../accessibility-inspector/utils/report-generator.js');

function createBackground(options = {}) {
  const calls = [];
  let closed = false;
  const context = {
    URL, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    window: { a11yInspectorReady: true },
    ColorUtils: {}, A11yRules: {}, axe: {}, A11yAxeLocale: {},
    A11yStandardsChecks: {}, A11yScenarioChecks: {}, A11yInteractionChecks: {}, ReportGenerator,
    runA11yChecks: async () => ({
      url: 'https://a11y.test',
      issues: [{ type: 'error', outcome: 'violation', category: 'language', element: '<html lang="invalid_language"><body>Example</body></html>' }],
      summary: { total: 1, errors: 1, warnings: 0 }
    }),
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      tabs: {
        create: async () => ({ id: 1 }),
        get: (id, callback) => callback({ status: 'complete' }),
        remove: async () => { closed = true; },
        onUpdated: { addListener() {}, removeListener() {} }
      },
      scripting: {
        executeScript: async details => {
          calls.push(details);
          assert.equal(details.function, undefined);
          if (details.files) return [];
          assert.equal(typeof details.func, 'function');
          if (options.htmlError && details.func.name === 'generateReportInContentScript') {
            return [{ result: '<html><body>Server error</body></html>' }];
          }
          return [{ result: await details.func(...(details.args || [])) }];
        }
      }
    }
  };
  vm.createContext(context);
  context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(require.resolve('../accessibility-inspector/' + file), 'utf8'), context));
  vm.runInContext(fs.readFileSync(require.resolve('../accessibility-inspector/background.js'), 'utf8'), context);
  return { context, calls, isClosed: () => closed };
}

test('background awaits the audit and accepts full HTML snapshots in JSON reports', async () => {
  const background = createBackground();
  const response = await background.context.handleAccessibilityCheck('https://a11y.test', 'json');
  assert.ok(JSON.parse(response.report).issues[0].element.includes('<html'));
  assert.equal(background.calls.filter(call => call.files).length, 0);
  assert.equal(background.isClosed(), true);
});

test('background rejects an HTML error document and still closes the checking tab', async () => {
  const background = createBackground({ htmlError: true });
  await assert.rejects(background.context.handleAccessibilityCheck('https://a11y.test', 'json'), /получен HTML/);
  assert.equal(background.isClosed(), true);
});

test('background installs the engine when manifest content scripts are unavailable', async () => {
  const background = createBackground();
  delete background.context.A11yStandardsChecks;
  await background.context.handleAccessibilityCheck('https://a11y.test', 'json');
  const injection = background.calls.find(call => call.files);
  assert.ok(injection.files.includes('vendor/axe.min.js'));
  assert.ok(injection.files.includes('utils/standards-checks.js'));
});

test('scenario results are merged before report generation and summary is recalculated', async () => {
  const background = createBackground();
  background.context.A11yScenarioRunner.run = async tabId => {
    assert.equal(tabId, 1);
    return {
      issues: [{ type: 'warning', outcome: 'incomplete', category: 'reflow', message: 'Проверка адаптации' }],
      coverage: { status: 'completed', completedPhases: ['reflow'] }
    };
  };
  const response = await background.context.handleAccessibilityCheck('https://a11y.test', 'json', { scenarios: true });
  const report = JSON.parse(response.report);
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.warnings, 1);
  assert.equal(report.coverage.scenarios.status, 'completed');
  const auditCall = background.calls.find(call => call.func?.name === 'performAccessibilityCheck');
  assert.equal(auditCall.args[0].scenarios, true);
  assert.equal(background.isClosed(), true);
});
