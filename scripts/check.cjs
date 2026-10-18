const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function manifestResources(manifest) {
  const icons = value => typeof value === 'string' ? [value] : Object.values(value || {});
  return [manifest.background?.service_worker, manifest.action?.default_popup,
    ...icons(manifest.icons), ...icons(manifest.action?.default_icon),
    ...(manifest.content_scripts || []).flatMap(script => [...(script.js || []), ...(script.css || [])])].filter(Boolean);
}

function validateManifest(manifest, root) {
  const errors = [];
  if (manifest.manifest_version !== 3) errors.push('Expected Manifest V3');
  for (const resource of manifestResources(manifest)) {
    const file = path.resolve(root, resource);
    const relative = path.relative(root, file);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile()) errors.push('Missing or unsafe manifest resource: ' + resource);
  }
  return errors;
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(?:js|cjs|json|md|html|css|ya?ml)$/.test(entry.name) ? [file] : [];
  });
}

function check(root) {
  const errors = [];
  const files = ['accessibility-inspector', 'scripts', 'tests', 'docs', '.github'].flatMap(directory => sourceFiles(path.join(root, directory)));
  files.push(path.join(root, 'package.json'), path.join(root, 'README.md'), path.join(root, 'CHANGELOG.md'));
  for (const file of files) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)); }
    catch { errors.push('Invalid UTF-8: ' + path.relative(root, file)); continue; }
    if (/\.(?:js|cjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) errors.push(result.stderr || result.error?.message || 'Syntax check failed: ' + file);
    }
    if (file.endsWith('.json')) {
      try { JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (error) { errors.push(path.relative(root, file) + ': ' + error.message); }
    }
  }
  try { errors.push(...validateManifest(JSON.parse(fs.readFileSync(path.join(root, 'accessibility-inspector/manifest.json'), 'utf8')), path.join(root, 'accessibility-inspector'))); }
  catch (error) { errors.push(error.message); }
  const tracked = spawnSync('git', ['ls-files', '-z', '--', '*.pem'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (tracked.status === 0 && tracked.stdout) errors.push('Signing keys must not be tracked: ' + tracked.stdout.split('\0').filter(Boolean).join(', '));
  else if (tracked.status !== 0 && fs.existsSync(path.join(root, '.git'))) errors.push(tracked.stderr || 'Cannot check tracked signing keys');
  return errors;
}

if (require.main === module) {
  const errors = check(path.resolve(__dirname, '..'));
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Syntax, JSON, UTF-8 and manifest resources checked');
}

module.exports = { check, validateManifest };
