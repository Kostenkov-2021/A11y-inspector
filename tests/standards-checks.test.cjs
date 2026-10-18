const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'accessibility-inspector');
let browser;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)
  });
});

after(async () => {
  if (browser) await browser.close();
});

async function withPage(html, callback, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  try {
    await page.route('https://a11y.test/**', route => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="ru"><head><title>Test page</title></head><body>${html}</body></html>`
    }));
    await page.goto('https://a11y.test/example');
    const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    for (const file of manifest.content_scripts[0].js) {
      if (options.withoutEngine && file === 'vendor/axe.min.js') continue;
      await page.addScriptTag({ path: path.join(extension, file) });
    }
    return await callback(page);
  } finally {
    await page.close();
  }
}

function forRule(result, id) {
  return result.issues.filter(issue => issue.details['Правило'] === id);
}

test('contrast composites alpha and marks complex rendering for manual review', async () => {
  await withPage(`
    <p id="alpha" style="color:rgba(0,0,0,.5);background:white">Alpha text</p>
    <div style="background:black"><p id="layers" style="color:white;background:rgba(255,255,255,.5)">Layers</p></div>
    <p id="gradient" style="background:linear-gradient(white,black)">Gradient</p>
    <p id="modern" style="color:oklch(50% .1 100)">Modern colour</p>
    <p id="aaa" style="color:rgb(100,100,100);background:white">AAA text</p>
    <div role="status" aria-live="polite">Ошибка ввода</div><div role="status" style="display:none"></div>
  `, async page => {
    const values = await page.evaluate(() => ({
      alpha: getContrastRatioForElement(document.querySelector('#alpha')),
      layers: getContrastRatioForElement(document.querySelector('#layers')),
      issues: checkColorContrast(), aaa: checkColorContrast('AAA'), statuses: checkStatusMessages()
    }));
    assert.equal(values.alpha.textColor, 'rgb(127.5, 127.5, 127.5)');
    assert.equal(values.layers.backgroundColor, 'rgb(127.5, 127.5, 127.5)');
    assert.ok(values.issues.some(issue => issue.selector.includes('gradient') && issue.outcome === 'not-tested'));
    assert.ok(values.issues.some(issue => issue.selector.includes('modern') && issue.outcome === 'not-tested'));
    assert.ok(values.aaa.some(issue => issue.selector.includes('aaa') && issue.details.criterion === '1.4.6'));
    assert.ok(!values.statuses.some(issue => ['empty-hidden-live-region', 'error-message-not-assertive'].includes(issue.details.issue)));
    const unavailable = await page.evaluate(() => {
      const original = ColorUtils.calculateContrastRatio;
      try {
        ColorUtils.calculateContrastRatio = () => { throw new Error('Расчёт недоступен'); };
        return getContrastRatioForElement(document.querySelector('#alpha'));
      } finally { ColorUtils.calculateContrastRatio = original; }
    });
    assert.equal(unavailable.incomplete, true);
    assert.equal(unavailable.ratio, undefined);
  });
});

test('valid icon names, decorative images and fallback ARIA roles are accepted', async () => {
  await withPage(`
    <button id="icon" aria-label="Close"><svg aria-hidden="true"></svg></button>
    <img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==">
    <div role="status">Ready</div><div role="alert">Notice</div>
    <div role="heading" aria-level="2">Heading</div>
    <div role="unknown status">Fallback role</div>
  `, async page => {
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    assert.equal(forRule(result, 'aria-roles').length, 0);
    assert.equal(forRule(result, 'button-name').length, 0);
    assert.equal(forRule(result, 'image-alt').length, 0);
    assert.equal(await page.evaluate(() => ['status', 'alert', 'img', 'heading', 'list', 'table'].every(isValidAriaRole)), true);
  });
});

test('missing names, invalid language and required ARIA states produce Russian findings', async () => {
  await withPage(`
    <button id="unnamed" data-long="${'x'.repeat(200)}"></button>
    <div role="switch" aria-label="Power"></div>
    <p lang="invalid_language">Example</p>
    <iframe srcdoc="<p>Example</p>"></iframe>
    <svg role="img"></svg>
  `, async page => {
    await page.evaluate(() => document.documentElement.lang = 'invalid_language');
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    for (const id of ['button-name', 'aria-required-attr', 'valid-lang', 'html-lang-valid', 'frame-title', 'svg-img-alt']) {
      assert.ok(forRule(result, id).length, `Expected ${id}`);
    }
    const issue = forRule(result, 'button-name')[0];
    assert.ok(issue.element.includes('x'.repeat(200)));
    assert.equal(issue.outcome, 'violation');
    assert.match(issue.message, /[А-Яа-яЁё]/);
    assert.ok(issue.details['Стандарты'].includes('ГОСТ Р 52872-2019'));
    assert.equal(result.coverage.rules.length, 41);
  });
});

test('target size accounts for spacing, inline links and disabled controls', async () => {
  await withPage(`
    <style>
      .tiny { position:absolute; top:100px; width:10px; height:10px; padding:0; border:0; }
      #near1 { left:100px } #near2 { left:112px } #alone { left:300px }
      #disabled { left:124px }
    </style>
    <button id="near1" class="tiny" aria-label="First"></button>
    <button id="near2" class="tiny" aria-label="Second"></button>
    <button id="alone" class="tiny" aria-label="Alone"></button>
    <button id="disabled" class="tiny" disabled aria-label="Disabled"></button>
    <p>Text <a id="inline" href="/other">a</a> text</p>
  `, async page => {
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    const issues = forRule(result, 'target-size');
    assert.ok(issues.some(issue => issue.selector.includes('#near1')));
    assert.ok(issues.some(issue => issue.selector.includes('#near2')));
    assert.ok(!issues.some(issue => /#alone|#inline|#disabled/.test(issue.selector)));
    for (const issue of issues) {
      assert.equal(issue.details.criterion, '2.5.8');
      assert.deepEqual(issue.details['Стандарты'], ['WCAG 2.2']);
    }
  });
});

test('standard checks reach content below the viewport and inside open Shadow DOM', async () => {
  await withPage('<div id="host"></div><button id="below" style="margin-top:1500px"></button>', async page => {
    await page.evaluate(() => {
      document.getElementById('host').attachShadow({ mode: 'open' }).innerHTML = '<button id="shadow"></button>';
    });
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    const buttons = forRule(result, 'button-name');
    assert.ok(buttons.some(issue => issue.selector.includes('#below')));
    assert.ok(buttons.some(issue => issue.selector.includes('#shadow')));
  });
});

test('table header references and focus inside aria-hidden are checked', async () => {
  await withPage(`
    <table><tr><th id="known">Header</th><td headers="missing">Value</td></tr></table>
    <div aria-hidden="true"><button id="hidden-focus">Action</button></div>
  `, async page => {
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    assert.ok(forRule(result, 'td-headers-attr').length);
    const hidden = forRule(result, 'aria-hidden-focus');
    assert.ok(hidden.length);
    assert.ok(hidden.every(issue => ['violation', 'incomplete'].includes(issue.outcome)));
  });
});

test('aria-current follows false semantics and does not treat tabs or unrelated anchors as pages', async () => {
  await withPage(`
    <nav>
      <a id="false" class="active" href="/example" aria-current="false">Page</a>
      <a id="current" href="/example" aria-current="page">Current</a>
      <a id="empty" href="/other" aria-current="">Other</a>
      <a id="tab" role="tab" class="active" href="#panel" aria-selected="true">Tab</a>
      <a id="anchor" href="#unrelated">Other section</a>
      <a id="inactive" class="not-active" href="/other">Other</a>
      <a id="custom" href="/other" aria-current="custom-token">Custom</a>
    </nav>
  `, async page => {
    const issues = await page.evaluate(() => checkAriaCurrentForActiveItems());
    assert.ok(issues.some(issue => issue.selector === '#false'));
    assert.ok(!issues.some(issue => ['#current', '#empty', '#tab', '#anchor', '#inactive'].includes(issue.selector)));
    assert.ok(issues.every(issue => issue.type === 'warning'));
  });
});

test('accessible name uses labelledby before label in standard and fallback checks', async () => {
  await withPage('<span id="name">Visible name</span><button id="named" aria-labelledby="name" aria-label="Wrong name">Visible name</button>', async page => {
    assert.equal(await page.evaluate(() => getAccessibleNameForControl(document.getElementById('named'))), 'Visible name');
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    assert.equal(forRule(result, 'label-content-name-mismatch').length, 0);
  });
});

test('legacy checks no longer flag native title tooltips or pointer-events as keyboard barriers', async () => {
  await withPage('<main><h1>Title</h1><button id="pointer" style="pointer-events:none" title="Hint">Action</button></main>', async page => {
    assert.ok(await page.evaluate(() => getFocusableOrderItems().some(item => item.element.id === 'pointer')));
    assert.ok(!(await page.evaluate(() => checkHoverFocusContent())).some(issue => issue.details.issue === 'native-title-tooltip'));
    const issues = await page.evaluate(() => A11yRuleUtils.runAllChecks({ standardsEngine: true }));
    assert.ok(!issues.some(issue => issue.message.includes('индикатора фокуса')));
    assert.ok(!issues.some(issue => issue.message.includes('пропуска навигации')));
  });
});

test('integrated audit preserves coverage and reports engine failures explicitly', async () => {
  await withPage('<main><h1>Title</h1><button id="missing"></button></main>', async page => {
    const report = await page.evaluate(() => runA11yChecks());
    assert.ok(report.coverage.engine.startsWith('axe-core'));
    assert.equal(report.issues.filter(issue => issue.selector.includes('#missing') && issue.details?.['Правило'] === 'button-name').length, 1);
    assert.equal(report.issues.filter(issue => issue.message === 'Кнопка без текстовой подписи').length, 0);
    assert.equal(report.summary.total, report.issues.length);
  });
  await withPage('<main><h1>Title</h1></main>', async page => {
    const report = await page.evaluate(() => runA11yChecks());
    assert.ok(report.issues.some(issue => issue.category === 'system' && issue.message.includes('не выполнены')));
  }, { withoutEngine: true });
});

test('legacy quantity limits survive normalization and make the audit coverage incomplete', async () => {
  await withPage('<main><h1>Title</h1></main>', async page => {
    const result = await page.evaluate(() => {
      a11yScanLimits.clear();
      limitCheckItems(Array.from({ length: 1501 }, (_, index) => index), 1500, 'Тестовая выборка');
      limitCheckItems([1], 1500, 'Тестовая выборка');
      return A11yAuditResults.normalize({ issues: [], coverage: { limits: Array.from(a11yScanLimits.values()) } });
    });
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.limits[0].total, 1501);
    assert.equal(result.coverage.limits[0].processed, 1500);
    assert.equal(result.coverage.limits[0].truncated, true);
  });
});

test('Russian findings and full element markup survive JSON, HTML and text export', async () => {
  await withPage('<button id="export" data-long="' + 'x'.repeat(200) + '"></button>', async page => {
    const result = await page.evaluate(() => A11yStandardsChecks.run());
    const ReportGenerator = require('../accessibility-inspector/utils/report-generator.js');
    const generator = new ReportGenerator();
    const data = { url: 'https://a11y.test/example', issues: result.issues, coverage: result.coverage };
    const json = JSON.parse(generator.generate(data, 'json'));
    assert.deepEqual(json.coverage, result.coverage);
    const issue = forRule(result, 'button-name')[0];
    assert.ok(generator.generate(data, 'text').includes(issue.element));
    assert.ok(generator.generate(data, 'html').includes('x'.repeat(200)));
    assert.ok(!generator.generate(data, 'html').includes('<button id="export"'));
  });
});

test('autonomous HTML preserves script-like element text without executing it', async () => {
  await withPage('<main></main>', async page => {
    await page.addScriptTag({ path: path.join(extension, 'popup/report-popup-local.js') });
    const markup = '<button data-test="' + 'x'.repeat(160) + '"></button></script><script>window.injected=true</script>';
    const report = {
      url: 'https://a11y.test/example', timestamp: '2026-10-18T10:00:00Z',
      summary: { total: 2, errors: 1, warnings: 1 },
      coverage: { scenarios: { status: 'incomplete', completedPhases: ['reflow'], keyboard: [] } },
      issues: [{ type: 'error', category: 'interactive', message: 'Ошибка', element: markup,
        details: { 'Правило': 'button-name', 'Результат': 'Обнаружено нарушение' } },
        { type: 'warning', outcome: 'incomplete', category: 'contrast', message: 'Ручная проверка контраста', details: { 'Причина': 'Градиент' } }]
    };
    const exported = await page.evaluate(data => {
      let html;
      window.downloadFile = value => { html = value; };
      downloadAsHTML(data);
      return html;
    }, report);
    const preview = await browser.newPage();
    try {
      const errors = [];
      preview.on('pageerror', error => errors.push(error.message));
      await preview.setContent(exported);
      assert.equal(await preview.evaluate(() => window.injected), undefined);
      assert.equal(await preview.locator('.issues__list__details__code').first().textContent(), markup);
      const details = (await preview.locator('.issues__list__details__extra').allTextContents()).join(' ');
      assert.ok(details.includes('Обнаружено нарушение'));
      assert.ok(details.includes('Градиент'));
      assert.ok((await preview.locator('header').textContent()).includes('выполнены частично'));
      assert.deepEqual(errors, []);
    } finally {
      await preview.close();
    }
  });
});
