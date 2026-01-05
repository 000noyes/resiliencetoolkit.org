import { useEffect, useRef } from 'react';

/**
 * Custom hook for auto-resizing textarea based on content
 *
 * @param value - The current textarea value (triggers resize on change)
 * @param minRows - Minimum number of visible rows (default: 3)
 * @returns ref - Ref to attach to the textarea element
 *
 * @example
 * const textareaRef = useAutoResizeTextarea(value, 3);
 * <textarea ref={textareaRef} value={value} />
 */
export function useAutoResizeTextarea(value: string, minRows: number = 3) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to 'auto' to allow shrinking when content is deleted
    textarea.style.height = 'auto';

    // Calculate the actual content height
    const scrollHeight = textarea.scrollHeight;

    // Calculate minimum height based on line-height and rows
    const styles = window.getComputedStyle(textarea);
    const lineHeight = parseInt(styles.lineHeight);
    const paddingTop = parseInt(styles.paddingTop);
    const paddingBottom = parseInt(styles.paddingBottom);
    const minHeight = (lineHeight * minRows) + paddingTop + paddingBottom;

    // Set height to the larger of content height or minimum height
    textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
  }, [value, minRows]); // Re-run when value or minRows changes

  return textareaRef;
}
