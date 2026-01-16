import { TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  showCharacterCount?: boolean;
}

/**
 * TextArea component with optional label, error message, hint, and character count.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      hint,
      showCharacterCount = false,
      maxLength,
      value,
      className = '',
      id: providedId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    const currentLength = typeof value === 'string' ? value.length : 0;

    const baseTextAreaStyles =
      'block w-full rounded-md border px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors resize-y min-h-[100px]';

    const textAreaStyles = error
      ? `${baseTextAreaStyles} border-red-500 focus:border-red-500 focus:ring-red-500`
      : `${baseTextAreaStyles} border-gray-300 focus:border-green-500 focus:ring-green-500`;

    const isNearLimit = maxLength && currentLength >= maxLength * 0.9;

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
        <textarea
          ref={ref}
          id={id}
          value={value}
          maxLength={maxLength}
          className={`${textAreaStyles} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          {...props}
        />
        <div className="flex justify-between items-center mt-1">
          <div>
            {error && (
              <p id={`${id}-error`} className="text-sm text-red-600">
                {error}
              </p>
            )}
            {hint && !error && (
              <p id={`${id}-hint`} className="text-sm text-gray-500">
                {hint}
              </p>
            )}
          </div>
          {showCharacterCount && maxLength && (
            <p
              className={`text-sm ${
                isNearLimit ? 'text-orange-600' : 'text-gray-500'
              }`}
            >
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
