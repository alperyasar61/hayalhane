'use strict';

// Ortam ve bağımlılık sürümlerini denetler: `npm run check`
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIN_NODE = [20, 16, 0];
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

function cmp(a, b) {
  for (let i = 0; i < 3; i += 1) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function parse(v) {
  return String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

const problems = [];
const nodeVer = process.versions.node;
if (cmp(parse(nodeVer), MIN_NODE) < 0) {
  problems.push(`Node.js ${nodeVer} çok eski. En az ${MIN_NODE.join('.')} gerekli.`);
}

let npmVer = '';
try {
  npmVer = execSync('npm -v', { encoding: 'utf8' }).trim();
} catch {
  problems.push('npm bulunamadı.');
}

console.log(`Node.js : ${nodeVer}`);
console.log(`npm     : ${npmVer || '?'}`);
console.log(`Platform: ${process.platform} ${process.arch}`);
console.log('');

const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const rows = [];
for (const [name, range] of Object.entries(deps)) {
  let installed = '';
  let latest = '';
  try {
    installed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', name, 'package.json'), 'utf8')).version;
  } catch {
    problems.push(`${name} kurulu değil. "npm install" çalıştır.`);
  }
  try {
    latest = execSync(`npm view ${name} version`, { encoding: 'utf8' }).trim();
  } catch {
    latest = '?';
  }
  const stale = installed && latest !== '?' && cmp(parse(installed), parse(latest)) < 0;
  rows.push({ paket: name, tanim: range, kurulu: installed || '-', son: latest, durum: stale ? 'güncel değil' : 'güncel' });
}

console.table(rows);

if (problems.length) {
  console.log('\nSorunlar:');
  for (const p of problems) console.log(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nOrtam ve bağımlılıklar sorunsuz.');
}
