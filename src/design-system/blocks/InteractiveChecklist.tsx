import React, { type ReactNode } from 'react';
import ChecklistSection from './ChecklistSection';

interface ChecklistColumn {
  header: string;
  width?: string;
  content: ReactNode;
}

interface InteractiveChecklistProps {
  moduleKey: string;
  sectionId: string;
  columns: ChecklistColumn[];
  sectionHeader?: ReactNode;
  className?: string;
}

/**
 * InteractiveChecklist - Two-column table for organizing Systems and Stuff
 *
 * Part of the Interactive Table design system matching the Resilience Toolkit
 * design profile. Provides a structured way to present checklist items in a
 * table format with:
 *
 * - Two-column layout (typically Systems vs. Stuff)
 * - Responsive: stacks on mobile
 * - Hover states and smooth transitions
 * - Keyboard navigation
 * - Screen reader support
 * - Offline-first storage via IndexedDB
 *
 * @example
 * ```tsx
 * <InteractiveChecklist
 *   moduleKey="emergency-preparedness"
 *   sectionId="emergency-kits"
 *   columns={[
 *     {
 *       header: "Systems",
 *       width: "30%",
 *       content: <p>Description of systems...</p>
 *     },
 *     {
 *       header: "Stuff",
 *       width: "70%",
 *       content: (
 *         <ChecklistSection title="Emergency Kit">
 *           <Todo id="water" moduleKey="emergency-preparedness">
 *             Water and non-perishable food
 *           </Todo>
 *         </ChecklistSection>
 *       )
 *     }
 *   ]}
 * />
 * ```
 */
export default function InteractiveChecklist({
  moduleKey,
  sectionId,
  columns,
  sectionHeader,
  className = '',
}: InteractiveChecklistProps) {
  return (
    <div
      className={`interactive-checklist ${className}`}
      data-module={moduleKey}
      data-section={sectionId}
    >
      <table className="guide-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sectionHeader && (
            <tr>
              <td colSpan={columns.length}>
                <strong>{sectionHeader}</strong>
              </td>
            </tr>
          )}
          <tr>
            {columns.map((column, index) => (
              <td
                key={index}
                data-label={column.header}
                style={{ verticalAlign: 'top' }}
              >
                {column.content}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export { ChecklistSection };
