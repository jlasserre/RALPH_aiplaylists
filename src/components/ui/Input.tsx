import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Input component with optional label, error message, and hint text.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    const baseInputStyles =
      'block w-full rounded-md border px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors';

    const inputStyles = error
      ? `${baseInputStyles} border-red-500 focus:border-red-500 focus:ring-red-500`
      : `${baseInputStyles} border-gray-300 focus:border-green-500 focus:ring-green-500`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`${inputStyles} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1 text-sm text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
