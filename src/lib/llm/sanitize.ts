/**
 * Prompt sanitization utilities for LLM security
 *
 * Protects against prompt injection attacks by:
 * 1. Detecting and stripping system prompt override attempts
 * 2. Removing special instruction markers
 * 3. Logging suspicious patterns for monitoring
 */

/**
 * Patterns that indicate potential prompt injection attempts
 * These are common patterns used to try to override system prompts
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // System prompt override attempts
  { pattern: /\b(system|assistant|user)\s*:/gi, name: 'role-marker' },
  { pattern: /\[INST\]|\[\/INST\]/gi, name: 'llama-instruction' },
  { pattern: /<<SYS>>|<</gi, name: 'llama-system' },
  { pattern: /<\|im_start\|>|<\|im_end\|>/gi, name: 'chatml-marker' },
  { pattern: /Human:|Assistant:/gi, name: 'claude-role' },
  { pattern: /###\s*(Instruction|Response|System)/gi, name: 'alpaca-format' },

  // Instruction override attempts
  { pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi, name: 'ignore-instruction' },
  { pattern: /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi, name: 'disregard-instruction' },
  { pattern: /forget\s+(everything|all)\s+(about|you\s+know)/gi, name: 'forget-instruction' },
  { pattern: /new\s+instructions?\s*:/gi, name: 'new-instruction' },
  { pattern: /override\s+(system|previous|prior)/gi, name: 'override-attempt' },

  // Role play manipulation
  { pattern: /you\s+are\s+(now|no\s+longer)\s+a/gi, name: 'role-change' },
  { pattern: /pretend\s+(to\s+be|you\s+are)/gi, name: 'pretend-role' },
  { pattern: /act\s+as\s+(if\s+you\s+are|a)/gi, name: 'act-as-role' },
  { pattern: /from\s+now\s+on,?\s+you/gi, name: 'from-now-role' },

  // Developer/debug mode attempts
  { pattern: /developer\s+mode/gi, name: 'developer-mode' },
  { pattern: /debug\s+mode/gi, name: 'debug-mode' },
  { pattern: /admin\s+mode/gi, name: 'admin-mode' },
  { pattern: /jailbreak/gi, name: 'jailbreak' },

  // Hidden text techniques
  { pattern: /\u200B|\u200C|\u200D|\uFEFF/g, name: 'zero-width-chars' },
  { pattern: /<!--[\s\S]*?-->/g, name: 'html-comment' },
];

/**
 * Patterns to strip from user input (these are replaced)
 */
const STRIP_PATTERNS: Array<{ pattern: RegExp; replacement: string; name: string }> = [
  // Strip role markers
  { pattern: /\b(system|assistant|user)\s*:\s*/gi, replacement: '', name: 'role-marker' },
  { pattern: /\[INST\]|\[\/INST\]/gi, replacement: '', name: 'llama-instruction' },
  { pattern: /<<SYS>>|<<\/SYS>>/gi, replacement: '', name: 'llama-system' },
  { pattern: /<\|im_start\|>[\s\S]*?<\|im_end\|>/gi, replacement: '', name: 'chatml-block' },
  { pattern: /<\|im_start\|>|<\|im_end\|>/gi, replacement: '', name: 'chatml-marker' },
  { pattern: /Human:|Assistant:/gi, replacement: '', name: 'claude-role' },
  { pattern: /###\s*(Instruction|Response|System)\s*/gi, replacement: '', name: 'alpaca-format' },

  // Strip hidden content
  { pattern: /\u200B|\u200C|\u200D|\uFEFF/g, replacement: '', name: 'zero-width-chars' },
  { pattern: /<!--[\s\S]*?-->/g, replacement: '', name: 'html-comment' },

  // Normalize excessive whitespace (but preserve normal spacing)
  { pattern: /\n{4,}/g, replacement: '\n\n\n', name: 'excessive-newlines' },
  { pattern: /[ \t]{10,}/g, replacement: '    ', name: 'excessive-spaces' },
];

/**
 * Result of sanitization
 */
export interface SanitizeResult {
  /** The sanitized prompt */
  sanitizedPrompt: string;
  /** Whether any suspicious patterns were detected */
  hasSuspiciousContent: boolean;
  /** Names of detected suspicious patterns */
  detectedPatterns: string[];
  /** Names of patterns that were stripped */
  strippedPatterns: string[];
  /** Original prompt (for logging) */
  originalPrompt: string;
}

/**
 * Logger interface for injection attempts
 */
export interface InjectionLogger {
  warn(message: string, data: Record<string, unknown>): void;
}

/**
 * Default logger that logs to console
 */
const defaultLogger: InjectionLogger = {
  warn: (message, data) => {
    console.warn(`[PROMPT_INJECTION] ${message}`, JSON.stringify(data));
  },
};

/**
 * Sanitizes a user prompt to prevent injection attacks
 *
 * @param prompt - The raw user input prompt
 * @param logger - Optional logger for suspicious inputs (defaults to console)
 * @returns SanitizeResult with sanitized prompt and detection info
 */
export function sanitizePrompt(
  prompt: string,
  logger: InjectionLogger = defaultLogger
): SanitizeResult {
  const originalPrompt = prompt;
  let sanitizedPrompt = prompt;
  const detectedPatterns: string[] = [];
  const strippedPatterns: string[] = [];

  // First, detect suspicious patterns (for logging)
  for (const { pattern, name } of INJECTION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(originalPrompt)) {
      detectedPatterns.push(name);
    }
  }

  // Then, strip problematic patterns
  for (const { pattern, replacement, name } of STRIP_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitizedPrompt)) {
      strippedPatterns.push(name);
      // Reset lastIndex again before replacing
      pattern.lastIndex = 0;
      sanitizedPrompt = sanitizedPrompt.replace(pattern, replacement);
    }
  }

  // Trim and normalize
  sanitizedPrompt = sanitizedPrompt.trim();

  const hasSuspiciousContent = detectedPatterns.length > 0;

  // Log if suspicious content was detected
  if (hasSuspiciousContent) {
    logger.warn('Suspicious prompt patterns detected', {
      detectedPatterns,
      strippedPatterns,
      originalLength: originalPrompt.length,
      sanitizedLength: sanitizedPrompt.length,
      // Only log first 200 chars to avoid flooding logs
      promptPreview: originalPrompt.substring(0, 200),
    });
  }

  return {
    sanitizedPrompt,
    hasSuspiciousContent,
    detectedPatterns,
    strippedPatterns,
    originalPrompt,
  };
}

/**
 * Quick check if a prompt contains suspicious content without full sanitization
 * Useful for pre-validation
 */
export function containsSuspiciousContent(prompt: string): boolean {
  for (const { pattern } of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(prompt)) {
      return true;
    }
  }
  return false;
}

/**
 * Wraps user content with clear delimiters to prevent confusion with system prompts
 * This should be used when constructing the final prompt sent to the LLM
 */
export function wrapUserContent(content: string): string {
  // Use unique delimiters that are unlikely to appear in user content
  return `<user_input>\n${content}\n</user_input>`;
}

/**
 * Builds a safe prompt with user content clearly separated from system instructions
 */
export function buildSafePrompt(systemPrompt: string, userContent: string): string {
  const { sanitizedPrompt } = sanitizePrompt(userContent);
  const wrappedContent = wrapUserContent(sanitizedPrompt);

  return `${systemPrompt}\n\nUser's request:\n${wrappedContent}`;
}
