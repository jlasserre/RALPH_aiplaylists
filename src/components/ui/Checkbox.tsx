import { InputHTMLAttributes, forwardRef, useId } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

/**
 * Checkbox component with required label and optional description.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id: providedId, ...props }, ref) => {
    const generatedId = useId();
    const id = providedId || generatedId;

    return (
      <div className={`flex items-start ${className}`}>
        <div className="flex items-center h-5">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-2 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            aria-describedby={description ? `${id}-description` : undefined}
            {...props}
          />
        </div>
        <div className="ml-3">
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p id={`${id}-description`} className="text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
