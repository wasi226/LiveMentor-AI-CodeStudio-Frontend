/**
 * Frontend code execution client.
 * Delegates execution to the backend so provider credentials stay off the client.
 */

import { getAuthToken } from '@/lib/authStorage';

const viteEnv = /** @type {any} */ (import.meta)?.env || {};
const API_BASE_URL = resolveApiBaseUrl();

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

function resolveApiBaseUrl() {
  const configured = String(viteEnv.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

  if (configured) {
    return configured;
  }

  const isBrowser = globalThis.window !== undefined;
  const hostname = isBrowser ? globalThis.window.location.hostname : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (viteEnv.DEV || isLocalHost) {
    return 'http://localhost:3001';
  }

  if (isBrowser) {
    // Production fallback for same-origin deployments when env var is missing.
    return globalThis.window.location.origin;
  }

  return '';
}

class CodeExecutionService {
  buildExecutionServiceError(error, language, code, executeEndpoint) {
    const isTimeout = error?.name === 'AbortError';
    const isNetworkError = error instanceof TypeError && /fetch/i.test(String(error?.message || ''));
    const networkErrorMessage = [
      `Execution service network error while calling ${executeEndpoint}.`,
      'Check that VITE_API_BASE_URL points to your deployed backend and that backend CORS allows this frontend origin.'
    ].join(' ');

    let errorMessage = `Execution service error: ${error.message}`;

    if (isTimeout) {
      errorMessage = 'Execution request timed out after 20 seconds. Please check if backend server is running and try again.';
    } else if (isNetworkError) {
      errorMessage = networkErrorMessage;
    }

    return {
      success: false,
      error: errorMessage,
      explanation: this.buildErrorExplanation(error?.message || 'Execution service error', language, code),
      output: '',
      executionTime: 0,
      memory: 0
    };
  }

  extractLineNumbers(errorMessage) {
    const text = String(errorMessage || '');
    const matches = [
      ...text.matchAll(/line\s+(\d+)/gi),
      ...text.matchAll(/:(\d+):(\d+)?/g),
      ...text.matchAll(/\((\d+)\)/g)
    ];

    const lineNumbers = matches
      .map((match) => Number(match[1]))
      .filter((lineNumber) => Number.isFinite(lineNumber) && lineNumber > 0);

    return Array.from(new Set(lineNumbers)).slice(0, 3);
  }

  getLineSnippet(code, lineNumber) {
    const lines = String(code || '').split('\n');
    const content = lines[lineNumber - 1];

    if (!content) {
      return '';
    }

    return `Line ${lineNumber}: ${content.trim()}`;
  }

  buildErrorExplanation(errorMessage, language, code) {
    const normalizedError = String(errorMessage || '').toLowerCase();
    const languageName = LANGUAGE_MAP[language?.toLowerCase?.()] || language || 'this language';
    const lineNumbers = this.extractLineNumbers(errorMessage);
    const lineHints = lineNumbers
      .map((lineNumber) => this.getLineSnippet(code, lineNumber))
      .filter(Boolean);

    const suggestions = [];
    let likelyCause = 'The program failed during compile or execution due to invalid syntax, wrong API usage, or unexpected input handling.';

    if (normalizedError.includes('syntaxerror') || normalizedError.includes('parse') || normalizedError.includes('unexpected token')) {
      likelyCause = 'Your code has a syntax issue, so the compiler/interpreter cannot understand the source.';
      suggestions.push('Check missing brackets, parentheses, commas, or quotes.');
      suggestions.push('Verify indentation and block structure.');
    }

    if (normalizedError.includes('referenceerror') || normalizedError.includes('not defined') || normalizedError.includes('nameerror')) {
      likelyCause = 'You are using a variable/function before declaring it, or the name is misspelled.';
      suggestions.push('Confirm variable and function names exactly match declarations.');
      suggestions.push('Define the variable before first use.');
    }

    if (normalizedError.includes('typeerror') || normalizedError.includes('cannot read') || normalizedError.includes('noneType')) {
      likelyCause = 'A value has an unexpected type (for example null/undefined where an object/string/list is expected).';
      suggestions.push('Add null/undefined checks before property access.');
      suggestions.push('Print/log intermediate values to confirm data types.');
    }

    if (normalizedError.includes('indexerror') || normalizedError.includes('out of range') || normalizedError.includes('outofbounds')) {
      likelyCause = 'Your code is accessing an array/list index outside valid bounds.';
      suggestions.push('Check loop boundaries and index math.');
      suggestions.push('Guard access with length checks.');
    }

    if (normalizedError.includes('time limit exceeded') || normalizedError.includes('timeout')) {
      likelyCause = 'Your algorithm likely has a high time complexity or an infinite loop.';
      suggestions.push('Review loop termination conditions.');
      suggestions.push('Optimize approach (for example use hashing/two-pointers/binary search where applicable).');
    }

    if (suggestions.length === 0) {
      suggestions.push('Read the first error line carefully; it usually points to the root cause.');
      suggestions.push(`Test a minimal ${languageName} example, then add logic incrementally.`);
    }

    const sections = [
      `Likely cause: ${likelyCause}`,
      lineHints.length > 0 ? `Potential line(s):\n${lineHints.join('\n')}` : '',
      `How to fix:\n- ${suggestions.join('\n- ')}`
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  stringifyExecutionValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

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

    const token = getAuthToken();
    const executeEndpoint = `${API_BASE_URL}/api/code/execute`;

    if (!API_BASE_URL) {
      return {
        success: false,
        error: 'Backend API URL is not configured. Set VITE_API_BASE_URL in frontend environment variables.',
        output: '',
        executionTime: 0,
        memory: 0
      };
    }

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
      const controller = new AbortController();
      const timeoutMs = 20000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      console.log('[DEBUG FE] Sending execution request:', {
        url: executeEndpoint,
        language,
        codeLength: code.length,
        hasToken: !!token
      });
      
      const response = await fetch(executeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          language,
          input
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('[DEBUG FE] Response received:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });

      const result = await response.json().catch(() => ({}));

      console.log('[DEBUG FE] Parsed response:', {
        success: result.success,
        hasOutput: !!result.output,
        outputLength: result.output?.length || 0,
        hasError: !!result.error,
        errorLength: result.error?.length || 0,
        status: result.status,
        provider: result.provider
      });

      if (!response.ok) {
        console.log('[DEBUG FE] Response not ok, extracting error message');
        const outputCandidate = result.output ?? result.stdout ?? result.result ?? '';
        const normalizedOutput = this.stringifyExecutionValue(outputCandidate);
        const normalizedError = this.extractErrorMessage(result, `Execution request failed with status ${response.status}.`);
        return {
          success: false,
          error: normalizedError,
          output: normalizedOutput,
          explanation: this.buildErrorExplanation(normalizedError, language, code),
          executionTime: 0,
          memory: 0
        };
      }

      const outputCandidate = result.output ?? result.stdout ?? result.result ?? '';
      const normalizedOutput = this.stringifyExecutionValue(outputCandidate);

      const fallbackMessage = normalizedOutput.trim().length === 0 ? result.message : '';
      const errorCandidate = result.error ?? result.stderr ?? fallbackMessage ?? '';
      const normalizedError = this.stringifyExecutionValue(errorCandidate);

      const hasOutput = normalizedOutput.trim().length > 0;
      const inferredSuccess = typeof result.success === 'boolean'
        ? result.success
        : (hasOutput && normalizedError.trim().length === 0);

      console.log('[DEBUG FE] Processing response:', {
        normalizedOutputLength: normalizedOutput.length,
        normalizedErrorLength: normalizedError.length,
        hasOutput,
        inferredSuccess,
        explicitSuccess: result.success
      });

      return {
        success: inferredSuccess,
        error: inferredSuccess ? '' : normalizedError,
        output: normalizedOutput,
        explanation: inferredSuccess ? '' : this.buildErrorExplanation(normalizedError, language, code),
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
      return this.buildExecutionServiceError(error, language, code, executeEndpoint);
    }
  }

  extractErrorMessage(payload, fallbackMessage) {
    if (Array.isArray(payload?.details)) {
      return payload.details
        .map((detail) => {
          if (typeof detail === 'string') {
            return detail;
          }

          if (detail?.message) {
            return detail.field ? `${detail.field}: ${detail.message}` : detail.message;
          }

          try {
            return JSON.stringify(detail);
          } catch {
            return String(detail);
          }
        })
        .filter(Boolean)
        .join('\n');
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