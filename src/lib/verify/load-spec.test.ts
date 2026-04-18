import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadSpec,
  parseSpecMarkdown,
  SpecParseError,
  type LoadedSpec,
} from './load-spec';

const validFields = `
module: "1-9"
template: "leader-directory"
title: "Leader Directory"
citation:
  source: "rt-templates/leader-directory.pdf"
  page: "1"
fields:
  - key: "full-name"
    label: "Full Name"
    type: "text"
    required: true
  - key: "phone"
    label: "Phone"
    type: "tel"
`;

const validSections = `
module: "1-3"
template: "sitrep"
title: "Situation Report"
citation:
  source: "rt-templates/sitrep.pdf"
sections:
  - key: "header"
    label: "Header"
    fields:
      - key: "date"
        label: "Date"
        type: "date"
`;

const buildSpecMd = (frontmatter: string, body = '') =>
  `---${frontmatter}\n---${body ? '\n' + body : ''}`;

describe('parseSpecMarkdown', () => {
  it('parses a fields-only spec', () => {
    const raw = buildSpecMd(validFields);
    const loaded = parseSpecMarkdown(raw);
    expect(loaded.spec.module).toBe('1-9');
    expect(loaded.spec.template).toBe('leader-directory');
    expect(loaded.spec.fields?.length).toBe(2);
    expect(loaded.spec.sections).toBeUndefined();
  });

  it('parses a sections-only spec', () => {
    const raw = buildSpecMd(validSections);
    const loaded = parseSpecMarkdown(raw);
    expect(loaded.spec.sections?.length).toBe(1);
    expect(loaded.spec.sections?.[0].fields[0].key).toBe('date');
    expect(loaded.spec.fields).toBeUndefined();
  });

  it('exposes body text separately from frontmatter', () => {
    const raw = buildSpecMd(validFields, 'Some notes about the spec.\n\nSecond paragraph.');
    const loaded = parseSpecMarkdown(raw);
    expect(loaded.body).toContain('Some notes about the spec.');
    expect(loaded.body).toContain('Second paragraph.');
    expect(loaded.frontmatter).toContain('template: "leader-directory"');
  });

  it('handles CRLF line endings', () => {
    const raw = buildSpecMd(validFields).replace(/\n/g, '\r\n');
    const loaded = parseSpecMarkdown(raw);
    expect(loaded.spec.module).toBe('1-9');
  });

  it('returns empty body when no body present', () => {
    const loaded = parseSpecMarkdown(buildSpecMd(validFields));
    expect(loaded.body).toBe('');
  });

  it('throws spec_parse_error when frontmatter delimiters are missing', () => {
    expect(() => parseSpecMarkdown('no frontmatter here')).toThrow(SpecParseError);
    try {
      parseSpecMarkdown('no frontmatter here');
    } catch (e) {
      expect((e as SpecParseError).status).toBe('spec_parse_error');
      expect((e as SpecParseError).message).toContain('no YAML frontmatter');
    }
  });

  it('throws spec_parse_error on malformed YAML inside frontmatter', () => {
    const raw = buildSpecMd('\nmodule: "1-9\n  invalid: [');
    expect(() => parseSpecMarkdown(raw)).toThrow(SpecParseError);
    try {
      parseSpecMarkdown(raw);
    } catch (e) {
      expect((e as SpecParseError).status).toBe('spec_parse_error');
      expect((e as SpecParseError).message).toMatch(/YAML parse error|frontmatter YAML parse/);
    }
  });

  it('throws spec_parse_error when frontmatter fails zod validation (missing required)', () => {
    const raw = buildSpecMd('\nmodule: "1-9"\ntemplate: "leader-directory"');
    expect(() => parseSpecMarkdown(raw)).toThrow(SpecParseError);
    try {
      parseSpecMarkdown(raw);
    } catch (e) {
      expect((e as SpecParseError).status).toBe('spec_parse_error');
      expect((e as SpecParseError).message).toContain('schema validation failed');
    }
  });

  it('throws when both fields and sections are defined (schema refine)', () => {
    const both = `
module: "1-9"
template: "leader-directory"
title: "Leader Directory"
citation: { source: "x.pdf" }
fields:
  - key: "a"
    label: "A"
    type: "text"
sections:
  - key: "s"
    label: "S"
    fields:
      - key: "b"
        label: "B"
        type: "text"
`;
    expect(() => parseSpecMarkdown(buildSpecMd(both))).toThrow(SpecParseError);
  });

  it('throws when neither fields nor sections are defined (schema refine)', () => {
    const none = `
module: "1-9"
template: "leader-directory"
title: "Leader Directory"
citation: { source: "x.pdf" }
`;
    expect(() => parseSpecMarkdown(buildSpecMd(none))).toThrow(SpecParseError);
  });

  it('throws when module format is invalid', () => {
    const bad = `
module: "module-9"
template: "leader-directory"
title: "Leader Directory"
citation: { source: "x.pdf" }
fields:
  - key: "a"
    label: "A"
    type: "text"
`;
    expect(() => parseSpecMarkdown(buildSpecMd(bad))).toThrow(SpecParseError);
  });

  it('throws when field key is not kebab-case', () => {
    const bad = `
module: "1-9"
template: "leader-directory"
title: "Leader Directory"
citation: { source: "x.pdf" }
fields:
  - key: "Full_Name"
    label: "Full Name"
    type: "text"
`;
    expect(() => parseSpecMarkdown(buildSpecMd(bad))).toThrow(SpecParseError);
  });
});

describe('loadSpec (fs)', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'verify-loadspec-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('reads and parses a real spec file', async () => {
    const path = join(tmp, '1-9-leader-directory.md');
    await writeFile(path, buildSpecMd(validFields), 'utf-8');
    const loaded: LoadedSpec = await loadSpec(path);
    expect(loaded.spec.module).toBe('1-9');
    expect(loaded.spec.fields?.[0].label).toBe('Full Name');
  });

  it('throws source_not_found when file is missing', async () => {
    const path = join(tmp, 'missing.md');
    await expect(loadSpec(path)).rejects.toThrow(SpecParseError);
    try {
      await loadSpec(path);
    } catch (e) {
      expect((e as SpecParseError).status).toBe('source_not_found');
    }
  });

  it('surfaces parse error for a file with bad YAML', async () => {
    const path = join(tmp, 'bad.md');
    await writeFile(path, '---\nmodule: [\n---', 'utf-8');
    try {
      await loadSpec(path);
      throw new Error('expected loadSpec to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SpecParseError);
      expect((e as SpecParseError).status).toBe('spec_parse_error');
    }
  });
});
