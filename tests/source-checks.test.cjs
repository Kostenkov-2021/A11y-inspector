const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { validateManifest } = require('../scripts/check.cjs');

const root = path.resolve('accessibility-inspector');

test('manifest resources accept popup, scripts, styles and both icon formats', () => {
  assert.deepEqual(validateManifest({ manifest_version: 3, background: { service_worker: 'background.js' },
    action: { default_popup: 'popup/popup.html', default_icon: 'icons/icon16.png' },
    icons: { 16: 'icons/icon16.png' }, content_scripts: [{ js: ['content-script.js'], css: ['popup/popup.css'] }]
  }, root), []);
});

test('manifest resources reject missing files, directories and paths outside the extension', () => {
  for (const resource of ['missing.js', 'popup', '../package.json', root]) {
    assert.equal(validateManifest({ manifest_version: 3, background: { service_worker: resource } }, root).length, 1);
  }
  assert.ok(validateManifest({ manifest_version: 2 }, root).length);
});
