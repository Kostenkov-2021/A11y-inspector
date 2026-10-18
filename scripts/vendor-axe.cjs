const fs = require('node:fs');
const path = require('node:path');

const source = path.dirname(require.resolve('axe-core/package.json'));
const destination = path.resolve(__dirname, '../accessibility-inspector/vendor');
const locale = JSON.parse(fs.readFileSync(path.join(source, 'locales/ru.json'), 'utf8'));
const axe = require('axe-core');
axe.configure({ locale });
// Compile trusted locale templates during the build, not under the extension's CSP.
for (const [key, summary] of Object.entries(locale.failureSummaries || {})) {
  summary.failureMessage = axe._audit.data.failureSummaries[key].failureMessage;
}
function serialize(value) {
  if (typeof value === 'function') return value.toString();
  if (Array.isArray(value)) return '[' + value.map(serialize).join(',\n') + ']';
  if (value && typeof value === 'object') return '{\n' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ': ' + serialize(item)).join(',\n') + '\n}';
  return JSON.stringify(value);
}
const files = new Map([
  ['axe.min.js', fs.readFileSync(path.join(source, 'axe.min.js'))],
  ['axe-LICENSE', fs.readFileSync(path.join(source, 'LICENSE'))],
  ['axe-locale-ru.js', Buffer.from(`globalThis.A11yAxeLocale = ${serialize(locale)};\n`, 'utf8')]
]);
if (process.argv.includes('--check')) {
  for (const [name, expected] of files) {
    const file = path.join(destination, name);
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(expected)) {
      console.error('Vendor file differs from the locked dependency: ' + name);
      process.exitCode = 1;
    }
  }
} else {
  fs.mkdirSync(destination, { recursive: true });
  for (const [name, content] of files) fs.writeFileSync(path.join(destination, name), content);
  console.log('axe-core browser files and Russian locale copied to accessibility-inspector/vendor');
}
