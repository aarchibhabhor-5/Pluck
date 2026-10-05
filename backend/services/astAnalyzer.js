// Server-Side AST Dependency & Env Key Extraction Engine (PRD §2.4)
// Parses imports, require statements, and environment variable references

const STDLIB_JS = new Set([
  'fs', 'path', 'os', 'http', 'https', 'crypto', 'stream', 'events', 
  'util', 'url', 'child_process', 'node:fs', 'node:path', 'node:os', 
  'node:http', 'node:crypto', 'node:util'
]);

const STDLIB_PY = new Set([
  'os', 'sys', 'math', 'time', 'datetime', 'json', 're', 'random',
  'typing', 'collections', 'itertools', 'functools', 'pathlib'
]);

export function analyzeCode(code, language = 'typescript') {
  if (!code || typeof code !== 'string') {
    return { dependencies: [], envKeys: [], variables: [] };
  }

  const dependencies = new Map();
  const envKeys = new Set();
  const variables = [];

  const lang = (language || 'typescript').toLowerCase();

  if (lang.includes('typescript') || lang.includes('javascript') || lang === 'ts' || lang === 'js') {
    // 1. ES Import statements: import ... from 'pkg'
    const importRegex = /import\s+(?:(?:(?:\w+|\{[^}]*\})\s+from\s+)?["']([^"']+)["'])/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const rawPkg = match[1];
      if (!rawPkg.startsWith('.') && !rawPkg.startsWith('/') && !STDLIB_JS.has(rawPkg)) {
        const pkgName = extractPackageRoot(rawPkg);
        dependencies.set(pkgName, { name: pkgName, versionHint: 'latest' });
      }
    }

    // 2. CommonJS Require statements: require('pkg')
    const requireRegex = /require\(["']([^"']+)["']\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      const rawPkg = match[1];
      if (!rawPkg.startsWith('.') && !rawPkg.startsWith('/') && !STDLIB_JS.has(rawPkg)) {
        const pkgName = extractPackageRoot(rawPkg);
        dependencies.set(pkgName, { name: pkgName, versionHint: 'latest' });
      }
    }

    // 3. Process.env detection: process.env.KEY or process.env['KEY']
    const envRegex = /process\.env(?:\.([A-Za-z0-9_]+)|\[["']([A-Za-z0-9_]+)["']\])/g;
    while ((match = envRegex.exec(code)) !== null) {
      const key = match[1] || match[2];
      if (key) envKeys.add(key);
    }
  } else if (lang.includes('python') || lang === 'py') {
    // 1. Python imports: import pkg or from pkg import ...
    const pyImportRegex = /(?:^|\n)(?:from|import)\s+([A-Za-z0-9_]+)/g;
    let match;
    while ((match = pyImportRegex.exec(code)) !== null) {
      const pkg = match[1];
      if (!STDLIB_PY.has(pkg)) {
        dependencies.set(pkg, { name: pkg, versionHint: 'latest' });
      }
    }

    // 2. Python env keys: os.environ[...] or os.getenv(...)
    const pyEnvRegex = /os\.(?:environ\[["']|getenv\(["'])([A-Za-z0-9_]+)["']/g;
    while ((match = pyEnvRegex.exec(code)) !== null) {
      if (match[1]) envKeys.add(match[1]);
    }
  }

  // 4. Template variables detection: {{name|default}} or {{name}}
  const varRegex = /\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g;
  let varMatch;
  const seenVars = new Set();
  while ((varMatch = varRegex.exec(code)) !== null) {
    const varName = varMatch[1];
    const defaultVal = varMatch[2] || '';
    if (!seenVars.has(varName)) {
      seenVars.add(varName);
      variables.push({
        name: varName,
        defaultValue: defaultVal,
        type: !isNaN(Number(defaultVal)) && defaultVal !== '' ? 'number' : 'string'
      });
    }
  }

  return {
    dependencies: Array.from(dependencies.values()),
    envKeys: Array.from(envKeys),
    variables
  };
}

function extractPackageRoot(importPath) {
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importPath.split('/')[0];
}
