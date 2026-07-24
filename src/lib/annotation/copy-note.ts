/**
 * The three-step copy chain (E10). MUST be called synchronously inside the
 * tap handler: Safari expires the user gesture across any await, and Android
 * in-app browsers may lack or deny the async clipboard API entirely.
 *
 * Order of guarantees, strongest last:
 * 1. clipboard.writeText fired synchronously (result ignored; rejection
 *    swallowed) — the convenience path.
 * 2. execCommand('copy') over the selected textarea — the legacy path that
 *    still works where the API is denied.
 * 3. The text left SELECTED and visible in the textarea — press and hold to
 *    copy. The visible text is the guarantee; the clipboard is convenience.
 */

export interface CopyReport {
  selected: boolean;
  clipboardFired: boolean;
  execCommandWorked: boolean;
}

export function copyNoteText(text: string, textarea: HTMLTextAreaElement | null): CopyReport {
  const report: CopyReport = { selected: false, clipboardFired: false, execCommandWorked: false };

  if (textarea) {
    try {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      report.selected = true;
    } catch {
      /* selection is best-effort */
    }
  }

  try {
    const doc = document as Document & { execCommand?: (command: string) => boolean };
    if (report.selected && typeof doc.execCommand === 'function') {
      report.execCommandWorked = doc.execCommand('copy') === true;
    }
  } catch {
    report.execCommandWorked = false;
  }

  try {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clipboard && typeof clipboard.writeText === 'function') {
      const pending = clipboard.writeText(text);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      report.clipboardFired = true;
    }
  } catch {
    /* never throw out of the tap handler */
  }

  return report;
}
