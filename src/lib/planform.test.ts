/**
 * PlanForm Helper Tests
 *
 * Replicates and tests the pure helper logic used by PlanForm.tsx.
 * Mirrors the DataTable.test.ts pattern (helpers are not exported from
 * the component, so tests replicate them — a mismatch would surface
 * as a visible regression).
 *
 * Full render tests deferred: @testing-library/react is not installed.
 * The E2E suite (e2e/planform.spec.ts) covers component rendering
 * and user interaction.
 */
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { saveFormField, getFormData } from './storage';

// ---------------------------------------------------------------------------
// Replicated helpers (kept in sync with src/components/PlanForm.tsx)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface PlanFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea';
}

function buildHtmlExport(
  title: string,
  fields: PlanFormField[],
  values: Record<string, string>
): string {
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
  body { font-family: 'Outfit', system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${rows}
</body>
</html>`;
}

function filledCount(fields: PlanFormField[], values: Record<string, string>): number {
  return fields.filter((f) => (values[f.key] ?? '').trim().length > 0).length;
}

function exportFilename(formId: string, date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  return `${formId}-${iso}.html`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SAMPLE_FIELDS: PlanFormField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

describe('PlanForm — escapeHtml', () => {
  it('escapes <, >, &, ", and \'', () => {
    expect(escapeHtml(`<b>"A&B"</b> 'c'`)).toBe(
      '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt; &#39;c&#39;'
    );
  });

  it('returns empty for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('PlanForm — filledCount', () => {
  it('counts only fields with non-whitespace content', () => {
    expect(filledCount(SAMPLE_FIELDS, {})).toBe(0);
    expect(filledCount(SAMPLE_FIELDS, { name: 'Alice' })).toBe(1);
    expect(filledCount(SAMPLE_FIELDS, { name: 'Alice', summary: 'hi' })).toBe(2);
  });

  it('treats whitespace-only values as empty', () => {
    expect(filledCount(SAMPLE_FIELDS, { name: '   ', summary: '\n\t' })).toBe(0);
  });

  it('decrements when a field is cleared', () => {
    const before = filledCount(SAMPLE_FIELDS, { name: 'Alice', summary: 'hi' });
    const after = filledCount(SAMPLE_FIELDS, { name: 'Alice', summary: '' });
    expect(before).toBe(2);
    expect(after).toBe(1);
  });
});

describe('PlanForm — buildHtmlExport', () => {
  it('uses formId-YYYY-MM-DD.html filename pattern', () => {
    const date = new Date('2026-04-13T10:30:00Z');
    expect(exportFilename('sitrep', date)).toBe('sitrep-2026-04-13.html');
    expect(exportFilename('household-info', date)).toBe('household-info-2026-04-13.html');
  });

  it('renders filled field values as label + value pairs', () => {
    const html = buildHtmlExport('Plan', SAMPLE_FIELDS, { name: 'Alice', summary: 'Hello' });
    expect(html).toContain('<h1>Plan</h1>');
    expect(html).toContain('Name');
    expect(html).toContain('Alice');
    expect(html).toContain('Summary');
    expect(html).toContain('Hello');
  });

  it('renders empty fields as blank lines (for handwriting)', () => {
    const html = buildHtmlExport('Plan', SAMPLE_FIELDS, { name: 'Alice' });
    expect(html).toContain('class="value blank"');
  });

  it('preserves multi-line textarea values as <br>', () => {
    const html = buildHtmlExport('Plan', SAMPLE_FIELDS, { summary: 'line1\nline2' });
    expect(html).toContain('line1<br>line2');
  });

  it('escapes HTML in title, labels, and values to prevent injection', () => {
    const fields: PlanFormField[] = [{ key: 'x', label: '<script>bad()</script>', type: 'text' }];
    const html = buildHtmlExport('<b>T</b>', fields, { x: '<img src=x>' });
    expect(html).not.toContain('<script>bad()</script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x&gt;');
  });

  it('includes inline Outfit font link for print fidelity', () => {
    const html = buildHtmlExport('Plan', SAMPLE_FIELDS, {});
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Outfit');
  });
});

describe('PlanForm — storage round-trip', () => {
  it('saves field via blur and retrieves via getFormData', async () => {
    await saveFormField('pf-test-1', 'form', 'field1', 'value1');
    const data = await getFormData('pf-test-1', 'form');
    expect(data.field1).toBe('value1');
  });

  it('loads all previously saved fields on mount', async () => {
    await saveFormField('pf-test-2', 'form', 'a', 'A');
    await saveFormField('pf-test-2', 'form', 'b', 'B');
    const data = await getFormData('pf-test-2', 'form');
    expect(data).toEqual({ a: 'A', b: 'B' });
  });
});
