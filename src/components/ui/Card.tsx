import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
}

/**
 * Card component with optional header section.
 * The header appears above the main content with a subtle border separator.
 */
export function Card({
  header,
  headerClassName = '',
  bodyClassName = '',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {header && (
        <div
          className={`px-4 py-3 border-b border-gray-200 bg-gray-50 ${headerClassName}`}
        >
          {header}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
