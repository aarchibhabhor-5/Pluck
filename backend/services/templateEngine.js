// Template Variable Engine (PRD §2.3.10)
// Interpolates {{varName|default}} with runtime values

export function interpolate(code, values = {}) {
  if (!code || typeof code !== 'string') return '';

  return code.replace(/\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g, (match, varName, defaultVal) => {
    if (values && values[varName] !== undefined && values[varName] !== '') {
      return String(values[varName]);
    }
    return defaultVal !== undefined ? defaultVal : match;
  });
}

export function generateInstallCommand(dependencies = [], packageManager = 'npm') {
  if (!dependencies || dependencies.length === 0) return '';
  const pkgs = dependencies.map(d => d.versionHint && d.versionHint !== 'latest' ? `${d.name}@${d.versionHint}` : d.name).join(' ');

  switch (packageManager.toLowerCase()) {
    case 'pnpm':
      return `pnpm add ${pkgs}`;
    case 'yarn':
      return `yarn add ${pkgs}`;
    case 'bun':
      return `bun add ${pkgs}`;
    case 'npm':
    default:
      return `npm i ${pkgs}`;
  }
}
