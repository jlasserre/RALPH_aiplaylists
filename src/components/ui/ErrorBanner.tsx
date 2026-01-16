'use client';

import { useCallback } from 'react';

/** Types of errors that can be displayed */
export type ErrorType = 'auth' | 'rate-limit' | 'llm' | 'spotify' | 'network' | 'generic';

export interface ErrorBannerProps {
  /** The error message to display */
  message: string;
  /** The type of error for specialized messaging */
  type?: ErrorType;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Additional details to show (expandable) */
  details?: string;
  /** Retry-After value in seconds for rate limiting */
  retryAfter?: number;
}

/**
 * Get the appropriate icon for each error type
 */
function getErrorIcon(type: ErrorType) {
  switch (type) {
    case 'auth':
      // Lock icon for auth errors
      return (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      );
    case 'rate-limit':
      // Clock icon for rate limiting
      return (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      );
    case 'network':
      // Wifi-off icon for network errors
      return (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
        />
      );
    default:
      // Exclamation triangle for generic errors
      return (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      );
  }
}

/**
 * Get supplemental message for each error type
 */
function getSupplementalMessage(type: ErrorType, retryAfter?: number): string | null {
  switch (type) {
    case 'auth':
      return 'Please log in again to continue.';
    case 'rate-limit':
      if (retryAfter) {
        return `Please wait ${retryAfter} seconds before trying again.`;
      }
      return 'Too many requests. Please wait a moment before trying again.';
    case 'llm':
      return 'The AI service encountered an issue. Try again or use a different provider.';
    case 'spotify':
      return 'There was a problem communicating with Spotify.';
    case 'network':
      return 'Check your internet connection and try again.';
    default:
      return null;
  }
}

/**
 * Get the retry button label for each error type
 */
function getRetryLabel(type: ErrorType): string {
  switch (type) {
    case 'auth':
      return 'Log In';
    case 'rate-limit':
      return 'Try Again';
    default:
      return 'Retry';
  }
}

/**
 * ErrorBanner component displays error messages with optional retry functionality.
 * Supports different error types with specialized icons and messages.
 */
export function ErrorBanner({
  message,
  type = 'generic',
  onRetry,
  onDismiss,
  details,
  retryAfter,
}: ErrorBannerProps) {
  const handleRetry = useCallback(() => {
    onRetry?.();
  }, [onRetry]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const supplementalMessage = getSupplementalMessage(type, retryAfter);
  const retryLabel = getRetryLabel(type);
  const isRecoverable = type !== 'auth' || onRetry;

  return (
    <div
      className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800"
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Error icon */}
        <svg
          className="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          {getErrorIcon(type)}
        </svg>

        {/* Error content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{message}</p>
          {supplementalMessage && (
            <p className="mt-1 text-sm text-red-700">{supplementalMessage}</p>
          )}
          {details && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer hover:text-red-700">
                Technical details
              </summary>
              <pre className="mt-1 text-xs text-red-600 bg-red-100 p-2 rounded overflow-x-auto">
                {details}
              </pre>
            </details>
          )}

          {/* Action buttons */}
          {(isRecoverable || onDismiss) && (
            <div className="mt-3 flex gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  {retryLabel}
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>

        {/* Close button (if dismissible but no explicit dismiss button) */}
        {onDismiss && !isRecoverable && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors"
            aria-label="Dismiss error"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
