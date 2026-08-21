'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

const ROOT = __dirname;
const ARCHIVE = path.join(ROOT, 'gobek17-app.zip');
const APP = path.join(ROOT, '.gobek17-app');
const MARKER = path.join(APP, '.extracted-sha256');

// Single source of truth: surum etiketi package.json 'version' alanindan turetilir.
let VERSION_TAG = 'v169';
try {
  const pkg = require('./package.json');
  const [maj, min] = String((pkg && pkg.version) || '').split('.');
  if (maj && min && Number.isFinite(Number(maj)) && Number.isFinite(Number(min))) {
    VERSION_TAG = 'v' + (Number(maj) * 100 + Number(min));
  }
} catch (_) {}

function fail(msg) {
  console.error('[G17 BOOT]', msg);
  process.exit(1);
}

if (!fs.existsSync(ARCHIVE)) fail('gobek17-app.zip bulunamadı.');

try {
  const archiveSha = crypto.createHash('sha256').update(fs.readFileSync(ARCHIVE)).digest('hex');
  const extractedSha = fs.existsSync(MARKER) ? String(fs.readFileSync(MARKER, 'utf8')).trim() : '';
  if (archiveSha !== extractedSha) {
    fs.rmSync(APP, { recursive: true, force: true });
    fs.mkdirSync(APP, { recursive: true });
    console.log(`[G17 BOOT] ${VERSION_TAG} uygulama arşivi açılıyor:`, archiveSha.slice(0, 12));
    new AdmZip(ARCHIVE).extractAllTo(APP, true);
    fs.writeFileSync(MARKER, archiveSha);
  }
} catch (e) {
  fail('Arşiv açılamadı: ' + (e && e.stack || e));
}

// Railway production domain is known and must be allowed explicitly.
// Keep null as well so the Android file:// / content:// ZIP preview can call the same backend.
const FIXED_PUBLIC_BASE = 'https://gobekliokey-production.up.railway.app';
const railwayDomain = String(process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
const detectedBase = railwayDomain
  ? 'https://' + railwayDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  : FIXED_PUBLIC_BASE;

process.env.G17_PUBLIC_BASE_URL =
  process.env.G17_PUBLIC_BASE_URL || detectedBase;

if (!process.env.G17_ALLOWED_ORIGINS) {
  const origins = new Set([
    'null',
    FIXED_PUBLIC_BASE,
    detectedBase
  ]);
  process.env.G17_ALLOWED_ORIGINS = [...origins].join(',');
}

process.env.G17_STORE = process.env.G17_STORE || 'file';
process.env.G17_REPLICA_COUNT = process.env.G17_REPLICA_COUNT || '1';
process.env.G17_AUTH_MODE = process.env.G17_AUTH_MODE || 'required';
process.env.G17_ALLOW_REGISTRATION = process.env.G17_ALLOW_REGISTRATION || '1';
process.env.G17_MODERATION = process.env.G17_MODERATION || '0';
process.env.G17_PASSWORD_MIN = process.env.G17_PASSWORD_MIN || '10';
process.env.G17_TRUST_PROXY = process.env.G17_TRUST_PROXY || '1';

console.log('[G17 BOOT] Public base:', process.env.G17_PUBLIC_BASE_URL);
console.log('[G17 BOOT] Allowed origins:', process.env.G17_ALLOWED_ORIGINS);

const entry = path.join(APP, 'server.cjs');
if (!fs.existsSync(entry)) fail('Arşiv içinde server.cjs bulunamadı.');

console.log('[G17 BOOT] Authority başlatılıyor:', entry);

const child = spawn(process.execPath, [entry], {
  cwd: APP,
  env: process.env,
  stdio: 'inherit'
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { child.kill(sig); } catch (_) {}
  });
}

child.on('exit', (code, signal) => {
  if (signal) console.error('[G17 BOOT] Child signal:', signal);
  process.exit(code == null ? 1 : code);
});
