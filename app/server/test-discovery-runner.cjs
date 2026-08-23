'use strict';
/* GOBEK17 v175 -- TEST DISCOVERY RUNNER (diagnostic only)
 *
 * Discovers app/server test-*.cjs files, runs each in its own child
 * process with an independent timeout, and classifies the result as
 * PASS, FAIL or SKIP. This tool is diagnostic: it is not wired into
 * npm test or any release/deploy chain. It never modifies the tests
 * it runs and never re-invokes itself.
 *
 * Usage: node test-discovery-runner.cjs [targetDir] [timeoutMs]
 *   targetDir defaults to this file's own directory (app/server).
 *   timeoutMs defaults to 30000.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// These two files are never treated as normal tests, under any
// target directory, to guarantee zero recursion risk.
const EXCLUDED_NAMES = new Set(['test-discovery-runner.cjs', 'test-discovery-selfcheck.cjs']);
const DEFAULT_TIMEOUT_MS = 30000;

function discover(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    console.error('DISCOVERY_ERROR: cannot read directory ' + dir + ' :: ' + (e && e.message || e));
    process.exit(2);
  }
  return entries
    .filter(function (name) {
      return /^test-.*\.cjs$/.test(name) && !EXCLUDED_NAMES.has(name);
    })
    .sort();
}

function runOne(dir, file, timeoutMs) {
  return new Promise(function (resolve) {
    const fullPath = path.join(dir, file);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(process.execPath, [fullPath], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(function () {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', function (d) { stdout += d.toString(); });
    child.stderr.on('data', function (d) { stderr += d.toString(); });

    child.on('error', function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ file: file, status: 'FAIL', detail: 'spawn error :: ' + (e && e.message || e), stdout: stdout, stderr: stderr });
    });

    child.on('close', function (code, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (timedOut) {
        resolve({ file: file, status: 'FAIL', detail: 'TIMEOUT', stdout: stdout, stderr: stderr });
        return;
      }

      const skipMatch = /^SKIP:?\s*(.*)$/m.exec(stdout);
      if (code === 0 && skipMatch) {
        const reason = (skipMatch[1] || '').trim() || 'no reason given';
        resolve({ file: file, status: 'SKIP', detail: reason, stdout: stdout, stderr: stderr });
        return;
      }

      if (code === 0) {
        resolve({ file: file, status: 'PASS', detail: '', stdout: stdout, stderr: stderr });
        return;
      }

      resolve({
        file: file,
        status: 'FAIL',
        detail: 'exit=' + code + (signal ? (' signal=' + signal) : ''),
        stdout: stdout,
        stderr: stderr
      });
    });
  });
}

async function main() {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : __dirname;
  const timeoutMs = process.argv[3] ? parseInt(process.argv[3], 10) : DEFAULT_TIMEOUT_MS;

  const discovered = discover(targetDir);
  const results = [];

  for (const file of discovered) {
    const r = await runOne(targetDir, file, timeoutMs);
    results.push(r);
    if (r.status === 'PASS') {
      console.log('PASS ' + r.file);
    } else if (r.status === 'SKIP') {
      console.log('SKIP ' + r.file + ' -- ' + r.detail);
    } else {
      console.log('FAIL ' + r.file + ' -- ' + r.detail);
    }
  }

  const discoveredCount = discovered.length;
  const runResults = results.filter(function (r) { return r.status === 'PASS' || r.status === 'FAIL'; });
  const passResults = results.filter(function (r) { return r.status === 'PASS'; });
  const failResults = results.filter(function (r) { return r.status === 'FAIL'; });
  const skipResults = results.filter(function (r) { return r.status === 'SKIP'; });

  const runCount = runResults.length;
  const passCount = passResults.length;
  const failCount = failResults.length;
  const skipCount = skipResults.length;

  console.log('');
  console.log('DISCOVERED ' + discoveredCount);
  console.log('RUN ' + runCount);
  console.log('PASS ' + passCount);
  console.log('FAIL ' + failCount);
  console.log('SKIP ' + skipCount);

  let internalError = null;
  if (discoveredCount !== runCount + skipCount) {
    internalError = 'DISCOVERED (' + discoveredCount + ') != RUN (' + runCount + ') + SKIP (' + skipCount + ')';
  } else if (runCount !== passCount + failCount) {
    internalError = 'RUN (' + runCount + ') != PASS (' + passCount + ') + FAIL (' + failCount + ')';
  }

  console.log('');
  console.log('DISCOVERED FILES');
  discovered.forEach(function (f) { console.log('  ' + f); });

  console.log('');
  console.log('RUN FILES');
  runResults.forEach(function (r) { console.log('  ' + r.file); });

  console.log('');
  console.log('FAIL FILES');
  failResults.forEach(function (r) { console.log('  ' + r.file + ' -- ' + r.detail); });

  console.log('');
  console.log('SKIP FILES + REASONS');
  skipResults.forEach(function (r) { console.log('  ' + r.file + ' -- ' + r.detail); });

  if (internalError) {
    console.log('');
    console.log('RUNNER_INTERNAL_ERROR: ' + internalError);
    process.exitCode = 1;
    return;
  }

  process.exitCode = failCount > 0 ? 1 : 0;
}

main();
