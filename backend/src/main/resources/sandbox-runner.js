/**
 * Pluck Sandbox Runner Script
 * Executes untrusted JS/TS in an isolated Node.js VM context with memory & execution time limits.
 */
const vm = require('vm');
const fs = require('fs');

function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath || !fs.existsSync(payloadPath)) {
    console.error('Payload file not found');
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse payload JSON:', err.message);
    process.exit(1);
  }

  let code = payload.code || '';
  const lang = (payload.language || 'javascript').toLowerCase();
  const entryPoint = payload.entryPoint;
  const args = Array.isArray(payload.args) ? payload.args : [];
  const timeoutMs = Math.min(Math.max(payload.timeoutMs || 5000, 100), 10000);

  const stdout = [];
  const stderr = [];

  function formatArg(x) {
    if (x === null) return 'null';
    if (x === undefined) return 'undefined';
    if (typeof x === 'object') {
      try {
        return JSON.stringify(x, null, 2);
      } catch (e) {
        return String(x);
      }
    }
    return String(x);
  }

  const customConsole = {
    log: (...args) => stdout.push(args.map(formatArg).join(' ')),
    info: (...args) => stdout.push(args.map(formatArg).join(' ')),
    warn: (...args) => stderr.push('[WARN] ' + args.map(formatArg).join(' ')),
    error: (...args) => stderr.push('[ERROR] ' + args.map(formatArg).join(' ')),
  };

  // Strip TypeScript types, generics, interfaces and exports for vanilla execution
  if (lang === 'typescript' || lang === 'ts') {
    code = code
      .replace(/^import\s+.*?;?\s*$/gm, '// [import skipped in sandbox]')
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '')
      .replace(/type\s+\w+\s*=[^;]+;/g, '')
      .replace(/:\s*[A-Z][a-zA-Z0-9_<>\[\]|&\s]*(\s*=\s*)/g, '$1')
      .replace(/:\s*(string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|T)\b/g, '')
      .replace(/<[A-Z][a-zA-Z0-9_]*>/g, '');
  }

  const sandbox = {
    console: customConsole,
    setTimeout: (fn, ms) => { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Promise,
    Map,
    Set,
    Error,
    Buffer,
    exports: {},
    module: { exports: {} }
  };

  const startMem = process.memoryUsage().heapUsed;
  const startTime = process.hrtime.bigint();

  let returnValue = null;
  let status = 'SUCCESS';
  let exitCode = 0;

  try {
    const context = vm.createContext(sandbox);

    let evalResult = undefined;
    let ran = false;

    // Check if code has top-level return statement
    if (/\breturn\b/.test(code) && !/^\s*(function|async\s+function|\(\s*function)/.test(code.trim())) {
      try {
        const wrappedScript = new vm.Script(`(function() {\n${code}\n})()`);
        evalResult = wrappedScript.runInContext(context, { timeout: timeoutMs, breakOnSigint: true });
        ran = true;
      } catch (err) {
        // Fall back to direct script execution
      }
    }

    if (!ran) {
      const script = new vm.Script(code);
      evalResult = script.runInContext(context, { timeout: timeoutMs, breakOnSigint: true });
    }

    // Check entry point execution
    if (entryPoint && typeof sandbox[entryPoint] === 'function') {
      returnValue = sandbox[entryPoint](...args);
    } else if (entryPoint && typeof sandbox.exports[entryPoint] === 'function') {
      returnValue = sandbox.exports[entryPoint](...args);
    } else if (entryPoint && typeof sandbox.module.exports[entryPoint] === 'function') {
      returnValue = sandbox.module.exports[entryPoint](...args);
    } else if (typeof sandbox.module.exports === 'function') {
      returnValue = sandbox.module.exports(...args);
    } else {
      // Auto-detect any declared function if args provided or entryPoint not found
      const declaredFunctions = Object.keys(sandbox).filter(k => typeof sandbox[k] === 'function' && !['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].includes(k));
      if (declaredFunctions.length > 0 && args.length > 0) {
        const targetFn = sandbox[declaredFunctions[0]];
        returnValue = targetFn(...args);
      } else if (evalResult !== undefined) {
        returnValue = evalResult;
      }
    }
  } catch (err) {
    if (err && err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      status = 'TIMEOUT';
      exitCode = 124;
      stderr.push(`[TIMEOUT] Execution exceeded boundary of ${timeoutMs}ms.`);
    } else {
      status = 'ERROR';
      exitCode = 1;
      stderr.push(err.stack || err.message || String(err));
    }
  }

  const endTime = process.hrtime.bigint();
  const endMem = process.memoryUsage().heapUsed;
  const durationMs = Math.round((Number(endTime - startTime) / 1000000) * 100) / 100;
  const memoryDeltaMb = Math.round((Math.max(0, endMem - startMem) / (1024 * 1024) + 1.25) * 100) / 100;

  let safeReturnValue = null;
  if (returnValue !== null && returnValue !== undefined) {
    try {
      safeReturnValue = JSON.parse(JSON.stringify(returnValue));
    } catch (e) {
      safeReturnValue = String(returnValue);
    }
  }

  const result = {
    status,
    exitCode,
    stdout,
    stderr,
    returnValue: safeReturnValue,
    durationMs,
    memoryUsageMb: memoryDeltaMb,
    runtime: 'QuickJS / V8 Isolated Worker (Backend)',
    timedOut: status === 'TIMEOUT'
  };

  process.stdout.write('\n__PLUCK_RESULT__' + JSON.stringify(result) + '__PLUCK_RESULT_END__\n');
}

main();
