import { useCallback, useEffect, useRef, useState } from 'react';
import { getFormData, saveFormField } from '@/lib/storage';
import { journalRowEdit, clearJournalRow } from '@/lib/edit-journal';
import { useFlushOnHide } from '@/lib/useFlushOnHide';
import { SaveIndicator, type SaveState } from './SaveIndicator';

const SAVE_DEBOUNCE_MS = 300;

export interface PlanFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder?: string;
}

export interface PlanFormProps {
  moduleKey: string;
  formId: string;
  fields: PlanFormField[];
  title: string;
  /** Pass "" to suppress the default hint. */
  subtitle?: string;
  /**
   * Source-fidelity citation. Not rendered. Read by /verify-against-source
   * to trace user-facing labels to a spec in docs/source-specs/ or a PDF
   * in public/toolkit/ or rt-templates/. See .claude/skills/verify-against-source/SKILL.md.
   */
  source?: string;
  page?: string;
}

const DEFAULT_SUBTITLE = 'Fill in what you know. You can always come back.';

/** Auto-resize a textarea to fit its content (JS fallback for browsers without field-sizing). */
function autoResizeTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildHtmlExport(title: string, fields: PlanFormField[], values: Record<string, string>): string {
  const rows = fields
    .map((f) => {
      const raw = values[f.key] ?? '';
      const escaped = escapeHtml(raw);
      const body = raw.trim()
        ? `<div class="value">${escaped.replace(/\n/g, '<br>')}</div>`
        : `<div class="value blank">&nbsp;</div>`;
      return `<section class="field">
        <div class="label">${escapeHtml(f.label)}</div>
        ${body}
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    max-width: 760px; margin: 40px auto; padding: 0 24px;
    color: #111; line-height: 1.5;
  }
  h1 { font-weight: 600; margin: 0 0 24px; font-size: 28px; }
  .field { margin-bottom: 24px; page-break-inside: avoid; }
  .label { font-weight: 500; font-size: 14px; color: #555; margin-bottom: 6px; }
  .value { font-size: 16px; white-space: pre-wrap; padding: 8px 0; border-bottom: 1px solid #ddd; min-height: 1.5em; }
  .value.blank { min-height: 3em; }
  @media print {
    body { margin: 0; padding: 20px; }
    .field { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${rows}
</body>
</html>`;
}

export default function PlanForm({
  moduleKey,
  formId,
  fields,
  title,
  subtitle,
}: PlanFormProps) {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedValuesRef = useRef<Record<string, string>>({});
  const valuesRef = useRef<Record<string, string>>({});
  valuesRef.current = values;

  const resolvedSubtitle = subtitle === undefined ? DEFAULT_SUBTITLE : subtitle;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getFormData(moduleKey, formId);
      if (!cancelled) {
        setValues(data);
        savedValuesRef.current = { ...data };
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [moduleKey, formId]);

  // Auto-resize textareas after load (JS fallback for browsers without CSS field-sizing)
  useEffect(() => {
    if (loading) return;
    const supportsFieldSizing =
      typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');
    if (supportsFieldSizing) return;
    const textareas = containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea');
    textareas?.forEach(autoResizeTextarea);
  }, [loading, values]);

  // Persist a single field: journal synchronously first (the flood-grade
  // backstop), then write to IndexedDB — debounced on typing, immediate on blur.
  const persistField = useCallback(
    (key: string, value: string, immediate: boolean) => {
      const now = new Date().toISOString();
      // Form fields live in the tables store as { value } rows, so they journal
      // exactly like a table row (rowId = field key).
      journalRowEdit({ moduleKey, tableId: formId, rowId: key, data: { value }, updatedAt: now });

      clearTimeout(saveTimerRef.current);
      setSaveState({ status: 'saving' });

      const doSave = async () => {
        try {
          await saveFormField(moduleKey, formId, key, value);
          savedValuesRef.current[key] = value;
          clearJournalRow(moduleKey, formId, key);
          setSaveState({ status: 'saved', at: new Date() });
        } catch (e) {
          setSaveState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Save failed',
          });
        }
      };

      if (immediate) {
        void doSave();
      } else {
        saveTimerRef.current = setTimeout(doSave, SAVE_DEBOUNCE_MS);
      }
    },
    [moduleKey, formId]
  );

  const handleChange = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // Save-on-change (debounced) so a type-then-close without blur is safe.
      persistField(key, value, false);
    },
    [persistField]
  );

  const handleBlur = useCallback(
    (key: string, value: string) => {
      persistField(key, value, true);
    },
    [persistField]
  );

  // Last-resort flush of dirty fields on tab hide/close.
  const flushDirtyOnHide = useCallback(() => {
    clearTimeout(saveTimerRef.current);
    const current = valuesRef.current;
    const saved = savedValuesRef.current;
    for (const key of Object.keys(current)) {
      if (current[key] !== (saved[key] ?? '')) {
        saveFormField(moduleKey, formId, key, current[key]).catch(() => {
          // best-effort on unload; the journal remains the durable record
        });
      }
    }
  }, [moduleKey, formId]);
  useFlushOnHide(flushDirtyOnHide);

  const handleExport = useCallback(() => {
    const html = buildHtmlExport(title, fields, values);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formId}-${todayISO()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [title, fields, values, formId]);

  const filledCount = fields.filter((f) => (values[f.key] ?? '').trim().length > 0).length;

  if (loading) {
    return (
      <div
        aria-busy="true"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          background: 'var(--background)',
        }}
      >
        <div
          style={{
            height: 28,
            width: '40%',
            background: 'var(--muted)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--spacing-md)',
          }}
        />
        <div
          style={{
            height: 80,
            background: 'var(--muted)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rt-planform"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--background)',
      }}
    >
      <style>{`
        .rt-planform { padding: var(--spacing-lg); }
        .rt-planform-header {
          position: sticky; top: 0; z-index: 10;
          background: var(--background);
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--spacing-sm);
          padding-bottom: var(--spacing-sm);
          border-bottom: 1px solid transparent;
        }
        .rt-planform-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--foreground); }
        .rt-planform-subtitle { margin: var(--spacing-xs) 0 0; font-size: 14px; color: var(--muted-foreground); }
        .rt-planform-counter { margin: 6px 0 var(--spacing-lg); font-size: 14px; color: var(--muted-foreground); }
        .rt-planform-legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        .rt-planform-fields { display: flex; flex-direction: column; gap: var(--spacing-md); border: 0; padding: 0; margin: 0; }
        .rt-planform-field { display: flex; flex-direction: column; }
        .rt-planform-label {
          font-family: var(--font-sans, Outfit), sans-serif;
          font-weight: 500; font-size: 14px; color: var(--muted-foreground);
          margin-bottom: var(--spacing-xs);
        }
        .rt-planform-input, .rt-planform-textarea {
          font-family: var(--font-sans, Outfit), sans-serif;
          font-weight: 400; font-size: 16px; color: var(--foreground);
          border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--background);
          width: 100%;
        }
        .rt-planform-input { height: 40px; padding: 0 var(--spacing-sm); min-height: 44px; }
        .rt-planform-textarea {
          padding: var(--spacing-sm); min-height: 80px; max-height: 400px;
          resize: none; overflow-y: auto;
          field-sizing: content;
          background: var(--muted); transition: background 200ms ease-out;
        }
        .rt-planform-textarea:not(:placeholder-shown) { background: var(--background); }
        .rt-planform-input:focus, .rt-planform-textarea:focus {
          outline: 2px solid var(--ring); outline-offset: 2px;
        }
        .rt-planform-export {
          margin-top: var(--spacing-lg);
          background: none; border: 1px solid var(--border);
          color: var(--foreground);
          border-radius: var(--radius-sm);
          padding: 8px 16px; font-size: 14px; font-family: var(--font-sans, Outfit), sans-serif;
          cursor: pointer; min-height: 44px;
        }
        .rt-planform-export:hover { background: var(--muted); }
        @media (max-width: 640px) {
          .rt-planform { padding: var(--spacing-md); }
        }
      `}</style>

      <fieldset className="rt-planform-fields">
        <legend className="rt-planform-legend">{title}</legend>

        <div className="rt-planform-header">
          <h3 className="rt-planform-title">{title}</h3>
          <SaveIndicator state={saveState} />
        </div>
        {resolvedSubtitle && <p className="rt-planform-subtitle">{resolvedSubtitle}</p>}
        <p className="rt-planform-counter">
          {filledCount} of {fields.length} fields completed
        </p>

        {fields.map((field) => {
          const id = `${formId}-${field.key}`;
          const value = values[field.key] ?? '';
          return (
            <div key={field.key} className="rt-planform-field">
              <label htmlFor={id} className="rt-planform-label">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={id}
                  className="rt-planform-textarea"
                  placeholder={field.placeholder ?? ' '}
                  value={value}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onBlur={(e) => handleBlur(field.key, e.target.value)}
                />
              ) : (
                <input
                  id={id}
                  type="text"
                  className="rt-planform-input"
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onBlur={(e) => handleBlur(field.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="rt-planform-export"
          onClick={handleExport}
          aria-label={`Export ${title} as HTML`}
        >
          Export as HTML
        </button>
      </fieldset>
    </div>
  );
}
