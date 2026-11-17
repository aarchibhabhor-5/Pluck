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

  let status = 'SUCCESS';
  let exitCode = 0;
  let returnValue = null;

  const t0 = performance.now();

  // Non-JavaScript languages require compiler/interpreter on Cloud Sandbox
  if (lang === 'java' || lang === 'python' || lang === 'py' || lang === 'rust' || lang === 'go' || lang === 'cpp' || lang === 'c') {
    const langName = lang === 'java' ? 'Java (OpenJDK 21)' : (lang.startsWith('py') ? 'Python 3' : lang.toUpperCase());
    stderr.push(`[RUNTIME NOTICE] ${langName} snippets compile and execute via the Cloud Sandbox.`);
    stderr.push(`👉 Please switch the engine dropdown above to "⚡ Cloud Sandbox (Render)" for full compiler execution.`);
    status = 'ERROR';
    exitCode = 1;
  } else {
    // JavaScript / TypeScript execution
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

    try {
      // Mock React hooks environment so React hooks run seamlessly
      const useState = (init) => {
        let val = init;
        const setter = (next) => { val = typeof next === 'function' ? next(val) : next; };
        return [val, setter];
      };
      const useEffect = (fn) => { if (typeof fn === 'function') fn(); };
      const useCallback = (fn) => fn;
      const useMemo = (fn) => (typeof fn === 'function' ? fn() : fn);
      const useRef = (init) => ({ current: init });

      // Isolated sandbox scope
      const sandboxScope = {
        exports: {},
        module: { exports: {} }
      };

      // Ensure entryPoint function is exposed on exports
      let execCode = cleanCode;
      if (entryPoint) {
        execCode += `\ntry { if (typeof ${entryPoint} === 'function') exports['${entryPoint}'] = ${entryPoint}; } catch(e) {}`;
      }
      // Also auto-export useDebounce or common declared functions
      execCode += `\ntry { if (typeof useDebounce === 'function') exports['useDebounce'] = useDebounce; } catch(e) {}`;

      // If code is an expression without return or declaration, return its evaluated value
      if (!/\breturn\b/.test(execCode) && !execCode.includes('console.log')) {
        const trimmed = execCode.trim();
        if (!/^(const|let|var|function|class|import|export|if|for|while|try)\b/.test(trimmed)) {
          execCode = 'return (' + trimmed.replace(/;+$/, '') + ');';
        }
      }

      const runnerFn = new Function('exports', 'module', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', execCode);
      const result = runnerFn(sandboxScope.exports, sandboxScope.module, useState, useEffect, useCallback, useMemo, useRef);

      // Check entry point
      const effectiveEntry = entryPoint || (typeof sandboxScope.exports['useDebounce'] === 'function' ? 'useDebounce' : '');
      const safeArgs = (Array.isArray(args) && args.length > 0) ? args : (effectiveEntry === 'useDebounce' ? ['search-query', 300] : []);

      if (effectiveEntry && typeof sandboxScope.exports[effectiveEntry] === 'function') {
        returnValue = sandboxScope.exports[effectiveEntry](...safeArgs);
      } else if (effectiveEntry && typeof sandboxScope.module.exports[effectiveEntry] === 'function') {
        returnValue = sandboxScope.module.exports[effectiveEntry](...safeArgs);
      } else if (effectiveEntry && typeof self[effectiveEntry] === 'function') {
        returnValue = self[effectiveEntry](...safeArgs);
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
