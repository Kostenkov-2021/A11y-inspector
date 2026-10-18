const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const runner = require('../accessibility-inspector/utils/scenario-runner.js');

let browser;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)
  });
});
after(async () => { if (browser) await browser.close(); });

test('popup enables scenario checks only after explicit selection', async () => {
  const page = await browser.newPage({ viewport: { width: 420, height: 700 } });
  try {
    await page.addInitScript(() => {
      window.sentMessages = [];
      window.chrome = {
        tabs: { query: (options, callback) => callback([{ url: 'https://scenario.test/' }]) },
        storage: { local: { get: (keys, callback) => callback({}), set: () => {} } },
        runtime: { sendMessage: (message, callback) => {
          window.sentMessages.push(message);
          callback({ error: 'Тестовый ответ' });
        } }
      };
    });
    await page.goto(pathToFileURL(path.resolve('accessibility-inspector/popup/popup.html')).href);
    const checkbox = page.locator('#scenario-checks');
    assert.equal(await checkbox.isChecked(), false);
    const label = await page.locator('label[for="scenario-checks"]').boundingBox();
    const button = await page.locator('#check-btn').boundingBox();
    assert.ok(label.height > 0 && label.y + label.height <= button.y);
    await page.locator('#check-btn').click();
    await checkbox.check();
    await page.locator('#check-btn').click();
    assert.deepEqual(await page.evaluate(() => sentMessages.map(message => message.scenarios)), [false, true]);
  } finally { await page.close(); }
});

async function withPage(html, callback, viewport = { width: 1000, height: 700 }) {
  const page = await browser.newPage({ viewport });
  try {
    await page.route('https://scenario.test/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="ru"><head><title>Scenario test</title></head><body>' + html + '</body></html>'
    }));
    await page.goto('https://scenario.test/example');
    await page.addScriptTag({ path: path.resolve('accessibility-inspector/utils/scenario-checks.js') });
    await callback(page);
  } finally { await page.close(); }
}

test('reflow finds wide text without reporting a scrollable table as a whole', async () => {
  await withPage(`
    <p id="fixed" style="width:600px">${'This sentence occupies more than one short line. '.repeat(8)}</p>
    <div style="overflow:auto"><table style="width:900px"><tr><td>First</td><td>Second</td><td>Third</td></tr></table></div>
    <p id="fluid">${'This text can reflow. '.repeat(8)}</p>
  `, async page => {
    await page.evaluate(() => A11yScenarioChecks.prepare());
    await page.setViewportSize({ width: 320, height: 700 });
    const result = await page.evaluate(() => A11yScenarioChecks.inspectReflow(false));
    assert.ok(result.issues.some(issue => issue.selector.includes('#fixed')));
    assert.ok(!result.issues.some(issue => issue.selector.includes('#fluid') || issue.element.startsWith('<table')));
    assert.ok(result.issues.every(issue => issue.outcome === 'incomplete' && issue.details.criterion === '1.4.10'));
    await page.evaluate(() => A11yScenarioChecks.restore());
  });
});

test('vertical reflow uses a 256 CSS pixel height', async () => {
  await withPage('<p id="vertical" style="height:600px">' + 'Vertical text example. '.repeat(12) + '</p>', async page => {
    await page.evaluate(() => document.documentElement.style.writingMode = 'vertical-rl');
    await page.evaluate(() => A11yScenarioChecks.prepare());
    await page.setViewportSize({ width: 1000, height: 256 });
    const result = await page.evaluate(() => A11yScenarioChecks.inspectReflow(true));
    assert.ok(result.issues.some(issue => issue.selector.includes('#vertical')));
  });
});

test('200 percent text sizing detects new clipping and restores inline styles exactly', async () => {
  await withPage(`
    <div id="clip" style="width:110px;height:22px;overflow:hidden;font-size:16px">Resize text</div>
    <div id="fluid" style="font-size:16px">Resize text</div>
    <div id="existing" style="width:10px;height:10px;overflow:hidden;font-size:16px">Already clipped text</div>
    <span id="plain">Text without inline styles</span>
    <span id="important" style="font-size:15px!important;color:red">Important</span>
  `, async page => {
    const before = await page.locator('body').innerHTML();
    await page.evaluate(() => A11yScenarioChecks.prepare());
    await page.evaluate(() => A11yScenarioChecks.beginTextResize());
    assert.equal(await page.locator('#important').evaluate(el => getComputedStyle(el).fontSize), '30px');
    const result = await page.evaluate(() => A11yScenarioChecks.inspectTextResize());
    assert.ok(result.issues.some(issue => issue.selector.includes('#clip')));
    assert.ok(!result.issues.some(issue => issue.selector.includes('#fluid') || issue.selector.includes('#existing')));
    assert.ok(result.issues.every(issue => !issue.element.includes('font-size: 32px')));
    await page.evaluate(() => A11yScenarioChecks.restore());
    assert.equal(await page.locator('body').innerHTML(), before);
  });
});

test('a real Tab detects missing focus styling and full but not partial occlusion', async () => {
  await withPage(`
    <style>button:focus { outline:none; box-shadow:none; }
    button { position:fixed;top:100px;width:100px;height:40px;background:white;border:1px solid black; }
    #hidden { left:20px } #partial { left:220px }
    .overlay { position:fixed;top:90px;height:70px;background:black;z-index:10; }
    </style>
    <button id="hidden">Covered</button><button id="partial">Partly</button>
    <div class="overlay" style="left:10px;width:120px"></div>
    <div class="overlay" style="left:210px;width:55px"></div>
  `, async page => {
    await page.evaluate(() => {
      window.trustedKeys = [];
      document.addEventListener('keydown', event => window.trustedKeys.push(event.isTrusted));
      A11yScenarioChecks.prepare();
      A11yScenarioChecks.startKeyboard();
    });
    await page.keyboard.press('Tab');
    const hidden = await page.evaluate(() => A11yScenarioChecks.inspectFocus());
    assert.ok(hidden.issues.some(issue => issue.details.criterion === '2.4.11'));
    assert.ok(hidden.issues.some(issue => issue.details.criterion === '2.4.7'));
    await page.keyboard.press('Tab');
    const partial = await page.evaluate(() => A11yScenarioChecks.inspectFocus());
    assert.ok(!partial.issues.some(issue => issue.details.criterion === '2.4.11'));
    assert.ok((await page.evaluate(() => window.trustedKeys)).every(Boolean));
  });
});

test('the native focus indicator and open Shadow DOM focus are preserved', async () => {
  await withPage('<div id="host"></div><button id="native">Native</button>', async page => {
    await page.evaluate(() => {
      document.querySelector('#host').attachShadow({ mode:'open' }).innerHTML = '<button id="shadow">Shadow</button>';
      A11yScenarioChecks.prepare();
      A11yScenarioChecks.startKeyboard();
    });
    await page.keyboard.press('Tab');
    const result = await page.evaluate(() => A11yScenarioChecks.inspectFocus());
    assert.ok(!result.issues.some(issue => issue.details.criterion === '2.4.11'));
    assert.ok(!result.issues.some(issue => issue.details.criterion === '2.4.7'));
  });
});

test('runner uses CDP keyboard input and restores viewport, focus and fonts', async () => {
  await withPage('<button id="original" tabindex="1">Original focus</button><button id="other">Other</button><button id="last" tabindex="2">Last</button>', async page => {
    await page.locator('#original').focus();
    const client = await page.context().newCDPSession(page);
    const originalWidth = await page.evaluate(() => innerWidth);
    let detached = false;
    const transport = {
      attach: async () => {},
      detach: async () => { detached = true; await client.detach(); },
      send: (method, params) => client.send(method, params),
      inspect: (method, args = []) => page.evaluate(([name, values]) => A11yScenarioChecks[name](...values), [method, args])
    };
    const result = await runner.run(1, transport);
    assert.deepEqual(result.coverage.completedPhases, ['reflow', 'text-resize', 'keyboard']);
    assert.ok(result.coverage.keyboard.every(item => item.steps > 0));
    assert.deepEqual(result.coverage.keyboard.map(item => item.visited), [3, 3]);
    assert.equal(detached, true);
    assert.equal(await page.evaluate(() => innerWidth), originalWidth);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'original');
    assert.equal(await page.locator('#original').getAttribute('style'), null);
  }, null);
});

test('navigation interrupts measurements but fonts are still restored', async () => {
  await withPage('<p id="text" style="font-size:16px">Text</p>', async page => {
    await page.evaluate(() => { A11yScenarioChecks.prepare(); A11yScenarioChecks.beginTextResize(); location.hash = 'changed'; });
    await assert.rejects(page.evaluate(() => A11yScenarioChecks.inspectTextResize()), /Адрес страницы изменился/);
    await page.evaluate(() => A11yScenarioChecks.restore());
    assert.equal(await page.locator('#text').evaluate(el => getComputedStyle(el).fontSize), '16px');
  });
});

test('text restoration preserves unrelated style changes made by the page', async () => {
  await withPage('<p id="text" style="font-size:16px;color:red">Text</p>', async page => {
    await page.evaluate(() => {
      A11yScenarioChecks.prepare();
      A11yScenarioChecks.beginTextResize();
      document.querySelector('#text').style.color = 'blue';
      A11yScenarioChecks.restore();
    });
    const style = await page.locator('#text').evaluate(el => ({ size: getComputedStyle(el).fontSize, color: getComputedStyle(el).color }));
    assert.equal(style.size, '16px');
    assert.equal(style.color, 'rgb(0, 0, 255)');
  });
});
