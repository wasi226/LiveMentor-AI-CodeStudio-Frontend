/**
 * Secure Code Execution Service
 * Uses Judge0 CE API for safe sandboxed code execution
 * Supports multiple programming languages with proper security
 */

const JUDGE0_API_URL = 'https://judge0-ce.p.rapidapi.com';
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || 'your-rapidapi-key';

// Language ID mapping for Judge0 API
const LANGUAGE_MAP = {
  javascript: 63,  // Node.js
  python: 71,      // Python 3.8.1
  java: 62,        // Java (OpenJDK 13.0.1)
  cpp: 54,         // C++ (GCC 9.2.0)
  typescript: 74,  // TypeScript 3.7.4
  go: 60,          // Go 1.13.5
  rust: 73,        // Rust 1.40.0
  c: 50,           // C (GCC 9.2.0)
};

class CodeExecutionService {
  constructor() {
    this.apiKey = RAPIDAPI_KEY;
  }

  /**
   * Execute code safely in Judge0 sandbox
   * @param {string} code - Code to execute
   * @param {string} language - Programming language
   * @param {string} input - Optional stdin input
   * @returns {Promise<Object>} Execution result
   */
  async executeCode(code, language, input = '') {
    const languageId = LANGUAGE_MAP[language.toLowerCase()];
    
    if (!languageId) {
      return {
        success: false,
        error: `Unsupported language: ${language}`,
        output: '',
        executionTime: 0,
        memory: 0
      };
    }

    try {
      // Submit code for execution
      const submissionResponse = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        },
        body: JSON.stringify({
          source_code: code,
          language_id: languageId,
          stdin: input,
          expected_output: null
        })
      });

      if (!submissionResponse.ok) {
        throw new Error(`HTTP error! status: ${submissionResponse.status}`);
      }

      const result = await submissionResponse.json();
      
      return this.formatResult(result);
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

  /**
   * Format execution result for frontend consumption
   * @param {Object} judgeResult - Raw Judge0 result
   * @returns {Object} Formatted result
   */
  formatResult(judgeResult) {
    const { status, stdout, stderr, compile_output, time, memory } = judgeResult;
    
    // Status codes: https://github.com/judge0/judge0/blob/master/CHANGELOG.md
    const isSuccess = status.id === 3; // Accepted
    
    let output = '';
    let error = '';
    
    if (stdout) output += atob(stdout); // Base64 decode if needed
    
    if (stderr) error += atob(stderr);
    if (compile_output) error += atob(compile_output);
    
    // Handle different status codes
    switch (status.id) {
      case 1: // In Queue
      case 2: // Processing
        return { success: false, error: 'Code is still processing...', output: '', executionTime: 0, memory: 0 };
      
      case 3: // Accepted
        return {
          success: true,
          error: '',
          output: output || 'Program executed successfully (no output)',
          executionTime: parseFloat(time) || 0,
          memory: parseInt(memory) || 0
        };
      
      case 4: // Wrong Answer
        return { success: false, error: 'Wrong Answer', output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 5: // Time Limit Exceeded
        return { success: false, error: 'Time Limit Exceeded (>2s)', output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 6: // Compilation Error
        return { success: false, error: `Compilation Error:\n${error}`, output: '', executionTime: 0, memory: 0 };
      
      case 7: // Runtime Error (SIGSEGV)
        return { success: false, error: `Runtime Error (Segmentation Fault):\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 8: // Runtime Error (SIGXFSZ)
        return { success: false, error: `Runtime Error (Output size limit exceeded):\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 9: // Runtime Error (SIGFPE)
        return { success: false, error: `Runtime Error (Floating point exception):\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 10: // Runtime Error (SIGABRT)
        return { success: false, error: `Runtime Error (Aborted):\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 11: // Runtime Error (NZEC)
        return { success: false, error: `Runtime Error (Non-zero exit code):\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 12: // Runtime Error (Other)
        return { success: false, error: `Runtime Error:\n${error}`, output, executionTime: parseFloat(time) || 0, memory: parseInt(memory) || 0 };
      
      case 13: // Internal Error
        return { success: false, error: 'Internal execution service error', output: '', executionTime: 0, memory: 0 };
      
      case 14: // Exec Format Error
        return { success: false, error: 'Executable format error', output: '', executionTime: 0, memory: 0 };
      
      default:
        return {
          success: false,
          error: `Unknown execution status: ${status.description || status.id}`,
          output,
          executionTime: parseFloat(time) || 0,
          memory: parseInt(memory) || 0
        };
    }
  }

  /**
   * Get supported languages
   * @returns {Array} List of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(LANGUAGE_MAP);
  }

  /**
   * Validate code for potential security issues (basic checks)
   * @param {string} code - Code to validate
   * @param {string} language - Programming language
   * @returns {Object} Validation result
   */
  validateCode(code, language) {
    const warnings = [];
    const errors = [];
    
    // Basic security checks
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

// Fallback execution service for when Judge0 is unavailable
class FallbackExecutionService {
  async executeCode(code, language) {
    // Simple syntax validation and mock execution for development
    return {
      success: true,
      error: '',
      output: `[Mock] Code executed successfully!\n\nLanguage: ${language}\nCode length: ${code.length} characters\n\nNote: Using fallback execution service. Configure Judge0 API for real execution.`,
      executionTime: Math.random() * 500, // Mock execution time
      memory: Math.floor(Math.random() * 1024 * 1024) // Mock memory usage
    };
  }

  validateCode(code, language) {
    return { isValid: true, warnings: [], errors: [] };
  }

  getSupportedLanguages() {
    return Object.keys(LANGUAGE_MAP);
  }
}

// Export singleton instance
const codeExecutionService = RAPIDAPI_KEY && RAPIDAPI_KEY !== 'your-rapidapi-key' 
  ? new CodeExecutionService()
  : new FallbackExecutionService();

export default codeExecutionService;