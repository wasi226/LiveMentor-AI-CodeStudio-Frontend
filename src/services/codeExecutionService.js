/**
 * Frontend code execution client.
 * Delegates execution to the backend so provider credentials stay off the client.
 */

/** @type {{ env?: Record<string, string> }} */
const viteMeta = import.meta;
const API_BASE_URL = viteMeta.env?.VITE_API_BASE_URL || 'http://localhost:3001';

const LANGUAGE_MAP = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust'
};

class CodeExecutionService {
  async executeCode(code, language, input = '') {
    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      return {
        success: false,
        error: `Unsupported language: ${language}`,
        output: '',
        executionTime: 0,
        memory: 0
      };
    }

    const token = localStorage.getItem('auth_token');

    if (!token) {
      return {
        success: false,
        error: 'You must be signed in to run code.',
        output: '',
        executionTime: 0,
        memory: 0
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/code/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          language,
          input
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(result, `Execution request failed with status ${response.status}.`),
          output: '',
          executionTime: 0,
          memory: 0
        };
      }

      return {
        success: Boolean(result.success),
        error: result.error || '',
        output: result.output || '',
        executionTime: Number(result.executionTime) || 0,
        memory: Number(result.memoryUsage ?? result.memory) || 0,
        status: result.status || 'completed',
        testResults: result.testResults || [],
        score: result.score ?? null,
        passedTests: result.passedTests ?? null,
        totalTests: result.totalTests ?? null
      };
    } catch (error) {
      console.error('Code execution error:', error);
      return {
        success: false,
        error: `Execution service error: ${error.message}`,
        output: '',
        executionTime: 0,
        memory: 0
      };
    }
  }

  extractErrorMessage(payload, fallbackMessage) {
    if (Array.isArray(payload?.details)) {
      return payload.details.join('\n');
    }

    return payload?.details || payload?.message || payload?.error || fallbackMessage;
  }

  getSupportedLanguages() {
    return Object.keys(LANGUAGE_MAP);
  }

  validateCode(code, language) {
    const warnings = [];
    const errors = [];

    if (!code || code.trim().length === 0) {
      errors.push('Code cannot be empty');
    }

    if (!LANGUAGE_MAP[language.toLowerCase()]) {
      errors.push(`Unsupported language: ${language}`);
    }

    const dangerousPatterns = {
      javascript: [
        /require\s*\(\s*['"`]fs['"`]\s*\)/,
        /require\s*\(\s*['"`]child_process['"`]\s*\)/,
        /import.*from\s*['"`]fs['"`]/,
        /eval\s*\(/,
        /Function\s*\(/
      ],
      python: [
        /import\s+os/,
        /import\s+subprocess/,
        /import\s+sys/,
        /exec\s*\(/,
        /eval\s*\(/,
        /__import__\s*\(/
      ],
      java: [
        /Runtime\.getRuntime\(\)/,
        /ProcessBuilder/,
        /System\.exit/,
        /File\s*\(/,
        /FileWriter/
      ]
    };

    const patterns = dangerousPatterns[language.toLowerCase()] || [];

    patterns.forEach(pattern => {
      if (pattern.test(code)) {
        warnings.push(`Potentially unsafe code pattern detected: ${pattern.source}`);
      }
    });

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }
}

export default new CodeExecutionService();