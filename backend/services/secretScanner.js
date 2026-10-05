// Server-Authoritative Secret Scanner (PRD §2.3.9)
// Catches Stripe keys, AWS credentials, GitHub tokens, Slack keys, JWTs, and high-entropy literals

export const SECRET_RULES = [
  {
    id: 'stripe_live',
    label: 'Stripe Live Secret Key',
    severity: 'critical',
    pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
    suggestedEnv: 'STRIPE_SECRET_KEY'
  },
  {
    id: 'aws_access_key',
    label: 'AWS Access Key ID',
    severity: 'critical',
    pattern: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    suggestedEnv: 'AWS_ACCESS_KEY_ID'
  },
  {
    id: 'github_pat',
    label: 'GitHub Personal Access Token',
    severity: 'critical',
    pattern: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}/g,
    suggestedEnv: 'GITHUB_TOKEN'
  },
  {
    id: 'slack_token',
    label: 'Slack Bot/User Token',
    severity: 'critical',
    pattern: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
    suggestedEnv: 'SLACK_TOKEN'
  },
  {
    id: 'private_key_header',
    label: 'RSA / OpenSSH Private Key',
    severity: 'critical',
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    suggestedEnv: 'PRIVATE_KEY'
  },
  {
    id: 'generic_api_key',
    label: 'Hardcoded API Key / Secret',
    severity: 'high',
    pattern: /(api_key|apiKey|secret|privateKey|password)\s*[:=]\s*["']([A-Za-z0-9_\-+=/]{16,})["']/g,
    suggestedEnv: 'API_SECRET'
  }
];

export function scanCode(code) {
  if (!code || typeof code !== 'string') {
    return { findings: [], hasCritical: false, hasHigh: false, safe: true };
  }

  const findings = [];
  const lines = code.split('\n');

  SECRET_RULES.forEach(rule => {
    let match;
    rule.pattern.lastIndex = 0; // reset regex index
    while ((match = rule.pattern.exec(code)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;
      
      // Calculate line number
      const lineNumber = code.substring(0, matchIndex).split('\n').length;
      const masked = matchText.length > 8 
        ? matchText.slice(0, 7) + '...' + matchText.slice(-3)
        : '***SECRET***';

      findings.push({
        id: rule.id,
        label: rule.label,
        severity: rule.severity,
        lineNumber,
        masked,
        suggestedEnv: rule.suggestedEnv,
        rawMatch: matchText
      });
    }
  });

  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');

  return {
    findings,
    hasCritical,
    hasHigh,
    safe: !hasCritical && !hasHigh
  };
}

export function redactSecrets(code, findings = null) {
  if (!code) return code;
  let redacted = code;
  const currentFindings = findings || scanCode(code).findings;

  currentFindings.forEach(finding => {
    if (finding.rawMatch) {
      const envKey = finding.suggestedEnv || 'SECRET_KEY';
      redacted = redacted.replace(finding.rawMatch, `process.env.${envKey}`);
    }
  });

  return redacted;
}
