const assert = require('node:assert/strict');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const workflow = require('../accessibility-inspector/utils/workflow-runner.js');
const scenario = require('../accessibility-inspector/utils/scenario-runner.js');

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
});
after(async () => { if (browser) await browser.close(); });

async function withPage(html, callback) {
  const page = await browser.newPage({ viewport: null });
  try {
    await page.route('https://interaction.test/**', route => route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Test</title></head><body>' + html + '</body></html>' }));
    await page.goto('https://interaction.test/example');
    for (const file of ['scenario-checks.js', 'interaction-checks.js']) await page.addScriptTag({ path: path.resolve('accessibility-inspector/utils', file) });
    await callback(page);
  } finally { await page.close(); }
}

async function runWorkflow(page, steps, afterSend) {
  const client = await page.context().newCDPSession(page);
  const commands = [];
  const webAudio = workflow.createWebAudioMonitor((method, params) => client.send(method, params));
  for (const type of ['contextCreated', 'contextChanged', 'contextWillBeDestroyed', 'audioNodeCreated', 'audioNodeWillBeDestroyed', 'nodesConnected', 'nodesDisconnected', 'nodeParamConnected', 'nodeParamDisconnected']) client.on('WebAudio.' + type, params => webAudio.handleEvent('WebAudio.' + type, params));
  let dragData;
  client.on('Input.dragIntercepted', event => { dragData = event.data; });
  const result = await workflow.run(1, { origin: 'https://interaction.test', steps }, page.url(), {
    attach: async () => {}, detach: () => client.detach(),
    startWebAudio: webAudio.start, sampleWebAudio: webAudio.sample, stopWebAudio: webAudio.stop, getWebAudio: webAudio.snapshot,
    waitForDrag: async timeoutMs => {
      const deadline = Date.now() + timeoutMs;
      while (!dragData && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      if (!dragData) throw new Error('Native drag did not start');
      return dragData;
    },
    send: async (method, params) => {
      commands.push({ method, params });
      const result = await client.send(method, params);
      if (afterSend) await afterSend(method, params);
      return result;
    },
    inspect: (method, args = []) => page.evaluate(([name, values]) => A11yInteractionChecks[name](...values), [method, args])
  });
  return { ...result, commands };
}

function silentWave(seconds = 6) {
  const wave = Buffer.alloc(44 + 8000 * 2 * seconds);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24); wave.writeUInt32LE(16000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
  wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
  return wave;
}

test('all 30 APG pattern names support explicit structural observation without a conformance pass', async () => {
  const fixtures = {
    accordion: '<button aria-expanded="false">Section</button>', alert: '<div role="alert">Alert</div>', alertdialog: '<div role="alertdialog" aria-label="Alert">Dialog</div>',
    breadcrumb: '<nav aria-label="Path">Path</nav>', button: '<button>Button</button>', carousel: '<div role="region" aria-roledescription="carousel">Slides</div>',
    checkbox: '<input type="checkbox">', combobox: '<input role="combobox" aria-expanded="false">', dialog: '<div role="dialog">Dialog</div>',
    disclosure: '<button aria-expanded="false">Details</button>', feed: '<div role="feed">Articles</div>', grid: '<div role="grid">Cells</div>',
    landmarks: '<main>Main</main>', link: '<a href="#">Link</a>', listbox: '<div role="listbox">Options</div>',
    'menu-menubar': '<div role="menubar">Menu</div>', 'menu-button': '<button aria-haspopup="menu">Menu</button>', meter: '<meter value="0.5">Value</meter>',
    'radio-group': '<div role="radiogroup">Radio</div>', slider: '<div role="slider" aria-valuenow="1">Value</div>',
    'slider-multithumb': '<div><div role="slider" aria-valuenow="1">Start</div><div role="slider" aria-valuenow="2">End</div></div>',
    spinbutton: '<input type="number">', switch: '<div role="switch" aria-checked="false">Switch</div>', table: '<table><tr><td>Cell</td></tr></table>',
    tabs: '<div role="tablist">Tabs</div>', toolbar: '<div role="toolbar">Tools</div>', tooltip: '<div role="tooltip">Hint</div>',
    'tree-view': '<div role="tree">Tree</div>', treegrid: '<div role="treegrid">Tree cells</div>', 'window-splitter': '<div role="separator" aria-valuenow="50">Split</div>'
  };
  assert.equal(Object.keys(workflow.patterns).length, 30);
  assert.deepEqual(Object.keys(fixtures).sort(), Object.keys(workflow.patterns).sort());
  await withPage('<section id="fixture"></section>', async page => {
    for (const [pattern, html] of Object.entries(fixtures)) {
      await page.locator('#fixture').evaluate((element, html) => element.innerHTML = html, html);
      await page.evaluate(() => A11yInteractionChecks.beginAction('#fixture'));
      const result = await page.evaluate(([pattern, candidate]) => A11yInteractionChecks.preparePattern('#fixture', pattern, candidate), [pattern, workflow.patterns[pattern]]);
      assert.ok(result.patternObservation.elements.length > 0, pattern);
      assert.equal(result.patternObservation.pattern, pattern);
      assert.ok(!('outcome' in result.patternObservation), pattern);
    }
  });
});

test('pattern keyboards verify slider, spinbutton, tabs, combobox, tree and dialog outcomes', async () => {
  await withPage('<div id="slider" role="slider" tabindex="0" aria-valuenow="1">Slider</div><input id="spin" type="number" value="1"><div id="tabs" role="tablist"><button id="tab1" role="tab" aria-selected="true">One</button><button id="tab2" role="tab" aria-selected="false">Two</button></div><input id="combo" role="combobox" aria-expanded="false" aria-controls="options"><div id="options" role="listbox"><div id="option" role="option">Option</div></div><div id="tree" role="tree" tabindex="0" aria-activedescendant="node"><div id="node" role="treeitem" aria-expanded="false">Node</div></div><div id="dialog" role="dialog" tabindex="0">Dialog</div>', async page => {
    await page.evaluate(() => {
      document.querySelector('#slider').onkeydown = event => { if (event.isTrusted && event.key === 'ArrowRight') event.currentTarget.setAttribute('aria-valuenow', '2'); };
      document.querySelector('#tab1').onkeydown = event => {
        if (event.isTrusted && event.key === 'ArrowRight') {
          document.querySelector('#tab1').setAttribute('aria-selected', 'false');
          document.querySelector('#tab2').setAttribute('aria-selected', 'true');
          document.querySelector('#tab2').focus();
        }
      };
      document.querySelector('#combo').onkeydown = event => { if (event.isTrusted && event.key === 'ArrowDown') { event.currentTarget.setAttribute('aria-expanded', 'true'); event.currentTarget.setAttribute('aria-activedescendant', 'option'); } };
      document.querySelector('#tree').onkeydown = event => { if (event.isTrusted && event.key === 'ArrowRight') document.querySelector('#node').setAttribute('aria-expanded', 'true'); };
      document.querySelector('#dialog').onkeydown = event => { if (event.isTrusted && event.key === 'Escape') event.currentTarget.remove(); };
    });
    const result = await runWorkflow(page, [
      { action: 'pattern', pattern: 'slider', selector: '#slider', keys: [{ key: 'ArrowRight' }], expect: { selector: '#slider', attributes: { 'aria-valuenow': '2' } } },
      { action: 'pattern', pattern: 'spinbutton', selector: '#spin', keys: [{ key: 'ArrowUp' }], expect: { selector: '#spin', value: '2' } },
      { action: 'pattern', pattern: 'tabs', selector: '#tabs', focus: '#tab1', keys: [{ key: 'ArrowRight' }], expect: { selector: '#tab2', selected: true, focused: true } },
      { action: 'pattern', pattern: 'combobox', selector: '#combo', keys: [{ key: 'ArrowDown' }], expect: { selector: '#combo', expanded: true, attributes: { 'aria-activedescendant': 'option' } } },
      { action: 'pattern', pattern: 'tree-view', selector: '#tree', keys: [{ key: 'ArrowRight' }], expect: { selector: '#node', expanded: true } },
      { action: 'pattern', pattern: 'dialog', selector: '#dialog', keys: [{ key: 'Escape' }], expect: { selector: '#dialog', visible: false } }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.checks.length, 6);
    assert.equal(result.coverage.patternObservations.length, 12);
  });
});

test('pattern focus escape and wrong results never pass or send further keys', async () => {
  await withPage('<div id="tree" role="tree" tabindex="0">Tree</div><input id="outside">', async page => {
    await page.evaluate(() => document.querySelector('#tree').onkeydown = () => document.querySelector('#outside').focus());
    const result = await runWorkflow(page, [{ action: 'pattern', pattern: 'tree-view', selector: '#tree', keys: [{ key: 'ArrowDown' }, { key: 'a' }], timeoutMs: 50, expect: { selector: '#tree', attributes: { 'aria-activedescendant': 'never' } } }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.equal(result.coverage.checks.length, 0);
    assert.equal(await page.locator('#outside').inputValue(), '');
  });
});

test('edge auto-scroll reaches a distant target inside a nested scrolling container', async () => {
  await withPage('<div id="scroller" style="height:180px;width:300px;overflow:auto"><div id="source" style="width:100px;height:40px;touch-action:none">Source</div><div style="height:1300px"></div><div id="drop" style="height:70px">Pending</div></div>', async page => {
    await page.evaluate(() => {
      window.dragging = false;
      document.querySelector('#source').onpointerdown = () => window.dragging = true;
      document.querySelector('#drop').onpointerup = event => { if (event.isTrusted && window.dragging) event.currentTarget.textContent = 'Done'; };
    });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 4000, expect: { selector: '#drop', text: 'Done' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify({ issues: result.issues, drag: result.coverage.dragObservations,
      geometry: await page.evaluate(() => {
        const scroller = document.querySelector('#scroller'), drop = document.querySelector('#drop'), box = drop.getBoundingClientRect();
        return { viewport: [innerWidth, innerHeight], scroll: [scroller.scrollLeft, scroller.scrollTop],
          container: scroller.getBoundingClientRect().toJSON(), target: box.toJSON(),
          hit: document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.outerHTML };
      }) }));
    assert.ok(result.coverage.dragObservations[0].completed);
    assert.ok(result.coverage.dragObservations[0].ticks > 0);
    assert.ok(await page.locator('#scroller').evaluate(element => element.scrollTop > 1000));
    await page.evaluate(() => {
      const html = document.querySelector('#scroller').outerHTML;
      document.body.innerHTML = '<div id="host"></div>';
      const shadow = document.querySelector('#host').attachShadow({ mode: 'open' });
      shadow.innerHTML = html;
      window.dragging = false;
      shadow.querySelector('#drop').textContent = 'Pending';
      shadow.querySelector('#source').onpointerdown = event => { event.preventDefault(); window.dragging = true; };
      shadow.querySelector('#drop').onpointerup = event => { if (event.isTrusted && window.dragging) event.currentTarget.textContent = 'Done'; };
    });
    const shadow = await runWorkflow(page, [{ action: 'drag', selector: '#host >>> #source', target: '#host >>> #drop', autoScroll: true, timeoutMs: 4000, expect: { selector: '#host >>> #drop', text: 'Done' } }]);
    assert.equal(shadow.coverage.status, 'completed', JSON.stringify(shadow.issues));
  });
});

test('edge scrolling waits for a transient obstruction but never completes through a persistent overlay', async () => {
  for (const transient of [true, false]) await withPage('<div id="scroller" style="height:180px;width:300px;overflow:auto"><div id="source" style="height:40px;user-select:none">Source</div><div style="height:1300px"></div><div id="drop" style="height:70px">Pending</div></div><button id="next">Next</button>', async page => {
    await page.evaluate(() => {
      window.clicks = 0;
      document.querySelector('#next').onclick = () => window.clicks++;
      document.querySelector('#source').onpointerdown = event => event.preventDefault();
      document.querySelector('#drop').onpointerup = event => { if (event.isTrusted) event.currentTarget.textContent = 'Done'; };
    });
    let obstructed = false;
    const result = await runWorkflow(page, [
      { action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: transient ? 4000 : 250, expect: { selector: '#drop', text: 'Done' } },
      { action: 'click', selector: '#next' }
    ], async (method, params) => {
      if (method !== 'Input.dispatchMouseEvent' || params.type !== 'mousePressed' || obstructed) return;
      obstructed = true;
      await page.evaluate(transient => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:1000';
        document.body.append(overlay);
        if (transient) setTimeout(() => overlay.remove(), 150);
      }, transient);
    });
    assert.equal(result.coverage.status, transient ? 'completed' : 'incomplete', JSON.stringify(result.issues));
    assert.equal(result.coverage.dragObservations[0].completed, transient);
    assert.equal(await page.evaluate(() => window.clicks), transient ? 1 : 0);
    if (!transient) {
      assert.equal(await page.locator('#drop').textContent(), 'Pending');
      assert.ok(result.coverage.dragObservations[0].timedOut);
      assert.equal(result.coverage.debugger.detached, true);
    }
  });
});

test('Web Audio observes real silent graphs, clock progression, suspension and closure without a sound verdict', async () => {
  await withPage('<button id="play">Play</button><button id="suspend">Suspend</button><button id="close">Close</button>', async page => {
    await page.evaluate(() => {
      document.querySelector('#play').onclick = () => {
        window.audio = new AudioContext();
        const source = audio.createOscillator(), gain = audio.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(audio.destination); source.start();
        void audio.resume();
      };
      document.querySelector('#suspend').onclick = () => audio.suspend();
      document.querySelector('#close').onclick = () => audio.close();
    });
    const result = await runWorkflow(page, [{ action: 'web-audio' }, { action: 'click', selector: '#play' }, { action: 'observe', ms: 500 }, { action: 'click', selector: '#suspend' }, { action: 'observe', ms: 150 }, { action: 'click', selector: '#close' }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    const audio = result.coverage.webAudioObservation;
    assert.equal(audio.enabled, true);
    assert.equal(audio.contexts.length, 1);
    assert.ok(audio.contexts[0].longestRunningMs > 0);
    assert.ok(audio.contexts[0].samples.some(sample => sample.state === 'running'));
    assert.ok(audio.contexts[0].samples.some(sample => sample.state === 'suspended'));
    assert.equal(audio.contexts[0].state, 'closed');
    assert.ok(audio.events.some(event => event.type === 'nodesConnected'));
    assert.ok(!result.issues.some(issue => issue.details.criterion === '1.4.2'));
  });
});

test('edge scrolling handles horizontal RTL containers and keeps target identity', async () => {
  for (const direction of ['ltr', 'rtl']) await withPage('<div id="scroller" style="width:280px;overflow:auto;direction:' + direction + '"><div style="width:1800px;display:flex;justify-content:space-between"><div id="source" style="width:80px;height:50px;flex-shrink:0;user-select:none">Source</div><div id="drop" style="width:80px;height:50px;flex-shrink:0">Pending</div></div></div>', async page => {
    await page.evaluate(() => {
      document.querySelector('#source').onpointerdown = event => event.preventDefault();
      document.querySelector('#drop').onpointerup = event => { if (event.isTrusted) event.currentTarget.textContent = 'Done'; };
    });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 5000, expect: { selector: '#drop', text: 'Done' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify({ direction, issues: result.issues, drag: result.coverage.dragObservations }));
    assert.ok(result.coverage.dragObservations[0].ticks > 0);
  });
});

test('edge scrolling timeout remains incomplete and cannot run subsequent actions', async () => {
  await withPage('<div id="scroller" style="height:150px;overflow:auto"><div id="source" style="height:40px;user-select:none">Source</div><div style="height:1200px"></div><div id="drop" style="height:60px">Pending</div></div><button id="next">Next</button>', async page => {
    await page.evaluate(() => { window.clicks = 0; document.querySelector('#next').onclick = () => window.clicks++; });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 0 }, { action: 'click', selector: '#next' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.equal(await page.evaluate(() => window.clicks), 0);
    assert.ok(result.coverage.dragObservations[0].timedOut);
    assert.ok(result.coverage.limits.some(limit => limit.id.startsWith('drag-edge-duration-') && limit.truncated));
    assert.equal(result.coverage.debugger.detached, true);
  });
});

test('pattern typeahead accepts Russian letters and focus in a linked combobox popup', async () => {
  await withPage('<input id="combo" role="combobox" aria-expanded="false" aria-controls="popup"><div id="popup" role="listbox"><div id="option" role="option" tabindex="-1">Ёлка</div></div>', async page => {
    await page.evaluate(() => {
      document.querySelector('#combo').onkeydown = event => {
        if (event.key === 'ArrowDown') { event.currentTarget.setAttribute('aria-expanded', 'true'); document.querySelector('#option').focus(); }
      };
      document.querySelector('#option').onkeydown = event => {
        if (event.isTrusted && event.key === 'Enter') { document.querySelector('#combo').value = 'Ёлка'; document.querySelector('#combo').focus(); }
      };
    });
    const result = await runWorkflow(page, [{ action: 'pattern', pattern: 'combobox', selector: '#combo', keys: [
      { key: 'Ё', expect: { selector: '#combo', value: 'Ё' } },
      { key: 'ArrowDown', expect: { selector: '#option', focused: true } },
      { key: 'Enter' }
    ], expect: { selector: '#combo', value: 'Ёлка', focused: true } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
  });
});

test('edge scrolling lets an application scroll itself without a reserve jump', async () => {
  await withPage('<div id="scroller" style="height:180px;overflow:auto"><div id="source" style="height:40px;user-select:none">Source</div><div style="height:1000px"></div><div id="drop" style="height:60px">Pending</div></div>', async page => {
    await page.evaluate(() => {
      window.dragging = false;
      const scroller = document.querySelector('#scroller');
      document.querySelector('#source').onpointerdown = event => { event.preventDefault(); window.dragging = true; };
      document.addEventListener('pointermove', event => {
        if (window.dragging && event.clientY > scroller.getBoundingClientRect().bottom - 10) scroller.scrollTop += 200;
      });
      document.querySelector('#drop').onpointerup = event => { if (event.isTrusted && window.dragging) event.currentTarget.textContent = 'Done'; };
    });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 4000, expect: { selector: '#drop', text: 'Done' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.dragObservations[0].assistedScrolls, 0);
  });
});

test('edge scrolling refreshes state after application scrolling before sending a reserve wheel', async () => {
  await withPage('<div id="scroller" style="height:180px;overflow:auto"><div id="source" style="height:40px;user-select:none">Source</div><div style="height:1000px"></div><div id="drop" style="height:60px">Pending</div></div>', async page => {
    await page.evaluate(() => {
      let moves = 0;
      const scroller = document.querySelector('#scroller');
      document.querySelector('#source').onpointerdown = event => event.preventDefault();
      document.addEventListener('pointermove', event => {
        if (event.buttons === 1 && event.clientY > scroller.getBoundingClientRect().bottom - 10 && ++moves === 2) scroller.scrollTop = scroller.scrollHeight;
      });
      document.querySelector('#drop').onpointerup = event => { if (event.isTrusted) event.currentTarget.textContent = 'Done'; };
    });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 4000, expect: { selector: '#drop', text: 'Done' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.ok(!result.commands.some(command => command.params?.type === 'mouseWheel'));
    assert.equal(result.coverage.dragObservations[0].assistedScrolls, 0);
  });
});

test('edge waiting does not hide a same-selector target replacement', async () => {
  await withPage('<div style="height:180px;overflow:auto"><div id="source" style="height:40px;user-select:none">Source</div><div style="height:1000px"></div><div id="drop" style="height:60px">Pending</div></div>', async page => {
    await page.evaluate(() => document.querySelector('#source').onpointerdown = event => {
      event.preventDefault();
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000';
      document.body.append(overlay);
      setTimeout(() => {
        const drop = document.querySelector('#drop');
        drop.replaceWith(drop.cloneNode(true));
      }, 100);
    });
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop', autoScroll: true, timeoutMs: 2000 }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.ok(result.issues.some(issue => /исчезла или была заменена/.test(issue.details['Причина'] || '')));
    assert.ok(!result.commands.some(command => command.params?.type === 'mouseReleased'));
    assert.equal(result.coverage.debugger.detached, true);
  });
});

test('a target moving during the final pointer movement is not released at stale coordinates', async () => {
  await withPage('<div id="source" style="position:fixed;left:40px;top:80px;width:80px;height:40px;user-select:none">Source</div><div id="drop" style="position:fixed;left:300px;top:80px;width:80px;height:40px">Drop</div>', async page => {
    await page.evaluate(() => document.addEventListener('pointermove', event => {
      if (event.buttons === 1 && event.clientX >= 335) document.querySelector('#drop').style.left = '500px';
    }));
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.ok(result.issues.some(issue => /переместилась перед отпусканием/.test(issue.details['Причина'] || '')));
    assert.ok(!result.commands.some(command => command.params?.type === 'mouseReleased'));
  });
});

test('ambiguous check never records a passed assertion', async () => {
  await withPage('<div class="check">OK</div><div class="check">OK</div>', async page => {
    const result = await runWorkflow(page, [{ action: 'check', selector: '.check', expectedText: 'OK' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.checks.length, 0);
    assert.ok(result.issues.some(issue => /неоднозначен/.test(issue.details['Причина'])));
    assert.equal(result.coverage.debugger.detached, true);
  });
});

test('same-selector replacements and disappearing targets cannot complete actions', async () => {
  for (const mode of ['hover-replaced', 'press-removed', 'input-replaced', 'focus-stolen']) {
    await withPage('<button id="target">Target</button><input id="field"><input id="other">', async page => {
      await page.evaluate(mode => {
        const target = document.querySelector('#target'), field = document.querySelector('#field');
        window.replacementClicks = 0;
        if (mode === 'hover-replaced') target.onmouseenter = () => {
          const replacement = target.cloneNode(true);
          replacement.onclick = () => window.replacementClicks++;
          target.replaceWith(replacement);
        };
        if (mode === 'press-removed') target.onmousedown = () => target.remove();
        field.onkeydown = () => {
          if (mode === 'input-replaced') { const replacement = field.cloneNode(); field.replaceWith(replacement); replacement.focus(); }
          if (mode === 'focus-stolen') document.querySelector('#other').focus();
        };
      }, mode);
      const step = mode.startsWith('input') || mode === 'focus-stolen' ? { action: 'fill', selector: '#field', value: 'must-not-be-sent' } : { action: 'click', selector: '#target' };
      const result = await runWorkflow(page, [step]);
      assert.equal(result.coverage.status, 'incomplete', mode);
      assert.equal(result.coverage.steps.length, 0, mode);
      assert.equal(await page.evaluate(() => window.replacementClicks), 0);
      assert.equal(await page.locator('#other').inputValue(), '');
      if (step.action === 'fill') assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
      assert.equal(result.coverage.debugger.detached, true);
    });
  }
});

test('select refuses removal, reordering, replacement and optgroup disablement during keyboard input', async () => {
  for (const mode of ['removed', 'selected-removed', 'reordered', 'replaced', 'disabled-group', 'relabelled']) {
    await withPage('<select id="list"><option value="a">A</option><optgroup id="group" label="Group"><option value="b">B</option><option value="c">C</option></optgroup></select>', async page => {
      let changed = false;
      const result = await runWorkflow(page, [{ action: 'select', selector: '#list', value: 'b', timeoutMs: 100 }], async (method, params) => {
        if (changed || method !== 'Input.dispatchKeyEvent' || params.type !== 'rawKeyDown') return;
        changed = true;
        await page.evaluate(mode => {
          const group = document.querySelector('#group'), option = group.querySelector('option');
          if (mode === 'removed') option.remove();
          if (mode === 'selected-removed') document.querySelector('#list').selectedOptions[0].remove();
          if (mode === 'reordered') group.append(option);
          if (mode === 'replaced') option.replaceWith(option.cloneNode(true));
          if (mode === 'disabled-group') group.disabled = true;
          if (mode === 'relabelled') option.label = 'Another label';
        }, mode);
      });
      assert.equal(result.coverage.status, 'incomplete', mode);
      assert.equal(result.coverage.steps.length, 0, mode);
      assert.equal(result.coverage.checks.length, 0, mode);
      assert.ok(result.issues.some(issue => /вариантов select/.test(issue.details['Причина'] || '')), JSON.stringify(result.issues));
      assert.equal(result.coverage.debugger.detached, true);
    });
  }
});

test('radio, native list and multiple confirm actual trusted control changes', async () => {
  await withPage('<input type="radio" name="r" id="r1" checked><input type="radio" name="r" id="r2"><select id="single" size="3"><option value="a">A</option><option value="b">B</option></select><select id="multi" multiple><option value="a" selected>A</option><option value="b">B</option><option disabled value="c">C</option><option value="d">D</option></select>', async page => {
    await page.evaluate(() => { window.untrusted = 0; document.addEventListener('change', event => { if (!event.isTrusted) window.untrusted++; }); });
    const result = await runWorkflow(page, [
      { action: 'radio', selector: '#r2' },
      { action: 'select', selector: '#single', value: 'b' },
      { action: 'multiple', selector: '#multi', values: ['b', 'd'] },
      { action: 'multiple', selector: '#multi', values: [] }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(await page.locator('#r2').isChecked(), true);
    assert.equal(await page.locator('#r1').isChecked(), false);
    assert.deepEqual(await page.locator('#multi').evaluate(element => Array.from(element.selectedOptions, option => option.value)), []);
    assert.equal(await page.evaluate(() => window.untrusted), 0);
  });
});

test('ARIA toggle and listbox confirm states without assigning ARIA attributes', async () => {
  await withPage('<button id="expand" aria-expanded="false">Expand</button><div id="box" role="checkbox" tabindex="0" aria-checked="false">Agree</div><div id="list" role="listbox" aria-multiselectable="true"><div id="a" role="option" aria-selected="true">A</div><div id="b" role="option" aria-selected="false">B</div></div>', async page => {
    await page.evaluate(() => {
      for (const [selector, attribute] of [['#expand', 'aria-expanded'], ['#box', 'aria-checked'], ['#a', 'aria-selected'], ['#b', 'aria-selected']]) {
        document.querySelector(selector).onclick = event => {
          if (!event.isTrusted) throw new Error('Untrusted click');
          const element = event.currentTarget;
          element.setAttribute(attribute, String(element.getAttribute(attribute) !== 'true'));
        };
      }
    });
    const result = await runWorkflow(page, [
      { action: 'aria', selector: '#expand', state: 'expanded', value: true },
      { action: 'checkbox', selector: '#box', checked: true },
      { action: 'listbox', selector: '#list', options: ['#b'] }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    const failed = await runWorkflow(page, [{ action: 'aria', selector: '#expand', state: 'pressed', value: true }]);
    assert.equal(failed.coverage.status, 'incomplete');
  });
});

test('explicit open shadow and same-origin frame selectors support input and clicks', async () => {
  await withPage('<div id="host"></div><iframe id="frame" src="/child"></iframe>', async page => {
    await page.evaluate(() => {
      document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<input id="field"><button id="button">Run</button><div id="result">Pending</div>';
      const shadow = document.querySelector('#host').shadowRoot;
      shadow.querySelector('#button').onclick = () => shadow.querySelector('#result').textContent = 'Done';
      document.querySelector('#frame').contentDocument.body.innerHTML = '<input id="field"><button id="button">Run</button><div id="result">Pending</div>';
      const child = document.querySelector('#frame').contentDocument;
      child.querySelector('#button').onclick = () => child.querySelector('#result').textContent = 'Done';
    });
    for (const prefix of ['#host >>> ', '#frame >>frame>> ']) {
      const result = await runWorkflow(page, [
        { action: 'fill', selector: prefix + '#field', value: 'test' },
        { action: 'click', selector: prefix + '#button', expect: { selector: prefix + '#result', text: 'Done' } }
      ]);
      assert.equal(result.coverage.status, 'completed', JSON.stringify({ prefix, issues: result.issues }));
    }
    await page.evaluate(() => {
      const shadow = document.querySelector('#host').shadowRoot;
      shadow.innerHTML = '<div role="listbox"><div role="option" aria-selected="false">Choice</div></div>';
      shadow.querySelector('[role="option"]').onclick = event => event.currentTarget.setAttribute('aria-selected', 'true');
    });
    const anonymous = await runWorkflow(page, [{ action: 'listbox', selector: '#host >>> [role="listbox"]', options: ['#host >>> [role="option"]'] }]);
    assert.equal(anonymous.coverage.status, 'completed', JSON.stringify(anonymous.issues));
    await page.evaluate(() => document.querySelector('#frame').setAttribute('sandbox', 'allow-scripts'));
    const blocked = await runWorkflow(page, [{ action: 'fill', selector: '#frame >>frame>> #field', value: 'never' }]);
    assert.equal(blocked.coverage.status, 'incomplete');
    assert.ok(!blocked.commands.some(command => command.method === 'Input.insertText'));
  });
});

test('native drag uses intercepted site data and permits explicitly requested scrolling', async () => {
  await withPage('<div id="source" draggable="true" style="width:100px;height:40px">Source</div><div style="height:1600px"></div><div id="drop" style="height:80px">Pending</div>', async page => {
    await page.evaluate(() => {
      document.querySelector('#source').ondragstart = event => event.dataTransfer.setData('text/plain', 'site-data');
      document.querySelector('#drop').ondragover = event => event.preventDefault();
      document.querySelector('#drop').ondrop = event => {
        event.preventDefault();
        if (event.isTrusted && event.dataTransfer.getData('text/plain') === 'site-data') event.currentTarget.textContent = 'Done';
      };
    });
    const result = await runWorkflow(page, [{ action: 'drag', mode: 'native', scroll: true, selector: '#source', target: '#drop', expect: { selector: '#drop', text: 'Done' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.ok(result.commands.some(command => command.method === 'Input.dispatchDragEvent' && command.params.type === 'drop'));
    assert.ok(result.commands.some(command => command.method === 'Input.setInterceptDrags' && !command.params.enabled));
  });
});

test('late status observation and exact labels without autocomplete produce bounded evidence', async () => {
  await withPage('<label for="first">Электронная почта</label><input id="first"><button id="next">Next</button><section id="step"></section><div id="status" class="status">Pending</div>', async page => {
    await page.evaluate(() => document.querySelector('#next').onclick = () => {
      document.querySelector('#step').innerHTML = '<label for="repeat">Электронная   почта</label><input id="repeat" required>';
      setTimeout(() => document.querySelector('#status').textContent = 'Late update', 650);
    });
    const result = await runWorkflow(page, [
      { action: 'fill', selector: '#first', value: 'private@example.test' },
      { action: 'click', selector: '#next' },
      { action: 'observe', ms: 900 }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.ok(result.issues.some(issue => issue.details.criterion === '4.1.3'));
    assert.ok(result.issues.some(issue => issue.details.criterion === '3.3.7' && /подписью/.test(issue.details['Основание'])), JSON.stringify({ issues: result.issues, snapshot: await page.evaluate(() => A11yInteractionChecks.snapshot()) }));
    assert.ok(!JSON.stringify({ coverage: result.coverage, issues: result.issues }).includes('private@example.test'));
    await page.evaluate(() => document.querySelector('#status').textContent = 'After stop');
    assert.equal((await page.evaluate(() => A11yInteractionChecks.inspectChanges())).changedStatuses, 0);
  });
});

test('timeouts stop subsequent actions and freeze observers after cleanup', async () => {
  await withPage('<div id="status" class="status">Pending</div><audio id="audio"></audio><button id="next">Next</button>', async page => {
    await page.evaluate(() => { window.clicks = 0; document.querySelector('#next').onclick = () => window.clicks++; });
    const result = await runWorkflow(page, [
      { action: 'check', selector: '#status', expectedText: 'Never', timeoutMs: 50 },
      { action: 'click', selector: '#next' }
    ]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.equal(result.coverage.checks.length, 0);
    assert.equal(result.coverage.debugger.detached, true);
    assert.equal(await page.evaluate(() => window.clicks), 0);
    const stopped = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    await page.evaluate(() => { document.querySelector('#status').textContent = 'After timeout'; document.querySelector('#audio').volume = 0.5; });
    assert.equal((await page.evaluate(() => A11yInteractionChecks.inspectChanges())).changedStatuses, 0);
    assert.deepEqual((await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation())).mediaObservation, stopped.mediaObservation);
  });
});

test('blocked frame contexts and closed shadow roots never receive input', async () => {
  await withPage('<div id="closed"></div><div id="wrapper"><iframe id="frame" src="/child"></iframe></div>', async page => {
    await page.evaluate(() => document.querySelector('#closed').attachShadow({ mode: 'closed' }).innerHTML = '<input id="field">');
    let result = await runWorkflow(page, [{ action: 'fill', selector: '#closed >>> #field', value: 'never' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
    await page.evaluate(() => {
      document.querySelector('#frame').contentDocument.body.innerHTML = '<input id="field">';
      document.querySelector('#wrapper').style.transform = 'scale(1.2)';
    });
    result = await runWorkflow(page, [{ action: 'fill', selector: '#frame >>frame>> #field', value: 'never' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
    await page.route('https://foreign.test/**', route => route.fulfill({ body: '<input id="field">', contentType: 'text/html' }));
    await page.locator('#frame').evaluate(frame => frame.src = 'https://foreign.test/');
    await page.waitForFunction(() => document.querySelector('#frame').contentDocument === null);
    result = await runWorkflow(page, [{ action: 'fill', selector: '#frame >>frame>> #field', value: 'never' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
  });
});

test('native drag timeout cancels interception and never completes the step', async () => {
  await withPage('<div id="source" style="width:100px;height:50px">Not draggable</div><div id="drop" style="height:60px">Pending</div>', async page => {
    const result = await runWorkflow(page, [{ action: 'drag', mode: 'native', selector: '#source', target: '#drop', timeoutMs: 50 }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.equal(result.coverage.steps.length, 0);
    assert.ok(result.commands.some(command => command.method === 'Input.cancelDragging'));
    assert.ok(result.commands.some(command => command.method === 'Input.setInterceptDrags' && command.params.enabled === false));
    assert.equal(result.coverage.debugger.detached, true);
  });
});

test('custom shadow player exposes controls and real media events during bounded observation', async () => {
  await withPage('<div id="player"></div>', async page => {
    await page.evaluate(src => {
      const shadow = document.querySelector('#player').attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button id="play">Play</button><audio id="audio"></audio>';
      shadow.querySelector('#audio').src = src;
      shadow.querySelector('#play').onclick = () => shadow.querySelector('#audio').play();
    }, 'data:audio/wav;base64,' + silentWave().toString('base64'));
    const result = await runWorkflow(page, [
      { action: 'media', selector: '#player' },
      { action: 'click', selector: '#player >>> #play' },
      { action: 'observe', ms: 800 }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.deepEqual(result.coverage.playerObservations[0].media, ['#player >>> #audio']);
    assert.ok(result.coverage.playerObservations[0].controls.some(control => control.selector === '#player >>> #play'));
    assert.ok(result.coverage.mediaObservations.some(observation => observation.events.some(event => event.type === 'playing' && event.selector === '#player >>> #audio')));
  });
});

test('label fallback does not merge different forms, frame scopes or explicit autocomplete opt-outs', async () => {
  await withPage('<form id="one"><label for="first">Почта</label><input id="first" value="test"></form><form id="two"><label for="other">Почта</label><input id="other" required></form><label for="off">Почта</label><input id="off" autocomplete="off" required><label for="password">Почта</label><input id="password" type="password">', async page => {
    const fields = (await page.evaluate(() => A11yInteractionChecks.snapshot())).fields;
    assert.notEqual(fields.find(field => field.selector === '#first').purpose, fields.find(field => field.selector === '#other').purpose);
    assert.equal(fields.find(field => field.selector === '#off').purpose, null);
    assert.ok(!fields.some(field => field.selector === '#password'));
  });
});

test('listbox inventory changes and unresponsive ARIA controls cannot complete', async () => {
  await withPage('<button id="toggle" aria-pressed="false">No handler</button><div id="list" role="listbox"><div id="a" role="option" aria-selected="true">A</div><div id="b" role="option" aria-selected="false">B</div></div>', async page => {
    const unchanged = await runWorkflow(page, [{ action: 'aria', selector: '#toggle', state: 'pressed', value: true, timeoutMs: 50 }]);
    assert.equal(unchanged.coverage.status, 'incomplete');
    assert.equal(unchanged.coverage.steps.length, 0);
    await page.evaluate(() => document.querySelector('#b').onclick = () => {
      document.querySelector('#a').setAttribute('aria-selected', 'false');
      document.querySelector('#b').setAttribute('aria-selected', 'true');
      document.querySelector('#list').insertAdjacentHTML('beforeend', '<div role="option" aria-selected="true">New</div>');
    });
    const changed = await runWorkflow(page, [{ action: 'listbox', selector: '#list', options: ['#b'] }]);
    assert.equal(changed.coverage.status, 'incomplete');
    assert.equal(changed.coverage.steps.length, 0);
    assert.ok(changed.issues.some(issue => /listbox/.test(issue.details['Причина'] || '')));
  });
});

test('hidden descendant text cannot pass check or a text postcondition', async () => {
  await withPage('<div id="result" style="min-height:30px"></div>', async page => {
    for (const style of ['display:none', 'visibility:hidden', 'opacity:0', 'content-visibility:hidden']) {
      await page.evaluate(style => document.querySelector('#result').innerHTML = '<span style="' + style + '">Ready</span>', style);
      for (const step of [
        { action: 'check', selector: '#result', expectedText: 'Ready', timeoutMs: 0 },
        { action: 'check', expect: { selector: '#result', text: 'Ready' }, timeoutMs: 0 }
      ]) {
        const result = await runWorkflow(page, [step]);
        assert.equal(result.coverage.status, 'incomplete', style);
        assert.equal(result.coverage.checks.length, 0, style);
      }
    }
    await page.evaluate(() => document.querySelector('#result').innerHTML = '<span>Ready</span><span hidden>secret</span><script type="application/json">data</script><style>.unused { color:red }</style>');
    const result = await runWorkflow(page, [{ action: 'check', expect: { selector: '#result', text: 'Ready' } }]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.checks.length, 1);
    assert.ok(await page.locator('#result').evaluate(element => element.outerHTML.includes('<span hidden="">secret</span>')));
  });
});

test('a document replacement between input commands prevents any subsequent text insertion', async () => {
  for (const destination of ['https://interaction.test/second', 'https://foreign.test/']) {
    await withPage('<input id="field">', async page => {
      await page.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>New document</title><input id="foreign" autofocus>' }));
      const result = await runWorkflow(page, [{ action: 'fill', selector: '#field', value: 'test-only-value' }], async (method, params) => {
        if (method === 'Input.dispatchKeyEvent' && params.type === 'rawKeyDown' && params.code === 'KeyA') {
          await page.goto(destination);
          await page.addScriptTag({ path: path.resolve('accessibility-inspector/utils/interaction-checks.js') });
          await page.locator('#foreign').focus();
        }
      });
      assert.equal(result.coverage.status, 'incomplete');
      assert.equal(result.coverage.steps.length, 0);
      assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
      assert.equal(await page.locator('#foreign').inputValue(), '');
      assert.equal(result.coverage.debugger.detached, true);
    });
  }
});

test('a click cannot dispatch into an embedded document through a container target', async () => {
  await withPage('<div id="container" style="width:300px;height:150px"><iframe id="frame" style="width:100%;height:100%;border:0" srcdoc="<button>Foreign control</button>"></iframe></div>', async page => {
    for (const selector of ['#frame', '#container']) {
      const result = await runWorkflow(page, [{ action: 'click', selector }]);
      assert.equal(result.coverage.status, 'incomplete');
      assert.ok(!result.commands.some(command => command.params?.type === 'mousePressed'));
    }
  });
});

test('click refuses covered, disabled and hover-covered targets before pressing', async () => {
  for (const mode of ['covered', 'hover', 'disabled', 'inert', 'moved', 'pointer-none']) {
    await withPage('<button id="target" style="position:fixed;top:100px;left:100px;width:100px;height:40px">Target</button><div id="cover" style="display:none;position:fixed;inset:0;z-index:10"></div>', async page => {
      await page.evaluate(mode => {
        window.targetClicks = 0;
        window.coverClicks = 0;
        const target = document.querySelector('#target'), cover = document.querySelector('#cover');
        target.onclick = () => window.targetClicks++;
        cover.onclick = () => window.coverClicks++;
        if (mode === 'covered') cover.style.display = 'block';
        if (mode === 'hover') target.onmouseenter = () => cover.style.display = 'block';
        if (mode === 'disabled') target.disabled = true;
        if (mode === 'inert') target.inert = true;
        if (mode === 'moved') target.onmouseenter = () => target.style.left = '400px';
        if (mode === 'pointer-none') target.style.pointerEvents = 'none';
      }, mode);
      const result = await runWorkflow(page, [{ action: 'click', selector: '#target' }]);
      assert.equal(result.coverage.status, 'incomplete', mode);
      assert.equal(result.coverage.steps.length, 0, mode);
      assert.ok(!result.commands.some(command => command.params?.type === 'mousePressed'), mode);
      assert.deepEqual(await page.evaluate(() => [window.targetClicks, window.coverClicks]), [0, 0]);
      assert.equal(result.coverage.debugger.detached, true);
    });
  }
});

test('click accepts a descendant at the hit point and confirms the explicit result', async () => {
  await withPage('<button id="target"><span>Target</span></button><div id="result">Pending</div>', async page => {
    await page.evaluate(() => document.querySelector('#target').onclick = () => document.querySelector('#result').textContent = 'Done');
    const result = await runWorkflow(page, [
      { action: 'click', selector: '#target' },
      { action: 'check', selector: '#result', expectedText: 'Done' }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.checks[0].outcome, 'passed');
  });
});

test('check rejects zero opacity on the target and ancestors but waits for appearance', async () => {
  await withPage('<div id="own" style="opacity:0">Ready</div><section id="parent" style="opacity:0"><div id="child">Ready</div></section><div id="partial" style="opacity:0.5">Ready</div>', async page => {
    for (const selector of ['#own', '#child']) {
      const result = await runWorkflow(page, [{ action: 'check', selector, expectedText: 'Ready', timeoutMs: 100 }]);
      assert.equal(result.coverage.status, 'incomplete');
      assert.equal(result.coverage.checks.length, 0);
    }
    assert.equal((await page.evaluate(() => A11yInteractionChecks.checkState('#partial', 'Ready'))).matched, true);
    await page.evaluate(() => setTimeout(() => document.querySelector('#parent').style.opacity = '1', 400));
    const result = await runWorkflow(page, [{ action: 'check', selector: '#child', expectedText: 'Ready' }]);
    assert.equal(result.coverage.status, 'completed');
    assert.equal(result.coverage.checks[0].outcome, 'passed');
  });
});

test('status observation ignores decoration but detects text, appearance and inserted messages', async () => {
  await withPage('<div class="status" id="status">Saved</div><section id="parent" style="opacity:0"><div class="status" id="hidden">Pending</div></section>', async page => {
    const change = async callback => {
      await page.evaluate(callback);
      return page.evaluate(() => A11yInteractionChecks.inspectChanges());
    };
    await page.evaluate(() => A11yInteractionChecks.startObservation());
    const decoration = await change(() => {
      document.querySelector('#status').style.color = 'red';
      document.querySelector('#status').classList.add('highlight');
    });
    assert.equal(decoration.changedStatuses, 0);
    assert.equal(decoration.issues.length, 0);
    assert.equal((await change(() => document.querySelector('#status').textContent = 'Updated')).changedStatuses, 1);
    assert.equal((await change(() => document.querySelector('#hidden').textContent = 'Ready')).changedStatuses, 0);
    const appeared = await change(() => document.querySelector('#parent').style.opacity = '1');
    assert.equal(appeared.changedStatuses, 1);
    assert.equal(appeared.issues[0].selector, '#hidden');
    const inserted = await change(() => {
      const wrapper = document.createElement('section');
      wrapper.innerHTML = '<div role="status">New message</div>';
      document.body.append(wrapper);
    });
    assert.equal(inserted.changedStatuses, 1);
    assert.equal(inserted.issues.length, 0);
    assert.equal((await page.evaluate(() => A11yInteractionChecks.inspectChanges())).changedStatuses, 0);
  });
});

test('status snapshots share check visibility for hidden descendants and detect their appearance', async () => {
  for (const attributes of ['hidden', 'style="display:none"', 'style="visibility:hidden"', 'style="opacity:0"', 'style="content-visibility:hidden"']) {
    await withPage('<div class="status" id="status" style="min-height:30px"><span id="child" ' + attributes + '>Saved</span></div>', async page => {
      await page.evaluate(() => {
        A11yInteractionChecks.startObservation();
        document.querySelector('#child').textContent = 'Updated';
      });
      const hidden = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
      assert.equal(hidden.changedStatuses, 0, attributes);
      assert.equal(hidden.issues.length, 0, attributes);
      assert.equal((await page.evaluate(() => A11yInteractionChecks.checkState('#status', 'Updated'))).matched, false);
      await page.evaluate(() => {
        document.querySelector('#child').hidden = false;
        document.querySelector('#child').removeAttribute('style');
      });
      const appeared = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
      assert.equal(appeared.changedStatuses, 1, attributes);
      assert.equal(appeared.issues.length, 1, attributes);
      assert.equal(appeared.issues[0].element, await page.locator('#status').evaluate(element => element.outerHTML));
      assert.equal((await page.evaluate(() => A11yInteractionChecks.conditionState({ selector: '#status', text: 'Updated' }))).matched, true);
    });
  }
});

test('hidden and service text changes do not alter the visible status message', async () => {
  await withPage('<div class="status" id="status">Ready<span hidden id="hidden">Private</span><script id="data" type="application/json">{"state":1}</script><style id="style">.unused { color:red }</style></div>', async page => {
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      document.querySelector('#hidden').textContent = 'Changed';
      document.querySelector('#data').textContent = '{"state":2}';
      document.querySelector('#style').textContent = '.unused { color:green }';
    });
    const result = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
    assert.equal(result.changedStatuses, 0);
    assert.equal(result.issues.length, 0);
    assert.equal((await page.evaluate(() => A11yInteractionChecks.checkState('#status', 'Ready'))).matched, true);
    await page.evaluate(() => document.querySelector('#status').firstChild.nodeValue = 'Updated');
    const changed = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
    assert.equal(changed.changedStatuses, 1);
    assert.equal(changed.issues[0].element, await page.locator('#status').evaluate(element => element.outerHTML));
    assert.ok(changed.issues[0].element.includes('Changed'));
    assert.ok(changed.issues[0].element.includes('application/json'));
  });
});

test('fill rejects checkbox and other non-text inputs before sending text', async () => {
  await withPage(['checkbox', 'radio', 'button', 'number', 'range', 'date', 'file', 'color'].map(type => `<input id="${type}" type="${type}">`).join(''), async page => {
    for (const type of ['checkbox', 'radio', 'button', 'number', 'range', 'date', 'file', 'color']) {
      await assert.rejects(page.evaluate(type => A11yInteractionChecks.prepareInput('#' + type), type), /текстовые поля/);
    }
    const result = await runWorkflow(page, [{ action: 'fill', selector: '#checkbox', value: 'changed' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(!result.commands.some(command => command.method === 'Input.insertText'));
  });
});

test('action postconditions wait for all requested states and failed conditions stop the step', async () => {
  await withPage('<button id="change">Change</button><input id="field" disabled><div id="result" hidden>Pending</div>', async page => {
    await page.evaluate(() => document.querySelector('#change').onclick = () => setTimeout(() => {
      const field = document.querySelector('#field');
      field.disabled = false;
      field.value = 'private-value';
      field.focus();
      document.querySelector('#result').hidden = false;
      document.querySelector('#result').textContent = 'Ready';
    }, 300));
    const result = await runWorkflow(page, [
      { action: 'click', selector: '#change', expect: { selector: '#field', value: 'private-value', enabled: true, focused: true } },
      { action: 'check', expect: { selector: '#result', text: 'Ready', visible: true } }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.checks.length, 2);
    assert.ok(result.coverage.steps.every(step => step.confirmation === 'postcondition'));
    assert.ok(!JSON.stringify(result.coverage).includes('private-value'));
    const failed = await runWorkflow(page, [{ action: 'key', key: 'Tab', expect: { selector: '#result', text: 'Never' }, timeoutMs: 100 }]);
    assert.equal(failed.coverage.status, 'incomplete');
    assert.equal(failed.coverage.steps.length, 0);
    assert.equal(failed.coverage.checks.length, 0);
    assert.equal(failed.coverage.debugger.detached, true);
    const ambiguous = await runWorkflow(page, [{ action: 'check', expect: { selector: 'button, input', visible: true } }]);
    assert.equal(ambiguous.coverage.checks.length, 0);
    assert.equal(ambiguous.coverage.status, 'incomplete');
  });
});

test('checkbox uses trusted input, is idempotent and verifies cancelled changes', async () => {
  await withPage('<input type="checkbox" id="box"><input type="checkbox" id="blocked"><input type="checkbox" id="mixed"><input type="radio" id="radio">', async page => {
    await page.evaluate(() => {
      window.changes = [];
      document.querySelector('#box').onchange = event => window.changes.push(event.isTrusted);
      document.querySelector('#blocked').onclick = event => event.preventDefault();
      document.querySelector('#mixed').indeterminate = true;
    });
    const result = await runWorkflow(page, [
      { action: 'checkbox', selector: '#box', checked: true },
      { action: 'checkbox', selector: '#box', checked: true },
      { action: 'checkbox', selector: '#box', checked: false }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.deepEqual(await page.evaluate(() => window.changes), [true, true]);
    assert.ok(result.coverage.steps.every(step => step.confirmation === 'control-state'));
    for (const selector of ['#blocked', '#mixed', '#radio']) {
      const failed = await runWorkflow(page, [{ action: 'checkbox', selector, checked: true, timeoutMs: 100 }]);
      assert.equal(failed.coverage.status, 'incomplete', selector);
      assert.equal(failed.coverage.steps.length, 0);
    }
  });
});

test('select commits a single trusted change and rejects unavailable or ambiguous options', async () => {
  await withPage('<select id="list"><option value="a">A</option><option disabled value="b">B</option><optgroup disabled label="Disabled"><option value="c">C</option></optgroup><option hidden value="hidden">Hidden</option><option value="d">D</option><option value="e">E</option></select><select id="duplicate"><option value="x">One</option><option value="x">Two</option></select><select multiple id="multiple"><option value="a">A</option></select>', async page => {
    await page.evaluate(() => {
      window.changes = [];
      document.querySelector('#list').onchange = event => window.changes.push({ trusted: event.isTrusted, value: event.target.value });
    });
    const result = await runWorkflow(page, [
      { action: 'select', selector: '#list', value: 'e' },
      { action: 'select', selector: '#list', value: 'e' },
      { action: 'select', selector: '#list', value: 'a' }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.deepEqual(await page.evaluate(() => window.changes), [{ trusted: true, value: 'e' }, { trusted: true, value: 'a' }]);
    for (const [selector, value] of [['#list', 'b'], ['#list', 'c'], ['#list', 'hidden'], ['#list', 'missing'], ['#duplicate', 'x'], ['#multiple', 'a']]) {
      const failed = await runWorkflow(page, [{ action: 'select', selector, value }]);
      assert.equal(failed.coverage.status, 'incomplete', selector + ':' + value);
      assert.equal(failed.coverage.steps.length, 0);
      assert.ok(!failed.commands.some(command => command.method === 'Input.dispatchKeyEvent'));
    }
  });
});

test('cancelled select never completes the step or runs subsequent actions', async () => {
  for (const mode of ['keyboard-cancelled', 'value-restored']) {
    await withPage('<select id="list"><option value="a">A</option><option value="b">B</option></select><button id="next">Next</button>', async page => {
      await page.evaluate(mode => {
        window.changes = 0;
        window.escapes = 0;
        window.nextClicks = 0;
        const select = document.querySelector('#list');
        select.onkeydown = event => {
          if (mode === 'keyboard-cancelled') event.preventDefault();
          if (event.key === 'Escape') window.escapes++;
        };
        select.onchange = () => { window.changes++; if (mode === 'value-restored') select.value = 'a'; };
        document.querySelector('#next').onclick = () => window.nextClicks++;
      }, mode);
      const result = await runWorkflow(page, [
        { action: 'select', selector: '#list', value: 'b', timeoutMs: 100, expect: { selector: '#list', value: 'b' } },
        { action: 'click', selector: '#next' }
      ]);
      assert.equal(result.coverage.status, 'incomplete', mode);
      assert.equal(result.coverage.steps.length, 0, mode);
      assert.equal(result.coverage.checks.length, 0, mode);
      assert.equal(await page.locator('#list').inputValue(), 'a', mode);
      assert.equal(await page.evaluate(() => window.nextClicks), 0, mode);
      assert.equal(await page.evaluate(() => window.changes > 0), mode === 'value-restored');
      assert.equal(await page.evaluate(() => window.escapes), 0);
      assert.equal(result.coverage.debugger.detached, true);
    });
  }
});

test('select cap and dynamically added media cap make workflow coverage incomplete', async () => {
  await withPage('<select id="list">' + Array.from({ length: 101 }, (_, index) => `<option value="${index}">${index}</option>`).join('') + '</select>', async page => {
    const result = await runWorkflow(page, [{ action: 'select', selector: '#list', value: '100' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(result.coverage.limits.some(record => record.id === 'select-options' && record.total === 101 && record.truncated));
    assert.ok(!result.commands.some(command => command.method === 'Input.dispatchKeyEvent'));
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      const wrapper = document.createElement('section');
      wrapper.innerHTML = '<audio></audio>'.repeat(101);
      document.body.append(wrapper);
    });
    const media = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(media.mediaObservation.elements.length, 100);
    assert.ok(media.limits.some(record => record.id === 'observed-media' && record.total === 101 && record.truncated));
  });
});

test('autocomplete normalization distinguishes scopes and ignores invalid or sensitive purposes', async () => {
  await withPage([' SECTION-Blue   SHIPPING EMAIL ', 'section-blue shipping email', 'section-blue billing email', 'section-red shipping email', 'home email', 'work email', 'email home', 'off', 'one-time-code', 'current-password', 'new-password', 'cc-csc', 'made-up', 'section- email'].map((value, index) => `<input id="f${index}" autocomplete="${value}">`).join(''), async page => {
    const fields = (await page.evaluate(() => A11yInteractionChecks.snapshot())).fields;
    assert.equal(fields[0].purpose, fields[1].purpose);
    for (const index of [2, 3, 4, 5]) assert.notEqual(fields[0].purpose, fields[index].purpose);
    for (const field of fields.slice(6)) assert.equal(field.purpose, null);
  });
});

test('repeated entry requires a matching normalized scope and a newly requested required field', async () => {
  await withPage('<input id="first" autocomplete="section-blue shipping email"><button id="next">Next</button><section id="step"></section>', async page => {
    await page.evaluate(() => document.querySelector('#next').onclick = () => document.querySelector('#step').innerHTML =
      '<input id="repeat" required autocomplete="SECTION-BLUE shipping EMAIL"><input id="optional" autocomplete="section-blue shipping email"><input id="billing" required autocomplete="section-blue billing email"><input id="other" required autocomplete="section-red shipping email"><input id="invalid" required autocomplete="email shipping">');
    const result = await runWorkflow(page, [{ action: 'fill', selector: '#first', value: 'private@example.test' }, { action: 'click', selector: '#next' }]);
    const repeats = result.issues.filter(issue => issue.details.criterion === '3.3.7');
    assert.equal(repeats.length, 1);
    assert.equal(repeats[0].selector, '#repeat');
    assert.equal(repeats[0].details['Ранее заполненное поле'], '#first');
    assert.equal(repeats[0].details['Шаг наблюдения'], 1);
    assert.ok(!JSON.stringify(repeats).includes('private@example.test'));
  });
});

test('clearing an already completed required field records repeated-entry evidence', async () => {
  await withPage('<input id="field" required autocomplete="email"><button id="clear">Clear</button>', async page => {
    await page.evaluate(() => document.querySelector('#clear').onclick = () => document.querySelector('#field').value = '');
    const result = await runWorkflow(page, [{ action: 'fill', selector: '#field', value: 'private@example.test' }, { action: 'click', selector: '#clear' }]);
    const repeats = result.issues.filter(issue => issue.details.criterion === '3.3.7');
    assert.equal(repeats.length, 1);
    assert.equal(repeats[0].selector, '#field');
  });
});

test('an existing confirmation field is compared when its purpose first becomes known', async () => {
  await withPage('<input id="repeat" required autocomplete="email"><input id="first" autocomplete="EMAIL">', async page => {
    const result = await runWorkflow(page, [{ action: 'fill', selector: '#first', value: 'private@example.test' }]);
    assert.equal(result.issues.filter(issue => issue.details.criterion === '3.3.7').length, 1);
    assert.equal(result.issues.find(issue => issue.details.criterion === '3.3.7').selector, '#repeat');
  });
});

test('media observation ignores synthetic events, reports event overflow and removes listeners', async () => {
  await withPage('<audio id="audio"></audio>', async page => {
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      document.querySelector('#audio').dispatchEvent(new Event('playing'));
    });
    assert.equal((await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation())).mediaObservation.events.length, 0);
    await page.evaluate(() => {
      const audio = document.querySelector('#audio');
      for (let index = 0; index < 205; index++) audio.volume = index % 2 ? 0.5 : 1;
    });
    const result = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(result.mediaObservation.events.length, 200);
    assert.ok(result.limits.some(record => record.id === 'media-events' && record.truncated));
    assert.equal(result.issues.length, 0);
    await page.evaluate(() => A11yInteractionChecks.stopObservation());
    const stopped = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    await page.evaluate(() => document.querySelector('#audio').volume = 0.25);
    const after = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(after.mediaObservation.durationMs, stopped.mediaObservation.durationMs);
    assert.deepEqual(after.mediaObservation.events, stopped.mediaObservation.events);
  });
});

test('media observation measures real playback intervals and does not infer autoplay', async () => {
  await withPage('<button id="play">Play</button><section id="container"></section>', async page => {
    await page.route('https://interaction.test/sample.wav', route => route.fulfill({ contentType: 'audio/wav', body: silentWave() }));
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      document.querySelector('#play').onclick = () => {
        const audio = document.createElement('audio');
        audio.id = 'audio';
        audio.src = '/sample.wav';
        document.querySelector('#container').append(audio);
        audio.play();
      };
    });
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#audio').currentTime > 3.6);
    const playing = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.ok(playing.mediaObservation.events.some(event => event.type === 'playing'));
    assert.equal(playing.mediaObservation.elements[0].playObserved, true);
    assert.equal(playing.mediaObservation.elements[0].autoplayAttribute, false);
    assert.ok(playing.mediaObservation.elements[0].longestPotentialAudioMs > 3000);
    assert.equal(playing.issues[0].details.criterion, '1.4.2');
    assert.ok(!playing.issues[0].message.includes('автоматический'));
    await page.evaluate(() => { document.querySelector('#audio').pause(); document.querySelector('#audio').muted = true; });
    const paused = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.ok(paused.mediaObservation.events.some(event => event.type === 'pause'));
    assert.ok(paused.mediaObservation.events.some(event => event.type === 'volumechange'));
    assert.equal(paused.mediaObservation.elements[0].longestPotentialAudioMs, (await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation())).mediaObservation.elements[0].longestPotentialAudioMs);
  });
});

test('muted playback and separated short intervals do not become a three-second sound finding', async () => {
  await withPage('<button id="play">Play</button><audio id="audio" src="/sample.wav"></audio>', async page => {
    await page.route('https://interaction.test/sample.wav', route => route.fulfill({ contentType: 'audio/wav', body: silentWave() }));
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      document.querySelector('#play').onclick = () => document.querySelector('#audio').play();
      document.querySelector('#audio').load();
    });
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#audio').currentTime > 1.1);
    await page.evaluate(() => document.querySelector('#audio').pause());
    await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    await page.evaluate(() => document.querySelector('#audio').muted = true);
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#audio').currentTime > 4);
    const muted = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(muted.issues.length, 0);
    await page.evaluate(() => document.querySelector('#audio').muted = false);
    await page.waitForFunction(() => document.querySelector('#audio').ended);
    const ended = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(ended.issues.length, 0);
    assert.ok(ended.mediaObservation.elements[0].longestPotentialAudioMs < 3000);
    assert.ok(ended.mediaObservation.events.some(event => event.type === 'ended'));
  });
});

test('short loop preserves playback evidence across its observed boundaries', async () => {
  await withPage('<button id="play">Play</button><audio id="audio" loop></audio>', async page => {
    await page.evaluate(src => {
      const audio = document.querySelector('#audio');
      A11yInteractionChecks.startObservation();
      audio.src = src;
      document.querySelector('#play').onclick = () => audio.play();
    }, 'data:audio/wav;base64,' + silentWave(2).toString('base64'));
    await page.click('#play');
    await page.waitForFunction(() => A11yInteractionChecks.inspectMediaObservation().mediaObservation.elements[0].loops >= 2);
    const result = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.ok(result.mediaObservation.elements[0].longestPotentialAudioMs > 3000);
    assert.ok(result.issues.some(issue => issue.details.criterion === '1.4.2'));
    assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), false);
  });
});

test('manual seeking does not add separated playback intervals even when loop is enabled', async () => {
  await withPage('<button id="play">Play</button><audio id="audio" loop></audio>', async page => {
    await page.evaluate(src => {
      const audio = document.querySelector('#audio');
      A11yInteractionChecks.startObservation();
      audio.src = src;
      document.querySelector('#play').onclick = () => audio.play();
    }, 'data:audio/wav;base64,' + silentWave().toString('base64'));
    await page.click('#play');
    await page.waitForFunction(() => document.querySelector('#audio').currentTime > 1.7);
    await page.evaluate(() => document.querySelector('#audio').currentTime = 3);
    await page.waitForFunction(() => !document.querySelector('#audio').seeking && document.querySelector('#audio').currentTime > 4.7);
    await page.evaluate(() => document.querySelector('#audio').pause());
    const result = await page.evaluate(() => A11yInteractionChecks.inspectMediaObservation());
    assert.equal(result.mediaObservation.elements[0].loops, 0);
    assert.ok(result.mediaObservation.elements[0].longestPotentialAudioMs < 3000);
    assert.equal(result.issues.length, 0);
  });
});

test('fill replaces email and text values, clears text and verifies accepted input', async () => {
  await withPage('<input id="email" type="email" value="old@example.test"><textarea id="text">old</textarea><input id="limited" maxlength="2">', async page => {
    const result = await runWorkflow(page, [
      { action: 'fill', selector: '#email', value: 'new@example.test' },
      { action: 'fill', selector: '#text', value: '' }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(await page.locator('#email').inputValue(), 'new@example.test');
    assert.equal(await page.locator('#text').inputValue(), '');
    const rejected = await runWorkflow(page, [{ action: 'fill', selector: '#limited', value: 'long', timeoutMs: 100 }]);
    assert.equal(rejected.coverage.status, 'incomplete');
    assert.equal(rejected.coverage.steps.length, 0);
    assert.ok(rejected.issues.some(issue => /ввод не подтверждён/.test(issue.details['Причина'])));
  });
});

test('drag requiring auto-scroll is refused before mouse press', async () => {
  await withPage('<div id="source" style="position:absolute;top:50px;width:100px;height:50px">Source</div><div id="drop" style="position:absolute;top:2500px;width:100px;height:50px">Drop</div>', async page => {
    const result = await runWorkflow(page, [{ action: 'drag', selector: '#source', target: '#drop' }]);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(result.issues.some(issue => /автопрокруткой/.test(issue.details['Причина'])));
    assert.ok(!result.commands.some(command => command.params?.type === 'mousePressed'));
  });
});

test('drag measures endpoints together after scrolling and hits the intended source', async () => {
  await withPage('<div id="source" style="position:absolute;top:1100px;width:100px;height:50px;touch-action:none">Source</div><div id="drop" style="position:absolute;top:1300px;width:100px;height:50px">Drop</div>', async page => {
    await page.evaluate(() => {
      let pressed = false;
      document.querySelector('#source').addEventListener('pointerdown', () => { pressed = true; });
      document.querySelector('#drop').addEventListener('pointerup', event => { if (pressed && event.isTrusted) event.target.textContent = 'Done'; });
    });
    const result = await runWorkflow(page, [
      { action: 'drag', selector: '#source', target: '#drop' },
      { action: 'check', selector: '#drop', expectedText: 'Done' }
    ]);
    assert.equal(result.coverage.status, 'completed', JSON.stringify(result.issues));
    assert.equal(result.coverage.checks[0].outcome, 'passed');
  });
});

test('200 observed nodes are complete, overflow is reported and preserved across batches', async () => {
  await withPage(Array.from({ length: 205 }, (_, index) => `<div class="status" id="s${index}"></div>`).join(''), async page => {
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      Array.from(document.querySelectorAll('.status')).slice(0, 200).forEach(element => element.textContent = 'First');
    });
    const exact = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
    assert.equal(exact.changedStatuses, 200);
    assert.equal(exact.limitReached, false);
    await page.evaluate(() => {
      document.querySelectorAll('.status').forEach(element => element.textContent = 'Second');
    });
    const overflow = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
    assert.equal(overflow.changedStatuses, 200);
    assert.equal(overflow.limitReached, true);
    assert.ok(overflow.skippedRecords >= 5);
    assert.ok(overflow.limits.find(record => record.id === 'status-nodes').totalIsLowerBound);
    assert.equal((await page.evaluate(() => A11yInteractionChecks.inspectChanges())).limitReached, true);
  });
});

test('status descendants have an explicit coverage cap when one ancestor becomes visible', async () => {
  await withPage('<section id="parent" style="opacity:0">' + '<div class="status">Ready</div>'.repeat(205) + '</section>', async page => {
    await page.evaluate(() => {
      A11yInteractionChecks.startObservation();
      document.querySelector('#parent').style.opacity = '1';
    });
    const result = await page.evaluate(() => A11yInteractionChecks.inspectChanges());
    assert.equal(result.changedStatuses, 200);
    assert.equal(result.limitReached, true);
    const limit = result.limits.find(record => record.id === 'status-regions');
    assert.equal(limit.total, 205);
    assert.equal(limit.processed, 200);
    assert.equal(limit.truncated, true);
    assert.equal(result.limits.find(record => record.id === 'status-nodes').truncated, false);
  });
});

test('workflow is incomplete when status observations overflow despite completed steps', async () => {
  await withPage('<button id="change">Change</button>' + Array.from({ length: 205 }, () => '<div class="status"></div>').join(''), async page => {
    await page.evaluate(() => document.querySelector('#change').onclick = () => document.querySelectorAll('.status').forEach(element => element.textContent = 'Changed'));
    const result = await runWorkflow(page, [{ action: 'click', selector: '#change' }]);
    assert.equal(result.coverage.steps.length, 1);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(result.coverage.limits.some(record => record.id === 'status-nodes' && record.truncated));
  });
});

test('check waits for delayed state and records no pass when the timeout expires', async () => {
  await withPage('<div id="result">Pending</div>', async page => {
    await page.evaluate(() => setTimeout(() => document.querySelector('#result').textContent = 'Ready', 450));
    const result = await runWorkflow(page, [{ action: 'check', selector: '#result', expectedText: 'Ready' }]);
    assert.equal(result.coverage.status, 'completed');
    assert.equal(result.coverage.checks.length, 1);
    const timeout = await runWorkflow(page, [{ action: 'check', selector: '#result', expectedText: 'Never', timeoutMs: 100 }]);
    assert.equal(timeout.coverage.status, 'incomplete');
    assert.equal(timeout.coverage.checks.length, 0);
  });
});

test('media, snapshot, forms and tooltip caps expose their totals', async () => {
  await withPage(Array.from({ length: 1001 }, (_, index) => `<input id="field${index}" autocomplete="email">`).join('') +
    '<video></video>'.repeat(101) + Array.from({ length: 11 }, (_, index) => `<button aria-describedby="tip${index}">Tip</button><div id="tip${index}" role="tooltip" hidden>Content</div>`).join(''), async page => {
    const limits = await page.evaluate(() => {
      A11yInteractionChecks.inspectMedia();
      A11yInteractionChecks.inspectForms();
      A11yInteractionChecks.snapshot();
      A11yInteractionChecks.tooltipCandidates();
      return A11yInteractionChecks.getCoverage().limits;
    });
    for (const [id, total] of [['media', 101], ['form-fields', 1001], ['workflow-fields', 1001], ['tooltips', 11]]) {
      const record = limits.find(record => record.id === id);
      assert.equal(record.total, total);
      assert.equal(record.truncated, true);
    }
  });
});

test('automatic scenarios propagate observation limits and delayed tooltip states', async () => {
  await withPage('<button id="change" aria-describedby="tip">Change</button><div role="tooltip" id="tip" style="display:none;position:fixed;top:40px;left:100px">Content</div>' +
    Array.from({ length: 205 }, () => '<div class="status"></div>').join(''), async page => {
    await page.evaluate(() => {
      const button = document.querySelector('#change'), tip = document.querySelector('#tip');
      button.addEventListener('mouseenter', () => setTimeout(() => tip.style.display = 'block', 300));
      button.addEventListener('focus', () => {
        tip.style.display = 'block';
        document.querySelectorAll('.status').forEach(element => element.textContent = 'Changed');
      });
      document.addEventListener('keydown', event => { if (event.key === 'Escape') setTimeout(() => tip.style.display = 'none', 200); });
    });
    const client = await page.context().newCDPSession(page);
    const result = await scenario.run(1, {
      attach: async () => {}, detach: () => client.detach(), send: (method, params) => client.send(method, params),
      inspect: (method, args = []) => page.evaluate(([name, values]) => A11yScenarioChecks[name](...values), [method, args]),
      interaction: (method, args = []) => page.evaluate(([name, values]) => A11yInteractionChecks[name](...values), [method, args])
    });
    assert.ok(result.coverage.completedPhases.includes('keyboard'));
    assert.equal(result.coverage.tooltips.observed, 1);
    assert.equal(result.coverage.status, 'incomplete');
    assert.ok(result.coverage.limits.some(record => record.id === 'status-nodes' && record.truncated));
    assert.equal(result.coverage.debugger.detached, true);
  });
});
