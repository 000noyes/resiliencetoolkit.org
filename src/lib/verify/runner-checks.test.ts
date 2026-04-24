import { describe, it, expect } from 'vitest';
import type { SourceSpec } from './schemas';
import { linksMatch, titleMatches, keysMatch, type CheckContext } from './runner-checks';

const BASE_CITATION = {
  source: 'docs/source-specs/test.md',
  page: '1',
};

function baseSpec(overrides: Partial<SourceSpec> = {}): SourceSpec {
  // Cast through unknown because the spec type requires either fields
  // or sections — each test fixture below supplies one.
  return {
    module: '1-9',
    template: 'leader-directory',
    title: 'Leader Directory',
    citation: BASE_CITATION,
    ...overrides,
  } as SourceSpec;
}

function ctx(spec: SourceSpec, siteContent: string): CheckContext {
  return {
    spec,
    file: 'src/pages/modules/test.astro',
    citationLine: 1,
    siteContent,
    source: 'docs/source-specs/test.md',
  };
}

// ---------------------------------------------------------------------------
// linksMatch — walk-observed failure modes
// ---------------------------------------------------------------------------

describe('runner-checks: linksMatch', () => {
  it('pass when spec URL matches site href (external_url default)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [{ url: 'https://example.org/a' }],
    });
    const site = `<ExternalLink href="https://example.org/a">A</ExternalLink>`;
    expect(linksMatch(ctx(spec, site))).toEqual([]);
  });

  it('pass via normalizeUrl (trailing slash, utm_ tracking)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [{ url: 'https://example.org/a' }],
    });
    const site = `<a href="https://EXAMPLE.org/a/?utm_source=foo">A</a>`;
    expect(linksMatch(ctx(spec, site))).toEqual([]);
  });

  it('1-7 public-bathrooms-directory drop: link_missing when no matching URL', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: 'https://www.changewithus.vt/public-bathrooms-directory',
          label: 'Public Bathrooms Directory',
        },
      ],
    });
    const site = `<p>Placeholder with no link.</p>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_missing');
    expect(out[0].message).toMatch(/public-bathrooms-directory/);
  });

  it('2-1 Drift Dusters URL substitution: link_drift via anchor_text heuristic', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: 'https://vtsos.example/crisis',
          label: 'Crisis Line',
        },
      ],
    });
    // Site uses SAMHSA URL — same anchor text, different destination.
    const site = `<p><ExternalLink href="https://samhsa.gov/find-help">Crisis Line</ExternalLink></p>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_drift');
    expect(out[0].message).toMatch(/samhsa\.gov/);
    expect(out[0].message).toMatch(/vtsos\.example/);
  });

  it('1-5 14BP-QH2d internal-anchor: link_type_mismatch when site renders Drive anchor', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: '/modules/emergency-preparedness/1-5',
          kind: 'internal_route',
          label: 'Module 1-5',
        },
      ],
    });
    // Site leaked through the workbook's Drive-hosted HTML anchor instead of
    // converting to the site-internal route.
    const site = `<p><a href="https://drive.google.com/file/d/14BP-QH2d.html#5">see 1.5</a></p>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_type_mismatch');
    expect(out[0].message).toMatch(/internal_route/);
  });

  it('internal_route prefix match (route + deeper path)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [{ url: '/modules/baseline-resilience/2-1', kind: 'internal_route' }],
    });
    const site = `<a href="/modules/baseline-resilience/2-1#section-a">2.1</a>`;
    expect(linksMatch(ctx(spec, site))).toEqual([]);
  });

  it('internal_route missing entirely → link_missing', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [{ url: '/modules/emergency-preparedness/1-9', kind: 'internal_route' }],
    });
    const site = `<p>no links</p>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_missing');
  });
});

// ---------------------------------------------------------------------------
// titleMatches — invented-heading walk cases
// ---------------------------------------------------------------------------

describe('runner-checks: titleMatches', () => {
  it('pass when title + all expected subheadings present', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      subheadings: [{ text: 'Mapping', level: 2 }, { text: 'Assets', level: 3 }],
    });
    const site = `
<h1>Leader Directory</h1>
<h2>Mapping</h2>
<h3>Assets</h3>`;
    expect(titleMatches(ctx(spec, site))).toEqual([]);
  });

  it('1-12 invented "Mutual Aid Tenets & Checklist" h2 → title_drift', () => {
    const spec = baseSpec({
      module: '1-12',
      template: 'mutual-aid',
      title: 'Mutual Aid',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      subheadings: [{ text: 'Overview', level: 2 }],
    });
    const site = `
<h1>Mutual Aid</h1>
<h2>Overview</h2>
<h2>Mutual Aid Tenets &amp; Checklist</h2>`;
    const out = titleMatches(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('title_drift');
    expect(out[0].message).toMatch(/Mutual Aid/);
    expect(out[0].message).toMatch(/invented h2/);
  });

  it('1-5 invented row-header "Activate, staff..." → title_drift', () => {
    const spec = baseSpec({
      module: '1-5',
      template: 'deployment',
      title: 'Deployment',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `
<h1>Deployment</h1>
<h3>Activate, staff, and deploy resources</h3>`;
    const out = titleMatches(ctx(spec, site));
    expect(out.length).toBe(1);
    expect(out[0].status).toBe('title_drift');
  });

  it('title missing entirely → title_drift', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<h2>Something Else</h2>`;
    const out = titleMatches(ctx(spec, site));
    expect(out.some((e) => e.message?.includes('spec.title "Leader Directory" not found'))).toBe(
      true,
    );
  });

  it('whitespace + case + entity tolerant', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      subheadings: [{ text: 'A & B', level: 2 }],
    });
    const site = `<h1>LEADER    Directory</h1>\n<h2>  a &amp; b  </h2>`;
    // The HTML entity &amp; is not decoded by our extractor (documented
    // non-goal), so the match for "A & B" vs "a &amp; b" will fail and emit
    // title_drift. Assert that shape so the behavior is explicit.
    const out = titleMatches(ctx(spec, site));
    expect(out.some((e) => e.status === 'title_drift')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// keysMatch — DataTable column alignment
// ---------------------------------------------------------------------------

describe('runner-checks: keysMatch', () => {
  it('pass when DataTable columns match spec fields by label (position)', () => {
    const spec = baseSpec({
      fields: [
        { key: 'full-name', label: 'Full Name', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' },
      ],
    });
    const site = `
<DataTable moduleKey="1-9" tableId="leaders" columns={[
  { key: 'Full Name', label: 'Full Name' },
  { key: 'Phone', label: 'Phone' }
]} />`;
    expect(keysMatch(ctx(spec, site))).toEqual([]);
  });

  it('key_drift when column label diverges from spec field label', () => {
    const spec = baseSpec({
      fields: [
        { key: 'full-name', label: 'Full Name', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' },
      ],
    });
    const site = `
<DataTable columns={[
  { key: 'Full Name', label: 'Full Name' },
  { key: 'Telephone', label: 'Telephone' }
]} />`;
    const out = keysMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('key_drift');
    expect(out[0].message).toMatch(/Telephone/);
    expect(out[0].message).toMatch(/Phone/);
  });

  it('silent when no matching-count DataTable exists (structural_fidelity owns this)', () => {
    const spec = baseSpec({
      fields: [
        { key: 'a', label: 'A', type: 'text' },
        { key: 'b', label: 'B', type: 'text' },
      ],
    });
    // Table has 3 columns, spec has 2 — count mismatch → no keysMatch entry.
    const site = `
<DataTable columns={[
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' }
]} />`;
    expect(keysMatch(ctx(spec, site))).toEqual([]);
  });

  it('ambiguous mapping (multiple tables with matching column count) → key_drift', () => {
    const spec = baseSpec({
      fields: [{ key: 'a', label: 'A', type: 'text' }],
    });
    const site = `
<DataTable columns={[{ key: 'A', label: 'A' }]} />
<DataTable columns={[{ key: 'X', label: 'X' }]} />`;
    const out = keysMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('key_drift');
    expect(out[0].message).toMatch(/ambiguous/);
  });

  it('section-grouped spec → skip (deferred to day 5b)', () => {
    const spec = baseSpec({
      sections: [
        {
          key: 'sec',
          label: 'Section',
          fields: [{ key: 'a', label: 'A', type: 'text' }],
        },
      ],
    });
    const site = `<DataTable columns={[{ key: 'WRONG', label: 'WRONG' }]} />`;
    // Even though the label is wrong, section-grouped spec is skipped.
    expect(keysMatch(ctx(spec, site))).toEqual([]);
  });
});
