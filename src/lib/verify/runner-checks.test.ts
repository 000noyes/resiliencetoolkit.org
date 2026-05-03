import { describe, it, expect } from 'vitest';
import { moduleDownloads } from '@/data/downloads';
import type { SourceSpec } from './schemas';
import {
  linksMatch,
  titleMatches,
  keysMatch,
  structuralFidelityMatches,
  proseMatches,
  type CheckContext,
} from './runner-checks';

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

function ctx(
  spec: SourceSpec,
  siteContent: string,
  extractedText?: string,
): CheckContext {
  const c: CheckContext = {
    spec,
    file: 'src/pages/modules/test.astro',
    citationLine: 1,
    siteContent,
    source: 'docs/source-specs/test.md',
  };
  if (extractedText !== undefined) c.extractedText = extractedText;
  return c;
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

  it('passes when spec URL is rendered by ModuleLayout resources button', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: 'https://drive.google.com/drive/folders/1HI-sf3QQdYHHr7g3w4OCi1zFTQ6HBMkH',
        },
      ],
    });
    const site = `
const sectionData: SectionData = {
  number: "1.3",
  title: "First aid and medical",
};
---
<ModuleLayout sectionData={sectionData}>
  <p>No inline resources link here.</p>
</ModuleLayout>`;
    expect(linksMatch(ctx(spec, site))).toEqual([]);
  });

  it('does not exempt a different Drive folder for the same section', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: 'https://drive.google.com/drive/folders/not-the-1-3-resources-folder',
        },
      ],
    });
    const site = `
const sectionData: SectionData = {
  number: "1.3",
  title: "First aid and medical",
};
---
<ModuleLayout sectionData={sectionData}>
  <p>No inline resources link here.</p>
</ModuleLayout>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_missing');
  });

  it('does not exempt resources URLs when the page has no sectionData', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      links: [
        {
          url: 'https://drive.google.com/drive/folders/1HI-sf3QQdYHHr7g3w4OCi1zFTQ6HBMkH',
        },
      ],
    });
    const site = `<ModuleLayout><p>No section data here.</p></ModuleLayout>`;
    const out = linksMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('link_missing');
  });

  it('does not exempt sections with no resourcesUrl', () => {
    moduleDownloads.push({
      number: '9.9',
      name: 'No resources test module',
      section: 'Section 9',
      onlineUrl: '/modules/test/9-9',
      pdfFilename: 'Section 9.9.pdf',
    });
    try {
      const spec = baseSpec({
        fields: [{ key: 'x', label: 'X', type: 'text' }],
        links: [{ url: 'https://drive.google.com/drive/folders/missing-resources' }],
      });
      const site = `
const sectionData: SectionData = {
  number: "9.9",
  title: "No resources test module",
};
---
<ModuleLayout sectionData={sectionData}>
  <p>No inline resources link here.</p>
</ModuleLayout>`;
      const out = linksMatch(ctx(spec, site));
      expect(out).toHaveLength(1);
      expect(out[0].status).toBe('link_missing');
    } finally {
      moduleDownloads.pop();
    }
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

  // ---------------------------------------------------------------------------
  // keysMatch — tableId disambiguation (day-15-i, decision i)
  // ---------------------------------------------------------------------------

  it('tableId disambiguation: two same-column tables, two specs with distinct tableId → both pass', () => {
    const site = `
<DataTable moduleKey="1-9" tableId="leader-directory" columns={[
  { key: 'title-role', label: 'Title/Role' },
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' }
]} />
<DataTable moduleKey="1-9" tableId="neighbor-directory" columns={[
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' }
]} />`;
    const leaderSpec = baseSpec({
      template: 'leader-directory',
      tableId: 'leader-directory',
      fields: [
        { key: 'title-role', label: 'Title/Role', type: 'text' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'email', label: 'Email', type: 'email' },
      ],
    });
    const neighborSpec = baseSpec({
      template: 'neighbor-directory',
      title: 'Neighbor Directory',
      tableId: 'neighbor-directory',
      fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'address', label: 'Address', type: 'text' },
      ],
    });
    expect(keysMatch(ctx(leaderSpec, site))).toEqual([]);
    expect(keysMatch(ctx(neighborSpec, site))).toEqual([]);
  });

  it('tableId disambiguation: spec.tableId has no matching DataTable → key_drift', () => {
    const spec = baseSpec({
      tableId: 'renamed-or-removed',
      fields: [{ key: 'a', label: 'A', type: 'text' }],
    });
    const site = `<DataTable tableId="something-else" columns={[{ key: 'A', label: 'A' }]} />`;
    const out = keysMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('key_drift');
    expect(out[0].message).toMatch(/tableId.*renamed-or-removed/);
    expect(out[0].message).toMatch(/no matching DataTable/);
  });

  it('tableId firewall: spec.tableId set + zero DataTables in file → key_drift (codex P2 fix)', () => {
    // Codex review on day-15-i flagged that the `tables.length === 0`
    // short-circuit silently passed when a tableId-bearing spec's file had
    // every DataTable removed — undermining the rename/removal guard the
    // schema contract is supposed to provide. This test pins the fix:
    // when spec.tableId is set, an empty file MUST emit key_drift.
    const spec = baseSpec({
      tableId: 'leader-directory',
      fields: [
        { key: 'title-role', label: 'Title/Role', type: 'text' },
        { key: 'name', label: 'Name', type: 'text' },
      ],
    });
    const site = `<p>This page has no DataTable at all.</p>`;
    const out = keysMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('key_drift');
    expect(out[0].message).toMatch(/tableId.*leader-directory/);
    expect(out[0].message).toMatch(/no matching DataTable/);
  });

  it('column-count fallback (no tableId) preserves silent behavior on empty files', () => {
    // Back-compat: the 5 shipped specs without tableId may target PlanForm-
    // bearing files, where keysMatch should stay silent rather than fire
    // false positives. The fix above only changes the tableId-set branch.
    const spec = baseSpec({
      fields: [{ key: 'a', label: 'A', type: 'text' }],
    });
    const site = `<p>No DataTable here either, but spec has no tableId.</p>`;
    expect(keysMatch(ctx(spec, site))).toEqual([]);
  });

  it('tableId disambiguation: column count mismatch on the matched table → key_drift', () => {
    const spec = baseSpec({
      tableId: 'leader-directory',
      fields: [
        { key: 'a', label: 'A', type: 'text' },
        { key: 'b', label: 'B', type: 'text' },
      ],
    });
    const site = `
<DataTable tableId="leader-directory" columns={[
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' }
]} />`;
    const out = keysMatch(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('key_drift');
    expect(out[0].message).toMatch(/3 columns/);
    expect(out[0].message).toMatch(/2 fields/);
  });

  it('tableId disambiguation: column labels validated against the matched table only', () => {
    const spec = baseSpec({
      tableId: 'leader-directory',
      fields: [
        { key: 'title-role', label: 'Title/Role', type: 'text' },
        { key: 'name', label: 'Name', type: 'text' },
      ],
    });
    // Two 2-column tables; without tableId they would emit ambiguous key_drift.
    // With tableId, only the matched table's labels are checked — the
    // mismatched neighbor table is ignored entirely.
    const site = `
<DataTable tableId="leader-directory" columns={[
  { key: 'title-role', label: 'Title/Role' },
  { key: 'name', label: 'Name' }
]} />
<DataTable tableId="neighbor-directory" columns={[
  { key: 'WRONG-A', label: 'WRONG-A' },
  { key: 'WRONG-B', label: 'WRONG-B' }
]} />`;
    expect(keysMatch(ctx(spec, site))).toEqual([]);
  });

  it('back-compat: spec without tableId falls back to column-count-only matching', () => {
    // Same fixture as the original keysMatch pass test — confirms 5 shipped
    // specs (1-2 / 1-3 / 1-4 / 1-5 / 1-9 first-responder by 5-col uniqueness)
    // continue to verify against site DataTables that may carry tableId
    // props without the spec needing to declare one.
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

// ---------------------------------------------------------------------------
// structuralFidelityMatches — table_count walk cases
// ---------------------------------------------------------------------------

describe('runner-checks: structuralFidelityMatches', () => {
  it('silent when spec.structural_fidelity is absent', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<DataTable columns={[{ key: 'X', label: 'X' }]} />`;
    expect(structuralFidelityMatches(ctx(spec, site))).toEqual([]);
  });

  it('pass when DataTable count matches spec table_count', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_fidelity: { table_count: 1 },
    });
    const site = `<DataTable columns={[{ key: 'X', label: 'X' }]} />`;
    expect(structuralFidelityMatches(ctx(spec, site))).toEqual([]);
  });

  it('1-8 Seniors+Disabilities split: 1 workbook table rendered as 2 site DataTables → structural_fidelity_failed', () => {
    const spec = baseSpec({
      module: '1-8',
      template: 'populations-specific-needs',
      title: 'Populations with Specific Needs',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_fidelity: {
        table_count: 1,
        description: 'Workbook has a single Seniors+Disabilities planning table',
      },
    });
    const site = `
<DataTable moduleKey="1-8" tableId="seniors" columns={[{ key: 'A', label: 'A' }]} />
<DataTable moduleKey="1-8" tableId="disabilities" columns={[{ key: 'B', label: 'B' }]} />`;
    const out = structuralFidelityMatches(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_fidelity_failed');
    expect(out[0].message).toMatch(/table_count=1/);
    expect(out[0].message).toMatch(/2 data-bearing/);
    expect(out[0].message).toMatch(/Seniors\+Disabilities/);
  });

  it('PlanForm counts toward structural fidelity (DataTable + PlanForm sum)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_fidelity: { table_count: 2 },
    });
    const site = `
<DataTable columns={[{ key: 'X', label: 'X' }]} />
<PlanForm moduleKey="m" formId="f" fields={planFields} title="T" />`;
    expect(structuralFidelityMatches(ctx(spec, site))).toEqual([]);
  });

  it('zero components when spec expects N → structural_fidelity_failed', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      structural_fidelity: { table_count: 1 },
    });
    const site = `<p>No tables here.</p>`;
    const out = structuralFidelityMatches(ctx(spec, site));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('structural_fidelity_failed');
    expect(out[0].message).toMatch(/0 data-bearing/);
  });
});

// ---------------------------------------------------------------------------
// proseMatches — paragraph grounding (precision-first)
// ---------------------------------------------------------------------------

describe('runner-checks: proseMatches', () => {
  it('silent when extractedText is absent', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<p>This is a site paragraph that has no source text to check against.</p>`;
    expect(proseMatches(ctx(spec, site))).toEqual([]);
  });

  it('silent when the site has no prose', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<h1>Title</h1>`;
    expect(proseMatches(ctx(spec, site, 'workbook text here'))).toEqual([]);
  });

  it('pass when a site paragraph is present verbatim in the extracted text', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<p>Create a directory of local first responders, paid and volunteer.</p>`;
    const extracted = `Directory of Local Leaders
Create a directory of local first responders, paid and volunteer.
Emergency Service Name/Person   Function/Skill`;
    expect(proseMatches(ctx(spec, site, extracted))).toEqual([]);
  });

  it('tolerates whitespace / case / punctuation variation via normalizeLabel', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<p>  Create a DIRECTORY, of local first responders!  </p>`;
    const extracted = `Create a directory of local first responders paid and volunteer.`;
    expect(proseMatches(ctx(spec, site, extracted))).toEqual([]);
  });

  it('1-8 invented meta-note → prose_drift (site prose with no workbook analogue)', () => {
    const spec = baseSpec({
      module: '1-8',
      template: 'populations-specific-needs',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<p>Note: Much of the guidance for seniors applies equally to other populations with specific needs.</p>`;
    // Workbook text mentions populations but NOT this meta-note.
    const extracted = `Populations with Specific Needs
Seniors
People with disabilities
Children under 5`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('prose_drift');
    expect(out[0].message).toMatch(/Note: Much of the guidance/);
  });

  it('bullet items (<li>) are also checked', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<ul><li>A wholly invented bullet item with no workbook source at all here.</li></ul>`;
    const extracted = `Completely unrelated workbook content about planning and preparedness strategies.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('prose_drift');
    expect(out[0].message).toMatch(/<li>/);
  });

  it('short paragraphs (<6 tokens) are skipped to avoid false positives', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    // "See more" is only 2 tokens — too short to validate reliably.
    const site = `<p>See more</p>`;
    const extracted = `Completely unrelated content.`;
    expect(proseMatches(ctx(spec, site, extracted))).toEqual([]);
  });

  it('nested <ul> inside <li>: outer li text is checked, inner items are NOT double-counted', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    // Outer li text ("Identify people trained in HAM radio") is in extract;
    // inner li ("invented nested item") is invented — must fail on its own.
    const site = `<ul><li>Identify people trained in HAM radio before emergencies occur.
  <ul><li>This nested bullet is wholly invented prose that cannot be verified.</li></ul>
</li></ul>`;
    const extracted = `Identify people trained in HAM radio before emergencies occur. Other preparedness guidance goes here.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('prose_drift');
    expect(out[0].message).toMatch(/nested bullet/);
  });

  it('column-fragmented PDF typography passes via token-recall fallback', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    // Site paragraph: every token grounded in workbook.
    const site = `<p>Provide meals for communities during disaster and recovery. Feeding people is key to sustaining response and relief efforts.</p>`;
    // Workbook: pdftotext column extraction has split "Provide" into a
    // standalone "P" line and a "rovide…" line, with interleaved column
    // text from another column ("Kitchen and meal distribution supplies",
    // "Chest freezer"). bestMatchScore drops below 0.6, but every token
    // of the site paragraph is present somewhere in the workbook text —
    // the fallback recognizes this as column fragmentation, not invention.
    const extracted = `P\nrovide meals for communities during disaster\nKitchen and meal distribution supplies\nand recovery. Feeding people is key to\nChest freezer\nsustaining response and relief efforts.`;
    expect(proseMatches(ctx(spec, site, extracted))).toEqual([]);
  });

  it('invented tokens fail the token-recall fallback (precision-first)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    // Site adds "Network" which is genuinely not in the workbook —
    // token-recall stays below 0.9 so this remains a drift.
    const site = `<li>Mutual Aid and/or Neighbor-to-Neighbor Network leader(s) coordinate community recovery</li>`;
    const extracted = `Mutual aid neighbor to neighbor leader(s)`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('prose_drift');
  });

  // ---------------------------------------------------------------------------
  // proseMatches — prose_scope spec-local windowing (day-15-j, decision j)
  // ---------------------------------------------------------------------------

  it('prose_scope: invented paragraph OUTSIDE window is skipped (silent)', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 10, end_line: 20 },
    });
    // Drift on line 1 is outside the [10..20] window — must NOT report.
    const site = `<p>This invented paragraph at line 1 is wholly invented and unrelated to the cited workbook content here.</p>
<h2>some heading at line 2</h2>`;
    const extracted = `Completely unrelated workbook prose about emergency preparedness planning.`;
    expect(proseMatches(ctx(spec, site, extracted))).toEqual([]);
  });

  it('prose_scope: invented paragraph INSIDE window emits prose_drift', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 1, end_line: 5 },
    });
    const site = `<p>This invented paragraph at line 1 is wholly invented and unrelated to the cited workbook content here.</p>`;
    const extracted = `Completely unrelated workbook prose about emergency preparedness planning.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('prose_drift');
  });

  it('prose_scope: open-ended start_line only', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 3 },
    });
    // Drift on line 1 is BEFORE start_line=3 → silent. Drift on line 5 → reported.
    const site = `<p>This invented paragraph at line 1 is wholly invented and unrelated to the cited workbook.</p>
<h1>line 2</h1>
<h2>line 3</h2>
<h3>line 4</h3>
<p>Another wholly invented paragraph at line 5 with no workbook grounding whatsoever here.</p>`;
    const extracted = `Completely unrelated workbook prose about emergency preparedness planning.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].line).toBeGreaterThanOrEqual(3);
    expect(out[0].message).toMatch(/Another wholly invented/);
  });

  it('prose_scope: open-ended end_line only', () => {
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { end_line: 3 },
    });
    // Drift on line 1 is BEFORE end_line=3 → reported. Drift on line 5 → silent.
    const site = `<p>This invented paragraph at line 1 is wholly invented and unrelated to the cited workbook.</p>
<h1>line 2</h1>
<h2>line 3</h2>
<h3>line 4</h3>
<p>Another wholly invented paragraph at line 5 with no workbook grounding whatsoever here.</p>`;
    const extracted = `Completely unrelated workbook prose about emergency preparedness planning.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].line).toBeLessThanOrEqual(3);
    expect(out[0].message).toMatch(/This invented paragraph/);
  });

  it('multi-spec scoping: 3 specs with disjoint windows + 1 drifted paragraph → 1 entry not 3', () => {
    // Closeout doc decision-j acceptance: "drift count equals 1 not 3 for a
    // single drifted paragraph" across a multi-citation file.
    const site = `<p>Section 1.9 Leader prose at line 1 is invented and not grounded.</p>
<h2>line 2</h2>
<p>Section 1.9 Neighbor prose at line 3 is grounded in the workbook content.</p>
<h2>line 4</h2>
<p>Section 1.9 First Responder prose at line 5 is also grounded fully here.</p>`;
    // Workbook grounds the lines-3 + lines-5 paragraphs, NOT line-1.
    const extracted = `Section 1.9 Neighbor prose at line 3 is grounded in the workbook content.
Section 1.9 First Responder prose at line 5 is also grounded fully here.`;
    const leaderSpec = baseSpec({
      template: 'leader-directory',
      tableId: 'leader-directory',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 1, end_line: 1 },
    });
    const neighborSpec = baseSpec({
      template: 'neighbor-directory',
      tableId: 'neighbor-directory',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 3, end_line: 3 },
    });
    const firstResponderSpec = baseSpec({
      template: 'first-responder-directory',
      tableId: 'first-responder-directory',
      fields: [{ key: 'x', label: 'X', type: 'text' }],
      prose_scope: { start_line: 5, end_line: 5 },
    });
    const leaderOut = proseMatches(ctx(leaderSpec, site, extracted));
    const neighborOut = proseMatches(ctx(neighborSpec, site, extracted));
    const firstResponderOut = proseMatches(ctx(firstResponderSpec, site, extracted));
    // Only the leader spec covers the drifted line-1 paragraph.
    expect(leaderOut).toHaveLength(1);
    expect(leaderOut[0].status).toBe('prose_drift');
    expect(leaderOut[0].message).toMatch(/Leader prose at line 1/);
    expect(neighborOut).toEqual([]);
    expect(firstResponderOut).toEqual([]);
    // Total drift entries across the three specs = 1, not 3.
    expect(leaderOut.length + neighborOut.length + firstResponderOut.length).toBe(1);
  });

  it('back-compat: no prose_scope preserves file-global behavior', () => {
    // Same fixture as the multi-spec test above but without prose_scope —
    // the leader spec, run file-global, sees the drifted line-1 paragraph
    // AND grounds the line-3 / line-5 paragraphs in the extracted text,
    // so 1 drift entry. Confirms the absence of prose_scope reverts to
    // pre-15-j behavior with no extra entries created.
    const spec = baseSpec({
      fields: [{ key: 'x', label: 'X', type: 'text' }],
    });
    const site = `<p>Section 1.9 Leader prose at line 1 is invented and not grounded.</p>
<p>Section 1.9 Neighbor prose at line 3 is grounded in the workbook content.</p>
<p>Section 1.9 First Responder prose at line 5 is also grounded fully here.</p>`;
    const extracted = `Section 1.9 Neighbor prose at line 3 is grounded in the workbook content.
Section 1.9 First Responder prose at line 5 is also grounded fully here.`;
    const out = proseMatches(ctx(spec, site, extracted));
    expect(out).toHaveLength(1);
    expect(out[0].message).toMatch(/Leader prose at line 1/);
  });
});
