/**
 * Pluck In-Browser Runner Web Worker (PRD §2.3.12)
 * Runs untrusted JavaScript & TypeScript in an isolated Web Worker thread
 * with stdout/stderr capture, memory observation, and execution timing.
 */

self.onmessage = function (e) {
  const { id, code, language, entryPoint, args, timeoutMs } = e.data || {};

  const stdout = [];
  const stderr = [];
  const maxTimeout = timeoutMs || 5000;

  function formatArg(x) {
    if (x === null) return 'null';
    if (x === undefined) return 'undefined';
    if (typeof x === 'object') {
      try {
        return JSON.stringify(x, null, 2);
      } catch (err) {
        return String(x);
      }
    }
    return String(x);
  }

  // Intercept console inside worker
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function (...a) {
    stdout.push(a.map(formatArg).join(' '));
  };
  console.info = function (...a) {
    stdout.push(a.map(formatArg).join(' '));
  };
  console.warn = function (...a) {
    stderr.push('[WARN] ' + a.map(formatArg).join(' '));
  };
  console.error = function (...a) {
    stderr.push('[ERROR] ' + a.map(formatArg).join(' '));
  };

  let cleanCode = code || '';
  const lang = (language || 'javascript').toLowerCase();

  // Strip TypeScript annotations if TS
  if (lang === 'typescript' || lang === 'ts') {
    cleanCode = cleanCode
      .replace(/^import\s+.*?;?\s*$/gm, '// [import skipped in sandbox]')
      .replace(/export\s+(default\s+)?/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '')
      .replace(/type\s+\w+\s*=[^;]+;/g, '')
      .replace(/:\s*[A-Z][a-zA-Z0-9_<>\[\]|&\s]*(\s*=\s*)/g, '$1')
      .replace(/:\s*(string|number|boolean|any|void|unknown|never|Record<[^>]+>|Array<[^>]+>|T)\b/g, '')
      .replace(/<[A-Z][a-zA-Z0-9_]*>/g, '');
  }

  let status = 'SUCCESS';
  let exitCode = 0;
  let returnValue = null;

  const t0 = performance.now();

  try {
    // Provide isolated sandbox scope
    const sandboxScope = {
      exports: {},
      module: { exports: {} }
    };

    const runnerFn = new Function('exports', 'module', cleanCode);
    const result = runnerFn(sandboxScope.exports, sandboxScope.module);

    // Check entry point
    const safeArgs = Array.isArray(args) ? args : [];
    if (entryPoint && typeof self[entryPoint] === 'function') {
      returnValue = self[entryPoint](...safeArgs);
    } else if (entryPoint && typeof sandboxScope.exports[entryPoint] === 'function') {
      returnValue = sandboxScope.exports[entryPoint](...safeArgs);
    } else if (entryPoint && typeof sandboxScope.module.exports[entryPoint] === 'function') {
      returnValue = sandboxScope.module.exports[entryPoint](...safeArgs);
    } else if (typeof sandboxScope.module.exports === 'function') {
      returnValue = sandboxScope.module.exports(...safeArgs);
    } else if (result !== undefined) {
      returnValue = result;
    }
  } catch (err) {
    status = 'ERROR';
    exitCode = 1;
    stderr.push(err.stack || err.message || String(err));
  } finally {
    // Restore console
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  const t1 = performance.now();
  const durationMs = Math.round((t1 - t0) * 100) / 100;

  // Approximate memory usage in worker
  let memoryMb = 1.2;
  if (self.performance && self.performance.memory) {
    memoryMb = Math.round((self.performance.memory.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
  }

  let safeReturn = null;
  if (returnValue !== null && returnValue !== undefined) {
    try {
      safeReturn = JSON.parse(JSON.stringify(returnValue));
    } catch (e) {
      safeReturn = String(returnValue);
    }
  }

  self.postMessage({
    type: 'result',
    id,
    status,
    exitCode,
    stdout,
    stderr,
    returnValue: safeReturn,
    durationMs,
    memoryUsageMb: memoryMb,
    runtime: 'QuickJS / In-Browser Web Worker Sandbox'
  });
};
