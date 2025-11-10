import React, { type ReactNode } from 'react';

interface ChecklistSectionProps {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * ChecklistSection - Groups related checklist items with an optional header
 *
 * Part of the Interactive Table design system. Used to organize checklist
 * items into logical sections with titles and descriptions.
 */
export default function ChecklistSection({
  title,
  description,
  children,
  className = '',
}: ChecklistSectionProps) {
  return (
    <div className={`checklist-section ${className}`}>
      {(title || description) && (
        <div className="mb-3">
          {title && (
            <h4
              className="font-semibold text-base mb-1"
              style={{ color: 'var(--table-heading)' }}
            >
              {title}
            </h4>
          )}
          {description && (
            <div
              className="text-sm"
              style={{ color: 'var(--table-text-muted)' }}
            >
              {description}
            </div>
          )}
        </div>
      )}
      <div
        className="flex flex-col"
        style={{ gap: 'var(--table-checklist-gap)' }}
        role="group"
        aria-label={title}
      >
        {children}
      </div>
    </div>
  );
}
