const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const coverage = require('../accessibility-inspector/utils/report-coverage.js');
globalThis.A11yReportCoverage = coverage;
const ReportGenerator = require('../accessibility-inspector/utils/report-generator.js');

test('scenario limitations remain visible in HTML and text even with no findings', () => {
  const report = {
    url: 'https://example.test', issues: [],
    coverage: { scenarios: { status: 'incomplete', completedPhases: ['reflow'], keyboard: [{ steps: 60 }] } }
  };
  const generator = new ReportGenerator();
  for (const format of ['html', 'text']) {
    const output = generator.generate(report, format);
    assert.ok(output.includes('выполнены частично'));
    assert.ok(output.includes('не подтверждает соответствие'));
    assert.ok(output.includes('60'));
  }
  assert.equal(coverage.describe({}), '');
});

test('truncated limits are visible in human reports even with no findings', () => {
  const report = { url: 'https://example.test', issues: [], coverage: {
    status: 'incomplete', limits: [{ id: 'fields', label: 'Поля проверки ошибок', limit: 1000, total: 1001, processed: 1000, truncated: true }],
    workflow: { status: 'incomplete', steps: [], limitations: [], limits: [{ id: 'status-nodes', label: 'Узлы наблюдения статусов', limit: 200, total: 201, processed: 200, truncated: true, totalIsLowerBound: true }] }
  } };
  const generator = new ReportGenerator();
  for (const format of ['html', 'text']) {
    const output = generator.generate(report, format);
    for (const value of ['неполный', 'Поля проверки ошибок', '1001', 'Узлы наблюдения статусов', 'не менее 201']) assert.ok(output.includes(value), value);
  }
});

test('action confirmations and media observation limitations remain visible without findings', () => {
  const report = { url: 'https://example.test', issues: [], coverage: { workflow: {
    status: 'completed', limitations: [], steps: ['postcondition', 'control-state', 'dispatch-only', 'expected-text', 'observation-only'].map(confirmation => ({ confirmation })),
    statusObservations: [{ durationMs: 900, events: [{}] }],
    playerObservations: [{ selector: '#player', media: ['#audio'], controls: [{}], limitation: 'Связь контролов требует подтверждения' }],
    patternObservations: [{ pattern: 'slider', elements: [{}], limitation: 'Проверяются только заданные клавиши' }],
    dragObservations: [{ completed: true, ticks: 8, assistedScrolls: 2, durationMs: 700 }],
    webAudioObservation: { enabled: true, contexts: [{}], events: [{}], errors: [], limitation: 'Часы контекста не доказывают слышимость' },
    mediaObservations: [{ durationMs: 3456, elements: [{}], events: [{ type: 'playing' }], limitation: 'Слышимость и автоматический запуск не подтверждаются' }]
  } } };
  const generator = new ReportGenerator();
  const context = vm.createContext({ document: { getElementById: () => ({}), addEventListener() {} }, marked: { setOptions() {} }, A11yReportCoverage: coverage });
  vm.runInContext(fs.readFileSync(path.resolve('accessibility-inspector/popup/report-popup-local.js'), 'utf8'), context);
  const markdown = context.parseReportAsMarkdwon({ ...report, summary: { total: 0, warnings: 0, errors: 0 } });
  for (const output of [generator.generate(report, 'html'), generator.generate(report, 'text'), markdown]) {
    for (const value of ['постусловие', 'только отправка действия', 'только наблюдение', 'ожидаемый текст', '3456', 'Слышимость и автоматический запуск не подтверждаются', 'Наблюдение статусов: 900', 'Пользовательский медиаплеер: #player', 'Связь контролов требует подтверждения', 'Наблюдение ARIA-паттерна', 'Ползунок', 'Наблюдение Web Audio', 'Часы контекста не доказывают слышимость', 'резервных прокруток: 2']) assert.ok(output.includes(value), value);
  }
});

test('debugger loss has a Russian explanation in HTML, Markdown and text reports', () => {
  const generator = new ReportGenerator();
  const context = vm.createContext({ document: { getElementById: () => ({}), addEventListener() {} }, marked: { setOptions() {} }, A11yReportCoverage: coverage });
  vm.runInContext(fs.readFileSync(path.resolve('accessibility-inspector/popup/report-popup-local.js'), 'utf8'), context);
  for (const [detachReason, reason] of [['target_closed', 'вкладка закрыта'], ['canceled_by_user', 'подключение завершено извне'], ['not_attached', 'подключение отсутствует']]) {
    const report = { url: 'https://example.test', issues: [], summary: { total: 0, errors: 0, warnings: 0 }, coverage: { workflow: {
      status: 'incomplete', steps: [], limitations: [], debugger: { attached: true, detached: true, connectionLost: true, detachReason }
    } } };
    for (const output of [generator.generate(report, 'html'), generator.generate(report, 'text'), context.parseReportAsMarkdwon(report)]) {
      assert.ok(output.includes('Соединение с отладчиком потеряно: ' + reason));
      assert.ok(output.includes('выполнен частично'));
    }
  }
});
