#!/usr/bin/env node
// Pemeriksa konsistensi deployment SAPA-RT.
// Tidak mengunci nomor RT/versi tertentu: nilai yang diharapkan diturunkan dari
// nama branch dan dari berkas konfigurasi itu sendiri.
//
// Pemakaian:
//   node tools/check-deployment.js
//   node tools/check-deployment.js --live
//
// --live juga memeriksa backend Apps Script, proxy /api, version.json, portal
// publik, dan proteksi Access pada halaman admin.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIVE = process.argv.indexOf('--live') !== -1;
let pass = 0;
let fail = 0;

function check(condition, label, detail) {
  if (condition) {
    pass++;
    console.log('PASS ' + label);
  } else {
    fail++;
    console.log('FAIL ' + label + (detail ? ' (' + detail + ')' : ''));
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function match(text, regex, label) {
  const m = text.match(regex);
  if (!m) throw new Error('Tidak menemukan ' + label);
  return m[1];
}

function branchName() {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (err) {
    return '';
  }
}

const branch = branchName();
const branchRt = (branch.match(/^rt(\d{3})$/) || [])[1] || '';
const config = read('config.js');
const index = read('index.html');
const pub = read('public.html');
const versionJson = JSON.parse(read('version.json'));
const sw = read('sw.js');
const code = read('Apps Script/code.gs');
const mock = read('tools/mock-server.js');
const proxy = read('functions/api/[[path]].js');
const rwApp = read('rw/app.js');
const rwVersion = JSON.parse(read('rw/version.json'));
const rwOrch = read('RW Apps Script/code.gs');
const rwMock = read('rw/tools/mock-server.js');

const rt = match(config, /^\s*rt:\s*'([^']+)'/m, 'RT_CONFIG.rt');
const rw = match(config, /^\s*rw:\s*'([^']+)'/m, 'RT_CONFIG.rw');
const configVersion = match(config, /^\s*version:\s*'([^']+)'/m, 'RT_CONFIG.version');
const publicApiUrl = match(config, /^\s*publicApiUrl:\s*'([^']*)'/m, 'RT_CONFIG.publicApiUrl');
const publicPortalUrl = match(config, /^\s*publicPortalUrl:\s*'([^']*)'/m, 'RT_CONFIG.publicPortalUrl');
const indexConfig = match(index, /EXPECTED_CONFIG_VERSION\s*=\s*'([^']+)'/, 'EXPECTED_CONFIG_VERSION index');
const pubConfig = match(pub, /EXPECTED_CONFIG_VERSION\s*=\s*'([^']+)'/, 'EXPECTED_CONFIG_VERSION public');
const indexBuild = match(index, /APP_BUILD\s*=\s*'([^']+)'/, 'APP_BUILD index');
const pubBuild = match(pub, /APP_BUILD\s*=\s*'([^']+)'/, 'APP_BUILD public');
const backendExpected = match(index, /EXPECTED_BACKEND_VERSION\s*=\s*'([^']+)'/, 'EXPECTED_BACKEND_VERSION');
const codeVersion = match(code, /CODE_VERSION\s*=\s*"([^"]+)"/, 'CODE_VERSION code.gs');
const mockVersion = match(mock, /CODE_VERSION\s*=\s*'([^']+)'/, 'CODE_VERSION mock');
const swCache = match(sw, /const CACHE\s*=\s*'([^']+)'/, 'CACHE sw.js');
const proxyUrl = match(proxy, /DEFAULT_APPS_SCRIPT_URL\s*=\s*'([^']+)'/, 'DEFAULT_APPS_SCRIPT_URL');
const rwBuild = match(rwApp, /var BUILD\s*=\s*'([^']+)'/, 'BUILD rw/app.js');
const rwOrchVersion = match(rwOrch, /CODE_VERSION\s*=\s*'([^']+)'/, 'CODE_VERSION orkestrator');
const rwMockVersion = match(rwMock, /const VERSION\s*=\s*'([^']+)'/, 'VERSION mock portal');

console.log('Branch : ' + (branch || '(tidak diketahui)'));
console.log('RT/RW  : ' + rt + '/' + rw);
console.log('Config : v' + configVersion + ' | build index ' + indexBuild + ' | build public ' + pubBuild);
console.log('Backend: ' + codeVersion + ' | cache ' + swCache);
console.log('');

if (branchRt) check(rt === branchRt, 'RT config cocok dengan branch ' + branch, rt + ' vs ' + branchRt);
else console.log('SKIP branch bukan pola rtNNN; kecocokan RT dari branch tidak diperiksa');

check(rwVersion.build === rwBuild, 'rw/version.json build = BUILD rw/app.js', rwVersion.build + ' vs ' + rwBuild);
check(rwMockVersion === rwOrchVersion, 'VERSION mock portal = CODE_VERSION orkestrator', rwMockVersion + ' vs ' + rwOrchVersion);

check(indexConfig === configVersion, 'EXPECTED_CONFIG_VERSION index = config.version', indexConfig + ' vs ' + configVersion);
check(pubConfig === configVersion, 'EXPECTED_CONFIG_VERSION public = config.version', pubConfig + ' vs ' + configVersion);
check(versionJson.index === indexBuild, 'version.json index = APP_BUILD index', versionJson.index + ' vs ' + indexBuild);
check(versionJson.public === pubBuild, 'version.json public = APP_BUILD public', versionJson.public + ' vs ' + pubBuild);
check(backendExpected === codeVersion, 'EXPECTED_BACKEND_VERSION = CODE_VERSION', backendExpected + ' vs ' + codeVersion);
check(mockVersion === codeVersion, 'CODE_VERSION mock = code.gs', mockVersion + ' vs ' + codeVersion);
check(/^sapa-rt-static-v\d+$/.test(swCache), 'format cache SW valid', swCache);
check(proxyUrl === publicApiUrl, 'URL default proxy = publicApiUrl', proxyUrl + ' vs ' + publicApiUrl);
check(/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(publicApiUrl), 'publicApiUrl berupa Web App /exec');

if (publicPortalUrl) {
  const host = (() => { try { return new URL(publicPortalUrl).host; } catch (err) { return ''; } })();
  check(host === 'sapa-rt' + rt + '.pages.dev', 'domain portal cocok dengan RT', host);
  check(/\/public$/.test(publicPortalUrl), 'publicPortalUrl berakhir /public', publicPortalUrl);
} else {
  console.log('SKIP publicPortalUrl kosong');
}

// Sisa penanda konflik merge berarti nilai RT bisa tertimpa nilai main tanpa
// terlihat: tolak lebih awal daripada membiarkan deployment memakai URL salah.
const trackedFiles = [
  'config.js', 'version.json', 'sw.js', 'index.html', 'public.html',
  'functions/api/[[path]].js', 'Apps Script/code.gs', 'RW Apps Script/code.gs',
  'rw/app.js', 'rw/version.json'
];
const conflicted = trackedFiles.filter((file) => {
  if (!fs.existsSync(path.join(ROOT, file))) return false;
  return /^(<{7}|={7}|>{7})(\s|$)/m.test(read(file));
});
check(conflicted.length === 0, 'tidak ada sisa konflik merge', conflicted.join(', '));

const attributesPath = path.join(ROOT, '.gitattributes');
const attributes = fs.existsSync(attributesPath) ? fs.readFileSync(attributesPath, 'utf8') : '';
for (const file of ['config.js', 'version.json', 'sw.js']) {
  const pattern = new RegExp('^' + file.replace(/\./g, '\\.') + '\\s+merge=keeprt$', 'm');
  check(pattern.test(attributes), file + ' memakai merge=keeprt');
}

let mergeDriver = '';
try {
  mergeDriver = execSync('git config --get merge.keeprt.driver', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
} catch (err) {
  mergeDriver = '';
}
check(/merge-rt-files\.js/.test(mergeDriver), 'merge driver keeprt terpasang', mergeDriver || 'jalankan bash tools/setup-git-merge.sh');

if (!LIVE) {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

async function fetchWithTimeout(url, options) {
  const init = Object.assign({ redirect: 'follow' }, options || {});
  init.signal = AbortSignal.timeout(30000);
  return fetch(url, init);
}

(async () => {
  let res = await fetchWithTimeout(publicApiUrl + '?action=version');
  let body = await res.json();
  check(res.status === 200 && body.version === codeVersion, 'backend langsung = CODE_VERSION', body.version);

  if (publicPortalUrl) {
    const origin = new URL(publicPortalUrl).origin;
    res = await fetchWithTimeout(origin + '/api?action=version');
    body = await res.json();
    check(res.status === 200 && body.version === codeVersion, 'proxy /api = CODE_VERSION', body.version);

    res = await fetchWithTimeout(origin + '/version.json');
    const liveVersion = await res.json();
    check(res.status === 200 && liveVersion.index === indexBuild, 'version.json live = APP_BUILD index', liveVersion.index);
    check(liveVersion.public === pubBuild, 'version.json live public = APP_BUILD public', liveVersion.public);

    res = await fetchWithTimeout(origin + '/public');
    check(res.status === 200, 'portal publik live 200', String(res.status));

    res = await fetchWithTimeout(origin + '/', { redirect: 'manual' });
    check([301, 302, 303, 307, 308].indexOf(res.status) !== -1, 'admin live dilindungi Access (redirect)', String(res.status));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.log('FAIL live check: ' + ((err && err.message) || err));
  process.exit(1);
});
