/**
 * The three-step copy chain (E10): a synchronous clipboard write in the tap
 * handler, execCommand over a selected textarea beneath it, and beneath
 * both, the text selected and visible (press and hold to copy). The visible
 * text is the guarantee; the clipboard is convenience.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { copyNoteText } from './copy-note';

let textarea: HTMLTextAreaElement;

beforeEach(() => {
  textarea = document.createElement('textarea');
  textarea.value = 'my note text';
  document.body.appendChild(textarea);
});

afterEach(() => {
  textarea.remove();
  vi.restoreAllMocks();
});

describe('copyNoteText', () => {
  it('always selects the textarea text (the manual floor)', () => {
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    copyNoteText('my note text', textarea);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe('my note text'.length);
  });

  it('fires the async clipboard write synchronously when available, without awaiting', () => {
    const writeText = vi.fn().mockReturnValue(new Promise(() => {}));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const report = copyNoteText('my note text', textarea);
    expect(writeText).toHaveBeenCalledWith('my note text');
    expect(report.clipboardFired).toBe(true);
  });

  it('a rejecting clipboard write never throws out of the tap handler', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    expect(() => copyNoteText('my note text', textarea)).not.toThrow();
    await Promise.resolve();
  });

  it('attempts execCommand copy over the selection when the API is absent', () => {
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    const exec = vi.fn().mockReturnValue(true);
    (document as any).execCommand = exec;
    const report = copyNoteText('my note text', textarea);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(report.execCommandWorked).toBe(true);
    delete (document as any).execCommand;
  });

  it('survives an execCommand throw and still leaves the selection', () => {
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    (document as any).execCommand = vi.fn().mockImplementation(() => {
      throw new Error('unsupported');
    });
    const report = copyNoteText('my note text', textarea);
    expect(report.execCommandWorked).toBe(false);
    expect(textarea.selectionEnd).toBe('my note text'.length);
    delete (document as any).execCommand;
  });

  it('tolerates a missing textarea (clipboard only)', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const report = copyNoteText('my note text', null);
    expect(report.clipboardFired).toBe(true);
  });
});
