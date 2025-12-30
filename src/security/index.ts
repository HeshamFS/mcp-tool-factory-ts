/**
 * Security scanner for generated MCP server code.
 *
 * Scans for common security issues including:
 * - Hardcoded credentials
 * - SQL injection patterns
 * - Command injection patterns
 * - Path traversal vulnerabilities
 * - Insecure randomness
 * - Missing input validation
 */

import { readFileSync } from 'fs';
import { existsSync } from 'fs';

/**
 * Severity levels for security issues.
 */
export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * A detected security issue.
 */
export interface SecurityIssue {
  severity: IssueSeverity;
  category: string;
  message: string;
  lineNumber?: number;
  lineContent?: string;
  recommendation?: string;
}

/**
 * Create a security issue.
 */
export function createSecurityIssue(
  severity: IssueSeverity,
  category: string,
  message: string,
  options: {
    lineNumber?: number;
    lineContent?: string;
    recommendation?: string;
  } = {}
): SecurityIssue {
  return {
    severity,
    category,
    message,
    lineNumber: options.lineNumber,
    lineContent: options.lineContent,
    recommendation: options.recommendation,
  };
}

/**
 * Convert a security issue to a plain object.
 */
export function securityIssueToDict(issue: SecurityIssue): Record<string, unknown> {
  return {
    severity: issue.severity,
    category: issue.category,
    message: issue.message,
    line_number: issue.lineNumber,
    line_content: issue.lineContent,
    recommendation: issue.recommendation,
  };
}

/**
 * A security scanning rule.
 */
export interface ScanRule {
  name: string;
  category: string;
  severity: IssueSeverity;
  pattern: string;
  message: string;
  recommendation: string;
  excludePatterns?: string[];
}

/**
 * Default scanning rules for TypeScript/JavaScript code.
 */
export const DEFAULT_RULES: ScanRule[] = [
  // Hardcoded credentials
  {
    name: 'hardcoded_password',
    category: 'credentials',
    severity: IssueSeverity.CRITICAL,
    pattern: '(?i)(password|passwd|pwd)\\s*[=:]\\s*["\'][^"\']+["\']',
    message: 'Hardcoded password detected',
    recommendation: 'Use environment variables or a secrets manager',
    excludePatterns: ['password\\s*[=:]\\s*["\'][\\$\\{]', 'process\\.env', 'getenv'],
  },
  {
    name: 'hardcoded_api_key',
    category: 'credentials',
    severity: IssueSeverity.CRITICAL,
    pattern: '(?i)(api[_-]?key|apikey|secret[_-]?key)\\s*[=:]\\s*["\'][a-zA-Z0-9_-]{20,}["\']',
    message: 'Hardcoded API key detected',
    recommendation: 'Use environment variables or a secrets manager',
    excludePatterns: ['process\\.env', 'getenv'],
  },
  {
    name: 'hardcoded_token',
    category: 'credentials',
    severity: IssueSeverity.HIGH,
    pattern: '(?i)(token|bearer|auth)\\s*[=:]\\s*["\'][a-zA-Z0-9_-]{20,}["\']',
    message: 'Hardcoded token detected',
    recommendation: 'Use environment variables or a secrets manager',
    excludePatterns: ['process\\.env', 'getenv', 'placeholder'],
  },

  // SQL injection (for TypeScript ORM/query usage)
  {
    name: 'sql_injection_template',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: '(?i)(execute|query|raw)\\s*\\(\\s*`.*\\$\\{.*\\}',
    message: 'Potential SQL injection via template literal',
    recommendation: 'Use parameterized queries instead',
  },
  {
    name: 'sql_injection_concat',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: '(?i)(execute|query|raw)\\s*\\([^)]*\\+\\s*[^)]+\\)',
    message: 'Potential SQL injection via string concatenation',
    recommendation: 'Use parameterized queries instead',
  },

  // Command injection
  {
    name: 'command_injection_exec',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: 'child_process\\.exec\\s*\\(',
    message: 'child_process.exec() is vulnerable to command injection',
    recommendation: 'Use child_process.spawn() with explicit arguments array',
  },
  {
    name: 'command_injection_execSync',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: 'child_process\\.execSync\\s*\\(',
    message: 'child_process.execSync() is vulnerable to command injection',
    recommendation: 'Use child_process.spawnSync() with explicit arguments array',
  },
  {
    name: 'command_injection_shell',
    category: 'injection',
    severity: IssueSeverity.HIGH,
    pattern: 'spawn\\([^)]*shell\\s*:\\s*true',
    message: 'spawn with shell:true is vulnerable to injection',
    recommendation: 'Use shell:false with an arguments array',
  },
  {
    name: 'command_injection_eval',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: '(?<!//)\\s*eval\\s*\\(',
    message: 'eval() is dangerous and can execute arbitrary code',
    recommendation: 'Avoid eval(); use safer alternatives like JSON.parse()',
  },
  {
    name: 'command_injection_function',
    category: 'injection',
    severity: IssueSeverity.CRITICAL,
    pattern: 'new\\s+Function\\s*\\(',
    message: 'new Function() is dangerous and can execute arbitrary code',
    recommendation: 'Avoid dynamic code execution; find safer alternatives',
  },

  // Path traversal
  {
    name: 'path_traversal',
    category: 'path_traversal',
    severity: IssueSeverity.HIGH,
    pattern: '(readFile|writeFile|readFileSync|writeFileSync)\\s*\\([^)]*\\+\\s*[^)]+\\)',
    message: 'Potential path traversal via string concatenation in file path',
    recommendation: 'Validate and sanitize file paths; use path.resolve() and path.normalize()',
  },
  {
    name: 'path_traversal_template',
    category: 'path_traversal',
    severity: IssueSeverity.HIGH,
    pattern: '(readFile|writeFile|readFileSync|writeFileSync)\\s*\\(\\s*`.*\\$\\{',
    message: 'Potential path traversal via template literal in file path',
    recommendation: 'Validate and sanitize file paths; use path.resolve() and path.normalize()',
  },

  // Insecure randomness
  {
    name: 'insecure_random',
    category: 'cryptography',
    severity: IssueSeverity.MEDIUM,
    pattern: 'Math\\.random\\s*\\(',
    message: 'Using Math.random() for potentially security-sensitive operation',
    recommendation: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive randomness',
  },

  // Weak hashing
  {
    name: 'weak_hash_md5',
    category: 'cryptography',
    severity: IssueSeverity.MEDIUM,
    pattern: "createHash\\s*\\(\\s*['\"]md5['\"]\\s*\\)",
    message: 'MD5 is cryptographically weak',
    recommendation: 'Use SHA-256 or stronger for security purposes',
  },
  {
    name: 'weak_hash_sha1',
    category: 'cryptography',
    severity: IssueSeverity.MEDIUM,
    pattern: "createHash\\s*\\(\\s*['\"]sha1['\"]\\s*\\)",
    message: 'SHA-1 is cryptographically weak',
    recommendation: 'Use SHA-256 or stronger for security purposes',
  },

  // Insecure deserialization
  {
    name: 'unsafe_json_parse',
    category: 'deserialization',
    severity: IssueSeverity.MEDIUM,
    pattern: 'JSON\\.parse\\s*\\([^)]*\\)(?!.*catch)',
    message: 'JSON.parse() without error handling can throw exceptions',
    recommendation: 'Wrap JSON.parse() in try-catch for untrusted input',
  },

  // Debugging/development code
  {
    name: 'debug_true',
    category: 'configuration',
    severity: IssueSeverity.MEDIUM,
    pattern: '(?i)debug\\s*[=:]\\s*true',
    message: 'Debug mode enabled',
    recommendation: 'Ensure debug is disabled in production',
  },
  {
    name: 'console_log_secrets',
    category: 'logging',
    severity: IssueSeverity.MEDIUM,
    pattern: 'console\\.(log|info|warn|error)\\s*\\([^)]*(?:password|secret|token|key)[^)]*\\)',
    message: 'Potentially logging sensitive information',
    recommendation: 'Avoid logging sensitive data; use proper secret handling',
  },

  // Insecure SSL/TLS
  {
    name: 'ssl_reject_unauthorized',
    category: 'network',
    severity: IssueSeverity.HIGH,
    pattern: 'rejectUnauthorized\\s*:\\s*false',
    message: 'SSL certificate verification disabled',
    recommendation: 'Enable SSL verification in production',
  },
  {
    name: 'node_tls_reject',
    category: 'network',
    severity: IssueSeverity.CRITICAL,
    pattern: "NODE_TLS_REJECT_UNAUTHORIZED\\s*=\\s*['\"]0['\"]",
    message: 'TLS verification globally disabled',
    recommendation: 'Never disable TLS verification in production',
  },

  // Hardcoded IPs/URLs
  {
    name: 'hardcoded_ip',
    category: 'configuration',
    severity: IssueSeverity.LOW,
    pattern:
      '["\'](?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)["\']',
    message: 'Hardcoded IP address detected',
    recommendation: 'Use configuration or environment variables',
    excludePatterns: ['127\\.0\\.0\\.1', '0\\.0\\.0\\.0', 'localhost'],
  },

  // Prototype pollution
  {
    name: 'prototype_pollution',
    category: 'injection',
    severity: IssueSeverity.HIGH,
    pattern: '\\[\\s*["\']__proto__["\']\\s*\\]|\\.\\_\\_proto\\_\\_',
    message: 'Potential prototype pollution vulnerability',
    recommendation: 'Validate object keys and use Object.create(null) for dictionaries',
  },

  // XSS vulnerabilities
  {
    name: 'dangerously_set_inner_html',
    category: 'xss',
    severity: IssueSeverity.HIGH,
    pattern: 'dangerouslySetInnerHTML',
    message: 'dangerouslySetInnerHTML can lead to XSS vulnerabilities',
    recommendation: 'Sanitize HTML content before rendering or use safe alternatives',
  },
  {
    name: 'inner_html_assignment',
    category: 'xss',
    severity: IssueSeverity.HIGH,
    pattern: '\\.innerHTML\\s*=',
    message: 'Direct innerHTML assignment can lead to XSS vulnerabilities',
    recommendation: 'Use textContent or sanitize HTML content',
  },
];

/**
 * Scans code for security vulnerabilities.
 */
export class SecurityScanner {
  rules: ScanRule[];

  constructor(rules?: ScanRule[]) {
    this.rules = rules ?? DEFAULT_RULES;
  }

  /**
   * Scan code for security issues.
   */
  scan(code: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');

    for (const rule of this.rules) {
      // Create pattern with case-insensitive flag if (?i) is present
      let patternStr = rule.pattern;
      let flags = '';
      if (patternStr.startsWith('(?i)')) {
        patternStr = patternStr.slice(4);
        flags = 'i';
      }

      const pattern = new RegExp(patternStr, flags);

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum]!;

        // Skip comments
        const stripped = line.trim();
        if (stripped.startsWith('//') || stripped.startsWith('/*')) {
          continue;
        }

        if (pattern.test(line)) {
          // Check exclusion patterns
          let excluded = false;
          if (rule.excludePatterns) {
            for (const exclude of rule.excludePatterns) {
              if (new RegExp(exclude, 'i').test(line)) {
                excluded = true;
                break;
              }
            }
          }

          if (!excluded) {
            issues.push(
              createSecurityIssue(rule.severity, rule.category, rule.message, {
                lineNumber: lineNum + 1,
                lineContent: stripped.slice(0, 100),
                recommendation: rule.recommendation,
              })
            );
          }
        }
      }
    }

    return issues;
  }

  /**
   * Scan a file for security issues.
   */
  scanFile(filePath: string): SecurityIssue[] {
    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const code = readFileSync(filePath, 'utf-8');
      return this.scan(code);
    } catch {
      return [];
    }
  }

  /**
   * Get summary of scan results.
   */
  getSummary(issues: SecurityIssue[]): ScanSummary {
    const severityCounts: Record<IssueSeverity, number> = {
      [IssueSeverity.LOW]: 0,
      [IssueSeverity.MEDIUM]: 0,
      [IssueSeverity.HIGH]: 0,
      [IssueSeverity.CRITICAL]: 0,
    };
    const categoryCounts: Record<string, number> = {};

    for (const issue of issues) {
      severityCounts[issue.severity]++;
      categoryCounts[issue.category] = (categoryCounts[issue.category] ?? 0) + 1;
    }

    return {
      totalIssues: issues.length,
      bySeverity: severityCounts,
      byCategory: categoryCounts,
      hasCritical: severityCounts[IssueSeverity.CRITICAL] > 0,
      hasHigh: severityCounts[IssueSeverity.HIGH] > 0,
    };
  }
}

/**
 * Summary of scan results.
 */
export interface ScanSummary {
  totalIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  byCategory: Record<string, number>;
  hasCritical: boolean;
  hasHigh: boolean;
}

/**
 * Scan code for security issues.
 */
export function scanCode(code: string): SecurityIssue[] {
  const scanner = new SecurityScanner();
  return scanner.scan(code);
}

/**
 * Scan a file for security issues.
 */
export function scanFile(filePath: string): SecurityIssue[] {
  const scanner = new SecurityScanner();
  return scanner.scanFile(filePath);
}

/**
 * Generate a security report from scan results.
 */
export function generateSecurityReport(issues: SecurityIssue[]): string {
  if (issues.length === 0) {
    return 'No security issues detected.';
  }

  const scanner = new SecurityScanner();
  const summary = scanner.getSummary(issues);

  const lines: string[] = [
    '='.repeat(60),
    'SECURITY SCAN REPORT',
    '='.repeat(60),
    '',
    `Total Issues: ${summary.totalIssues}`,
    `  Critical: ${summary.bySeverity[IssueSeverity.CRITICAL]}`,
    `  High: ${summary.bySeverity[IssueSeverity.HIGH]}`,
    `  Medium: ${summary.bySeverity[IssueSeverity.MEDIUM]}`,
    `  Low: ${summary.bySeverity[IssueSeverity.LOW]}`,
    '',
    '-'.repeat(60),
    'ISSUES BY CATEGORY',
    '-'.repeat(60),
  ];

  for (const [category, count] of Object.entries(summary.byCategory).sort()) {
    lines.push(`  ${category}: ${count}`);
  }

  lines.push('', '-'.repeat(60), 'DETAILED FINDINGS', '-'.repeat(60));

  // Group by severity
  for (const severity of [
    IssueSeverity.CRITICAL,
    IssueSeverity.HIGH,
    IssueSeverity.MEDIUM,
    IssueSeverity.LOW,
  ]) {
    const severityIssues = issues.filter((i) => i.severity === severity);
    if (severityIssues.length > 0) {
      lines.push(`\n[${severity.toUpperCase()}]`);
      for (const issue of severityIssues) {
        lines.push(`  Line ${issue.lineNumber}: ${issue.message}`);
        if (issue.lineContent) {
          lines.push(`    Code: ${issue.lineContent}`);
        }
        if (issue.recommendation) {
          lines.push(`    Fix: ${issue.recommendation}`);
        }
      }
    }
  }

  lines.push('', '='.repeat(60));

  return lines.join('\n');
}
