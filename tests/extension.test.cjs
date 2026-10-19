const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { version: axeVersion } = require('axe-core/package.json');

const fixture = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Проверка расширения</title>
<style>body{font:16px sans-serif}button:focus{outline:3px solid black}#tip{display:none;position:fixed;left:160px;top:30px;background:white;border:1px solid black;padding:10px}#drag,#drop{width:80px;height:50px;background:green;margin:20px;touch-action:none}#drop{margin-left:200px}#gradient{background:linear-gradient(white,black);color:gray}</style></head><body>
<main><h1>Тестовые действия</h1><button id="hint" aria-describedby="tip">Подсказка</button><div role="tooltip" id="tip">Подробности</div>
<p id="gradient">Контраст на градиенте</p><p id="alpha" style="color:rgba(0,0,0,.5);background:white">Полупрозрачный текст</p>
<div id="step"><label for="email">Почта</label><input id="email" required autocomplete="email"></div><button id="next">Далее</button>
<label><input id="agree" type="checkbox">Согласие</label><label for="choice">Вариант</label><select id="choice"><option value="first">Первый</option><option value="second">Второй</option></select><div id="selection"></div>
<button id="navigate">Следующая страница</button>
<label for="password">Пароль</label><input id="password" type="password" autocomplete="off"><button id="signin">Войти</button><div role="status" id="signed"></div>
<label for="invalid">Данные</label><input id="invalid"><button id="validate">Проверить</button><div class="status" id="status"></div>
<div id="drag" draggable="false">Переместить</div><div id="drop">Цель</div><button id="alternative">Переместить без перетаскивания</button>
<video id="video"></video><button id="last">Последняя кнопка</button></main>
<script>
const hint=document.querySelector('#hint'),tip=document.querySelector('#tip');
hint.addEventListener('mouseenter',()=>tip.style.display='block');hint.addEventListener('focus',()=>tip.style.display='block');
hint.addEventListener('mouseleave',()=>tip.style.display='none');hint.addEventListener('blur',()=>tip.style.display='none');
document.addEventListener('keydown',event=>{if(event.key==='Escape')tip.style.display='none'});
document.querySelector('#password').addEventListener('paste',event=>event.preventDefault());
document.querySelector('#signin').onclick=()=>{if(document.querySelector('#password').value==='not-a-real-password')document.querySelector('#signed').textContent='Вход выполнен'};
document.querySelector('#validate').onclick=()=>{document.querySelector('#invalid').setAttribute('aria-invalid','true');document.querySelector('#status').textContent='Ошибка ввода'};
document.querySelector('#next').onclick=()=>document.querySelector('#step').innerHTML='<label for="repeat">Почта повторно</label><input id="repeat" required autocomplete="EMAIL">';
document.querySelector('#choice').onchange=event=>{if(event.isTrusted&&document.querySelector('#agree').checked)document.querySelector('#selection').textContent='Второй вариант выбран'};
document.querySelector('#navigate').onclick=()=>location.href='/second';
let dragging=false;document.querySelector('#drag').addEventListener('pointerdown',()=>dragging=true);
document.addEventListener('pointerup',()=>{if(dragging){document.querySelector('#drop').textContent='Готово';dragging=false}});
document.querySelector('#alternative').onclick=()=>document.querySelector('#drop').textContent='Альтернатива';
</script></body></html>`;

const extendedFixture = `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Новые действия</title><main>
<label><input id="radio" type="radio" name="choice">Выбор</label>
<label>Несколько вариантов<select id="multi" multiple><option value="a">А</option><option value="b">Б</option><option value="c">В</option></select></label>
<button id="expand" aria-expanded="false">Открыть</button><div id="host"></div><iframe id="frame" title="Тестовый фрейм" src="/child"></iframe>
<div id="slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="10" aria-valuenow="1">Громкость</div><button id="audio-play">Запустить Web Audio</button><button id="audio-stop">Остановить Web Audio</button>
<div id="native" draggable="true" style="width:100px;height:50px">Переместить</div><div style="height:1400px"></div><div id="native-drop" style="height:80px">Ожидание</div>
<div class="status" id="late"></div><button id="late-button">Обновить позже</button></main><script>
document.querySelector('#expand').onclick=event=>event.currentTarget.setAttribute('aria-expanded','true');
document.querySelector('#slider').onkeydown=event=>{if(event.isTrusted&&event.key==='ArrowRight')event.currentTarget.setAttribute('aria-valuenow','2')};
document.querySelector('#audio-play').onclick=()=>{window.audio=new AudioContext();const source=audio.createOscillator(),gain=audio.createGain();gain.gain.value=0;source.connect(gain).connect(audio.destination);source.start();void audio.resume()};
document.querySelector('#audio-stop').onclick=()=>audio.close();
document.querySelector('#host').attachShadow({mode:'open'}).innerHTML='<input id="shadow" aria-label="Поле">';
document.querySelector('#native').ondragstart=event=>event.dataTransfer.setData('text/plain','site-data');
document.querySelector('#native-drop').ondragover=event=>event.preventDefault();
document.querySelector('#native-drop').ondrop=event=>{event.preventDefault();if(event.isTrusted&&event.dataTransfer.getData('text/plain')==='site-data')event.currentTarget.textContent='Готово'};
document.querySelector('#late-button').onclick=()=>setTimeout(()=>document.querySelector('#late').textContent='Позднее сообщение',500);
</script></html>`;

test('installed extension runs real debugger scenarios and an explicit local workflow', { timeout: 180000 }, async () => {
  let foreignRequests = 0;
  const foreignServer = http.createServer((request, response) => {
    foreignRequests++;
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Другой origin</title><input id="foreign" autofocus>');
  });
  await new Promise(resolve => foreignServer.listen(0, '127.0.0.1', resolve));
  const foreignOrigin = 'http://127.0.0.1:' + foreignServer.address().port;
  const server = http.createServer((request, response) => {
    if (request.url === '/extended' || request.url === '/child') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.url === '/extended' ? extendedFixture : '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Фрейм</title><label for="child">Данные</label><input id="child"></html>');
      return;
    }
    if (request.url === '/foreign-redirect') {
      response.writeHead(302, { Location: foreignOrigin });
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(request.url === '/origin-race' ? `<!doctype html><html lang="ru"><title>Граница origin</title><label for="field">Поле</label><input id="field"><button id="redirect">Переход</button><script>
      document.querySelector('#field').onkeydown = event => { if (event.ctrlKey && event.key.toLowerCase() === 'a') location.href = '${foreignOrigin}'; };
      document.querySelector('#redirect').onclick = () => location.href = '/foreign-redirect';
    </script></html>` : fixture);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let context;
  try {
    const extension = path.resolve('accessibility-inspector');
    context = await chromium.launchPersistentContext('', {
      channel: process.env.EXTENSION_TEST_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup/popup.html');
    if (process.env.A11Y_SCREENSHOT) await popup.screenshot({ path: process.env.A11Y_SCREENSHOT, fullPage: true });
    assert.equal(await popup.evaluate(() => chrome.permissions.contains({ permissions: ['debugger'] })), true);
    const request = async options => {
      const response = await popup.evaluate(options => chrome.runtime.sendMessage({ action: 'checkAccessibility', format: 'json', ...options }), options);
      assert.equal(response.error, undefined, response.error);
      return JSON.parse(response.report);
    };
    const report = await request({ url: origin, profile: 'wcag22', scenarios: true });
    assert.equal(report.coverage.engine, `axe-core ${axeVersion}`);
    assert.equal(report.coverage.rules.length, 41);
    assert.ok(!report.issues.some(issue => issue.message.startsWith('Стандартные проверки не выполнены')));
    assert.ok(report.coverage.scenarios.completedPhases.includes('tooltips'));
    assert.ok(report.coverage.scenarios.completedPhases.includes('keyboard'));
    assert.ok(report.coverage.scenarios.keyboard.every(item => item.visited >= 5));
    assert.ok(report.coverage.notTested.some(item => item.selector?.includes('gradient')));
    assert.ok(!report.issues.some(issue => issue.details.criterion === '3.3.8'));
    assert.equal(report.coverage.scenarios.debugger.attached, true);
    assert.equal(report.coverage.scenarios.debugger.detached, true);
    assert.ok(report.issues.some(issue => issue.details.criterion === '1.2.2'));
    assert.ok(report.issues.every(issue => ['violation', 'incomplete'].includes(issue.outcome)));
    assert.ok(!report.issues.some(issue => issue.details.criterion === '4.1.1'));
    const workflow = { origin, steps: [
      { action: 'checkbox', selector: '#agree', checked: true },
      { action: 'select', selector: '#choice', value: 'second', expect: { selector: '#selection', text: 'Второй вариант выбран' } },
      { action: 'fill', selector: '#email', value: 'test@example.test' },
      { action: 'click', selector: '#next' },
      { action: 'fill', selector: '#password', value: 'not-a-real-password' },
      { action: 'paste-probe', selector: '#password' },
      { action: 'click', selector: '#signin', expect: { selector: '#signed', text: 'Вход выполнен', visible: true } },
      { action: 'click', selector: '#validate' },
      { action: 'drag', selector: '#drag', target: '#drop' },
      { action: 'check', selector: '#drop', expectedText: 'Готово' },
      { action: 'click', selector: '#alternative' },
      { action: 'check', selector: '#drop', expectedText: 'Альтернатива' }
    ] };
    const active = await request({ url: origin, profile: 'wcag22', workflow });
    assert.equal(active.coverage.workflow.status, 'completed', JSON.stringify(active.issues.filter(issue => issue.category === 'system')));
    assert.equal(active.coverage.workflow.steps.length, workflow.steps.length);
    assert.equal(active.coverage.workflow.debugger.detached, true);
    assert.equal(active.coverage.workflow.checks.length, 4);
    assert.ok(active.coverage.workflow.steps.some(step => step.confirmation === 'postcondition'));
    assert.ok(active.coverage.workflow.steps.some(step => step.action === 'checkbox' && step.confirmation === 'control-state'));
    assert.ok(active.coverage.workflow.mediaObservations.length > 0);
    assert.ok(active.coverage.workflow.checks.every(check => check.outcome === 'passed'));
    const extended = await request({ url: origin + '/extended', workflow: { origin, steps: [
      { action: 'web-audio' },
      { action: 'click', selector: '#audio-play' },
      { action: 'observe', ms: 200 },
      { action: 'click', selector: '#audio-stop' },
      { action: 'pattern', pattern: 'slider', selector: '#slider', keys: [{ key: 'ArrowRight' }], expect: { selector: '#slider', attributes: { 'aria-valuenow': '2' } } },
      { action: 'radio', selector: '#radio' },
      { action: 'multiple', selector: '#multi', values: ['b', 'c'] },
      { action: 'aria', selector: '#expand', state: 'expanded', value: true },
      { action: 'fill', selector: '#host >>> #shadow', value: 'Тест' },
      { action: 'fill', selector: '#frame >>frame>> #child', value: 'Тест фрейма' },
      { action: 'drag', selector: '#native', target: '#native-drop', mode: 'native', autoScroll: true, timeoutMs: 4000, expect: { selector: '#native-drop', text: 'Готово' } },
      { action: 'click', selector: '#late-button' },
      { action: 'observe', ms: 800 }
    ] } });
    assert.equal(extended.coverage.workflow.status, 'completed', JSON.stringify({ issues: extended.issues.filter(issue => issue.category === 'system'), drag: extended.coverage.workflow.dragObservations, steps: extended.coverage.workflow.steps }));
    assert.equal(extended.coverage.workflow.steps.length, 13);
    assert.ok(extended.coverage.workflow.webAudioObservation.enabled);
    assert.ok(extended.coverage.workflow.webAudioObservation.contexts.length > 0);
    assert.equal(extended.coverage.workflow.webAudioObservation.errors.length, 0);
    assert.ok(extended.coverage.workflow.dragObservations[0].completed);
    assert.ok(extended.coverage.workflow.statusObservations.some(observation => observation.events.some(event => event.text === 'Позднее сообщение')));
    assert.equal(extended.coverage.workflow.debugger.detached, true);
    for (const criterion of ['3.3.7', '3.3.8', '3.3.1', '4.1.3']) assert.ok(active.issues.some(issue => issue.details.criterion === criterion), criterion);
    assert.ok(!JSON.stringify(active.coverage.workflow).includes('not-a-real-password'));
    const navigated = await request({ url: origin, profile: 'wcag22', workflow: { origin, steps: [
      { action: 'fill', selector: '#email', value: 'test@example.test' },
      { action: 'click', selector: '#navigate' },
      { action: 'check', selector: '#email', expectedText: '' }
    ] } });
    assert.equal(navigated.coverage.workflow.status, 'completed', JSON.stringify({ coverage: navigated.coverage.workflow, diagnostics: navigated.issues.filter(issue => issue.category === 'system') }));
    assert.ok(navigated.coverage.workflow.steps.some(step => step.navigated));
    assert.ok(navigated.issues.some(issue => issue.details.criterion === '3.3.7'));
    for (const step of [{ action: 'fill', selector: '#field', value: 'test-only-value' }, { action: 'click', selector: '#redirect' }]) {
      const blocked = await request({ url: origin + '/origin-race', workflow: { origin, steps: [step] } });
      assert.equal(blocked.coverage.workflow.status, 'incomplete', JSON.stringify({ step, coverage: blocked.coverage.workflow, issues: blocked.issues.filter(issue => issue.category === 'system'), foreignRequests }));
      assert.equal(blocked.coverage.workflow.steps.length, 0);
      assert.equal(blocked.coverage.workflow.debugger.detached, true);
      assert.ok(blocked.issues.some(issue => /origin|переход/.test(issue.details['Причина'] || '')));
      assert.equal(foreignRequests, 0);
    }
    assert.equal(await worker.evaluate(() => chrome.debugger.onEvent.hasListeners()), false);
    assert.equal(await worker.evaluate(() => chrome.debugger.onDetach.hasListeners()), false);
    const targets = await popup.evaluate(() => chrome.debugger.getTargets());
    assert.ok(targets.filter(target => target.url.startsWith(origin)).every(target => !target.attached));
    const tabs = await popup.evaluate(() => chrome.tabs.query({}));
    assert.ok(!tabs.some(tab => tab.url?.startsWith(origin)));
    await worker.evaluate(() => {
      globalThis.popupStarted = false;
      globalThis.popupResult = null;
      const run = A11yWorkflowRunner.run;
      A11yWorkflowRunner.run = async (...args) => {
        globalThis.popupStarted = true;
        try { const result = await run(...args); globalThis.popupResult = result; return result; }
        finally { A11yWorkflowRunner.run = run; }
      };
    });
    const closingPopup = await context.newPage();
    await closingPopup.goto('chrome-extension://' + id + '/popup/popup.html');
    await closingPopup.evaluate(origin => {
      void chrome.runtime.sendMessage({ action: 'checkAccessibility', url: origin, format: 'json', workflow: { origin, steps: [{ action: 'observe', ms: 900 }] } }).catch(() => {});
    }, origin);
    const popupDeadline = Date.now() + 10000;
    while (!(await worker.evaluate(() => globalThis.popupStarted))) {
      if (Date.now() > popupDeadline) throw new Error('Workflow from closing popup did not start');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await closingPopup.close();
    while (!(await worker.evaluate(() => globalThis.popupResult && chrome.tabs.query({}).then(tabs => !tabs.some(tab => tab.url?.startsWith('http://127.0.0.1:')))) )) {
      if (Date.now() > popupDeadline) throw new Error('Popup closure left workflow resources');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const popupResult = await worker.evaluate(() => globalThis.popupResult);
    assert.equal(popupResult.coverage.status, 'completed');
    assert.equal(popupResult.coverage.debugger.detached, true);
    assert.equal(await worker.evaluate(() => chrome.debugger.onEvent.hasListeners() || chrome.debugger.onDetach.hasListeners()), false);
    for (const mode of ['debugger-loss', 'tab-closed', 'cancelled-select']) {
      const tabId = await popup.evaluate(async url => {
        const tab = await chrome.tabs.create({ url, active: false });
        return tab.id;
      }, origin);
      try {
        await popup.waitForFunction(async tabId => {
          const tab = await chrome.tabs.get(tabId);
          return tab.status === 'complete';
        }, tabId);
        if (mode === 'cancelled-select') await popup.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => {
          document.querySelector('#choice').addEventListener('change', event => { event.target.value = 'first'; });
        } }), tabId);
        if (mode !== 'cancelled-select') await popup.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => {
          const wait = A11yInteractionChecks.waitForCondition;
          A11yInteractionChecks.waitForCondition = (...args) => {
            document.documentElement.dataset.workflowWaiting = 'true';
            return wait(...args);
          };
        } }), tabId);
        await worker.evaluate(({ tabId, origin, mode }) => {
          globalThis.interruptedRun = null;
          const steps = mode === 'cancelled-select' ? [
            { action: 'select', selector: '#choice', value: 'second', timeoutMs: 100 },
            { action: 'check', expect: { selector: '#choice', value: 'second' } }
          ] : [
            { action: 'check', expect: { selector: '#signed', text: 'Ready after disconnect' }, timeoutMs: 5000 },
            { action: 'fill', selector: '#email', value: 'not-sent@example.test' }
          ];
          A11yWorkflowRunner.run(tabId, { origin, steps }, origin).then(result => { globalThis.interruptedRun = result; });
        }, { tabId, origin, mode });
        if (mode !== 'cancelled-select') {
          await popup.waitForFunction(async tabId => {
            const values = await chrome.scripting.executeScript({ target: { tabId }, func: () => document.documentElement.dataset.workflowWaiting === 'true' });
            return values[0]?.result;
          }, tabId);
          if (mode === 'tab-closed') await popup.evaluate(tabId => chrome.tabs.remove(tabId), tabId);
          else {
            await popup.evaluate(tabId => chrome.debugger.detach({ tabId }), tabId);
            await popup.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => {
              document.querySelector('#signed').textContent = 'Ready after disconnect';
            } }), tabId);
          }
        }
        const deadline = Date.now() + 10000;
        let result;
        do {
          result = await worker.evaluate(() => globalThis.interruptedRun);
          if (result) break;
          if (Date.now() >= deadline) throw new Error('Interrupted workflow did not finish');
          await new Promise(resolve => setTimeout(resolve, 50));
        } while (true);
        assert.equal(result.coverage.status, 'incomplete', JSON.stringify({ mode, result }));
        assert.equal(result.coverage.steps.length, 0, mode);
        assert.equal(result.coverage.checks.length, 0, mode);
        if (mode !== 'cancelled-select') {
          assert.equal(result.coverage.debugger.connectionLost, true, JSON.stringify({ mode, result }));
          assert.equal(result.coverage.debugger.detached, true, mode);
          if (mode === 'tab-closed') assert.equal(result.coverage.debugger.detachReason, 'target_closed');
        }
        if (mode === 'debugger-loss') {
          const values = await popup.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => document.querySelector('#email').value }), tabId);
          assert.equal(values[0].result, '');
          const observation = await popup.evaluate(tabId => chrome.scripting.executeScript({ target: { tabId }, func: async () => {
            A11yInteractionChecks.inspectChanges();
            document.querySelector('#status').textContent = 'After cleanup';
            await Promise.resolve();
            return A11yInteractionChecks.inspectChanges();
          } }), tabId);
          assert.equal(observation[0].result.changedStatuses, 0);
        }
        assert.equal(await worker.evaluate(() => chrome.debugger.onEvent.hasListeners()), false);
        assert.equal(await worker.evaluate(() => chrome.debugger.onDetach.hasListeners()), false);
      } finally {
        await popup.evaluate(async tabId => {
          try { await chrome.tabs.remove(tabId); } catch {}
        }, tabId);
      }
    }
    const conflict = await popup.evaluate(async url => {
      const tab = await chrome.tabs.create({ url, active: false });
      await chrome.debugger.attach({ tabId: tab.id }, '1.3');
      return tab.id;
    }, origin);
    try {
      const refused = await worker.evaluate(tabId => A11yScenarioRunner.run(tabId), conflict);
      assert.equal(refused.coverage.status, 'incomplete');
      assert.ok(refused.issues.some(issue => issue.category === 'system'));
      assert.ok((await popup.evaluate(() => chrome.debugger.getTargets())).some(target => target.tabId === conflict && target.attached));
    } finally {
      await popup.evaluate(async tabId => { await chrome.debugger.detach({ tabId }); await chrome.tabs.remove(tabId); }, conflict);
    }
  } finally {
    if (context) await context.close();
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => foreignServer.close(resolve));
  }
});
