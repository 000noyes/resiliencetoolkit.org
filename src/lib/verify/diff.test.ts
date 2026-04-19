import { describe, it, expect } from 'vitest';

import type { SourceSpec } from './schemas';
import {
  DEFAULT_MATCH_CONFIDENCE,
  DEFAULT_RECALL_THRESHOLD,
  bestMatchScore,
  collectSpecFields,
  diff,
  extractCandidateLines,
  normalizeLabel,
} from './diff';

function flatSpec(labels: string[]): SourceSpec {
  return {
    module: '1-9',
    template: 'leader-directory',
    title: 'Leader Directory',
    citation: {
      source: 'public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf',
      page: '14-15',
    },
    fields: labels.map((label, i) => ({
      key: `f-${i}`,
      label,
      type: 'text' as const,
    })),
  } as SourceSpec;
}

function sectionedSpec(
  groups: { key: string; label: string; fields: string[] }[],
): SourceSpec {
  return {
    module: '1-9',
    template: 'leader-directory',
    title: 'Leader Directory',
    citation: {
      source: 'public/toolkit/2025 Resilience Hub Toolkit w Templates_V1 final.pdf',
      page: '14-15',
    },
    sections: groups.map((g) => ({
      key: g.key,
      label: g.label,
      fields: g.fields.map((label, i) => ({
        key: `${g.key}-${i}`,
        label,
        type: 'text' as const,
      })),
    })),
  } as SourceSpec;
}

describe('diff: normalizeLabel', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeLabel('  Emergency   CONTACT  ')).toBe('emergency contact');
  });

  it('strips punctuation but preserves unicode letters', () => {
    expect(normalizeLabel('Señor/ita (name):')).toBe('señor ita name');
  });

  it('handles empty input', () => {
    expect(normalizeLabel('')).toBe('');
    expect(normalizeLabel('   ')).toBe('');
  });

  it('collapses tabs, form feeds, and multiple newlines', () => {
    expect(normalizeLabel('foo\tbar\f\nbaz\n\n\nqux')).toBe('foo bar baz qux');
  });
});

describe('diff: collectSpecFields', () => {
  it('returns flat fields when spec has .fields', () => {
    const spec = flatSpec(['A', 'B']);
    expect(collectSpecFields(spec).map((f) => f.label)).toEqual(['A', 'B']);
  });

  it('flattens sectioned fields in order', () => {
    const spec = sectionedSpec([
      { key: 'head', label: 'Head', fields: ['A', 'B'] },
      { key: 'tail', label: 'Tail', fields: ['C'] },
    ]);
    expect(collectSpecFields(spec).map((f) => f.label)).toEqual(['A', 'B', 'C']);
  });
});

describe('diff: bestMatchScore', () => {
  it('returns 1 on exact substring match', () => {
    expect(bestMatchScore('emergency contact', 'name emergency contact phone')).toBe(1);
  });

  it('returns 0 for empty label or text', () => {
    expect(bestMatchScore('', 'anything')).toBe(0);
    expect(bestMatchScore('anything', '')).toBe(0);
  });

  it('scores partial token overlap above 0 and below 1', () => {
    const score = bestMatchScore('emergency contact name', 'emergency kit phone contact');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 when no tokens overlap', () => {
    expect(bestMatchScore('quixotic', 'apple banana cherry')).toBe(0);
  });

  // Regression: word-boundary fix. Substring-inside-a-longer-word must not score 1.
  it('does NOT score 1 when label is a substring of an unrelated word', () => {
    expect(bestMatchScore('age', 'package manager')).toBeLessThan(1);
    expect(bestMatchScore('name', 'username only')).toBeLessThan(1);
    expect(bestMatchScore('the', 'theology papers')).toBeLessThan(1);
  });

  it('still scores 1 for a whole-phrase match with surrounding text', () => {
    expect(bestMatchScore('full name', 'please enter full name here')).toBe(1);
    expect(bestMatchScore('age', 'your age here')).toBe(1);
  });

  it('scores 1 when label equals text exactly', () => {
    expect(bestMatchScore('age', 'age')).toBe(1);
  });
});

describe('diff: unicode normalization (NFC/NFD regression)', () => {
  it('normalizeLabel canonicalizes NFD to match NFC', () => {
    const nfc = 'Señor'.normalize('NFC');
    const nfd = 'Señor'.normalize('NFD');
    expect(normalizeLabel(nfc)).toBe(normalizeLabel(nfd));
    expect(normalizeLabel(nfd)).toBe('señor');
  });

  it('bestMatchScore treats NFC and NFD as equivalent after normalize', () => {
    const nfc = normalizeLabel('Señor Nombre');
    const nfd = normalizeLabel('Señor Nombre'.normalize('NFD'));
    expect(bestMatchScore(nfc, nfd)).toBe(1);
  });
});

describe('diff: extractCandidateLines', () => {
  it('dedupes, trims, drops empty + overlong + purely-punctuation lines', () => {
    const text = [
      '  Name  ',
      'Name',
      '',
      '   ',
      '----',
      'Phone Number',
      'x'.repeat(200),
      'Email',
    ].join('\n');
    expect(extractCandidateLines(text, 50)).toEqual(['Name', 'Phone Number', 'Email']);
  });

  it('caps at max', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Line ${i}`).join('\n');
    expect(extractCandidateLines(text, 3)).toEqual(['Line 0', 'Line 1', 'Line 2']);
  });
});

describe('diff: status decisions', () => {
  it('pass when all fields found cleanly and recall is 1.0', () => {
    const spec = flatSpec(['Full Name', 'Phone Number', 'Email Address']);
    const text = 'LEADER DIRECTORY\nFull Name\nPhone Number\nEmail Address';
    const result = diff({ spec, text });
    expect(result.status).toBe('pass');
    expect(result.recall).toBe(1);
    expect(result.drift).toBeUndefined();
  });

  it('pass tolerates whitespace and case drift in the text', () => {
    const spec = flatSpec(['Full Name', 'Phone Number']);
    const text = '  FULL    name  \n\tphone  number\t';
    const result = diff({ spec, text });
    expect(result.status).toBe('pass');
  });

  it('field_drift when all fields represented but some drifted (relaxed threshold)', () => {
    const spec = flatSpec(['Emergency Contact Name']);
    // Label is 3 tokens; best window at text end is [emergency, contact] → jaccard 2/3 ≈ 0.667,
    // inside drift zone [0.6, 0.85). With recallThreshold=0, exercises the field_drift branch
    // directly without needing many clean fields to offset the one drifted one.
    const text = 'leader directory\nemergency contact';
    const result = diff({ spec, text }, { recallThreshold: 0 });
    expect(result.status).toBe('field_drift');
    expect(result.drift?.expected_fields).toEqual(['Emergency Contact Name']);
    expect(result.drift?.diff?.[0]).toMatch(/field drift.*Emergency Contact Name/);
    expect(result.drift?.actual_fields).toBeUndefined();
  });

  it('default recall threshold forces needs_human_review when a single field is only drifted', () => {
    // Counter-part to the test above: default thresholds require clean-recall ≥ 0.95,
    // so a single drifted field with no clean matches falls through to needs_human_review.
    const spec = flatSpec(['Emergency Contact Name']);
    const text = 'leader directory\nemergency contact';
    const result = diff({ spec, text });
    expect(result.status).toBe('needs_human_review');
    expect(result.recall).toBe(0);
  });

  it('needs_human_review when a field is missing entirely', () => {
    const spec = flatSpec(['Full Name', 'Phone Number', 'Blood Type']);
    const text = 'Full Name\nPhone Number\n\n';
    const result = diff({ spec, text });
    expect(result.status).toBe('needs_human_review');
    expect(result.recall).toBeLessThan(1);
    expect(result.drift?.diff?.some((d) => /Blood Type/.test(d))).toBe(true);
    expect(result.drift?.actual_fields).toBeDefined();
  });

  it('needs_human_review when recall is below threshold even if nothing is outright missing', () => {
    // Two fields, both in drift zone -> recall 0/2 = 0, which is below any reasonable threshold.
    const spec = flatSpec(['Emergency Contact Name', 'Emergency Vehicle License']);
    const text = 'emergency contact\nemergency vehicle';
    const result = diff({ spec, text });
    expect(result.status).toBe('needs_human_review');
    expect(result.drift?.actual_fields).toBeDefined();
  });

  it('field_drift when some match cleanly and others drift, with recall above threshold', () => {
    // 20 fields total: 19 clean-matched, 1 drifted. Recall 19/20 = 0.95.
    const cleanLabels = Array.from({ length: 19 }, (_, i) => `Field ${i}`);
    const spec = flatSpec([...cleanLabels, 'Emergency Contact Name']);
    const text = [...cleanLabels, 'emergency contact'].join('\n');
    const result = diff({ spec, text });
    expect(result.status).toBe('field_drift');
    expect(result.recall).toBeGreaterThanOrEqual(DEFAULT_RECALL_THRESHOLD);
  });

  it('needs_human_review with empty spec (should never happen via schema, but defensive)', () => {
    const spec = {
      module: '1-9',
      template: 'x',
      title: 'X',
      citation: { source: 'public/toolkit/t.pdf' },
      fields: [],
    } as unknown as SourceSpec;
    const result = diff({ spec, text: 'whatever' });
    expect(result.status).toBe('needs_human_review');
    expect(result.recall).toBe(0);
    expect(result.drift?.diff?.[0]).toMatch(/no fields/);
  });

  it('supports sectioned specs — flattens and evaluates across all sections', () => {
    const spec = sectionedSpec([
      { key: 'head', label: 'Head', fields: ['Full Name', 'Phone Number'] },
      { key: 'tail', label: 'Tail', fields: ['Email Address'] },
    ]);
    const text = 'Full Name Phone Number Email Address';
    expect(diff({ spec, text }).status).toBe('pass');
  });

  it('honors custom thresholds', () => {
    const spec = flatSpec(['Alpha Bravo Charlie']);
    // "alpha bravo charlie" split 2/3 against text.
    const text = 'alpha bravo delta';
    // Default: this is 2/4 = 0.5 (below driftThreshold 0.6) => needs_human_review.
    expect(diff({ spec, text }).status).toBe('needs_human_review');
    // Relax driftThreshold so the match counts as drifted.
    const relaxed = diff(
      { spec, text },
      { driftThreshold: 0.4, matchConfidenceThreshold: 0.95, recallThreshold: 0 },
    );
    expect(relaxed.status).toBe('field_drift');
  });

  it('rejects invalid thresholds at runtime', () => {
    const spec = flatSpec(['X']);
    expect(() =>
      diff({ spec, text: 'x' }, { driftThreshold: 0.9, matchConfidenceThreshold: 0.5 }),
    ).toThrow(/invalid thresholds/);
  });

  it('returned status is always one of the taxonomy values', () => {
    const allowed = new Set(['pass', 'field_drift', 'needs_human_review']);
    const cases = [
      { spec: flatSpec(['X']), text: 'X' },
      { spec: flatSpec(['X']), text: '' },
      { spec: flatSpec([]), text: '' },
      { spec: flatSpec(['Alpha Bravo', 'Charlie Delta']), text: 'alpha bravo ????' },
    ];
    for (const c of cases) {
      expect(allowed.has(diff(c as never).status)).toBe(true);
    }
  });

  it('recall reflects clean matches, not drifted or missing', () => {
    const spec = flatSpec(['A', 'B', 'C', 'D']);
    // A and B cluster on one header-like line (satisfies cluster_min_labels=2
    // for 4 short labels); C and D are absent from the cluster so they
    // demote to missing — recall = 2 clean / 4 total.
    const text = 'A B\n';
    const result = diff({ spec, text });
    expect(result.recall).toBe(0.5);
    expect(result.status).toBe('needs_human_review');
  });

  it('uses DEFAULT_MATCH_CONFIDENCE as-is (regression lock)', () => {
    expect(DEFAULT_MATCH_CONFIDENCE).toBe(0.85);
    expect(DEFAULT_RECALL_THRESHOLD).toBe(0.95);
  });
});

describe('diff: short-label cluster corroboration (Session D H3)', () => {
  it('legitimate column-header cluster passes all short labels', () => {
    // Real leader-directory header: 4 short labels on one line + a long one
    // on another. cluster_min_labels for 5 fields = min(3, max(2, 2)) = 3.
    const spec = flatSpec([
      'Title/Role',
      'Name',
      'Phone',
      'Email',
      'Link to local emergency plan',
    ]);
    const text =
      'Title/Role   Name   Phone   Email\n' +
      'Link to local emergency plan:\n';
    const result = diff({ spec, text });
    expect(result.status).toBe('pass');
    expect(result.recall).toBe(1);
  });

  it('opt-out via matching.require_cluster=false restores unguarded behavior', () => {
    const spec = flatSpec(['Phone', 'Email']);
    (spec as { matching?: { require_cluster: boolean } }).matching = {
      require_cluster: false,
    };
    // 2-label spec where both short labels appear in unrelated prose, on
    // different lines. Without cluster guard: pass. With guard: would fail.
    const text = 'Please provide your phone for contact.\nLeave email blank.\n';
    const result = diff({ spec, text });
    expect(result.status).toBe('pass');
  });

  it('tiny 2-short-label spec with no cluster possible fails closed by default', () => {
    const spec = flatSpec(['Name', 'Date']);
    // Both short labels appear but on different lines — no cluster.
    // cluster_min_labels = min(3, max(2, 1)) = 2, but no line has 2 hits.
    const text = 'Please enter your name.\nEnter today\'s date.\n';
    const result = diff({ spec, text });
    expect(result.status).toBe('needs_human_review');
    expect(result.recall).toBe(0);
  });

  it('long-label-only spec is unaffected by the cluster guard', () => {
    const spec = flatSpec([
      'Link to local emergency plan',
      'Emergency contact procedure',
    ]);
    // Both labels are long (>1 token AND >4 chars). No clustering required.
    const text =
      'Please fill in the link to local emergency plan here.\n' +
      'The emergency contact procedure must be documented.\n';
    const result = diff({ spec, text });
    expect(result.status).toBe('pass');
  });

  it('short-label classification: single-token OR <=4 chars', () => {
    // Boundary: "Phone" = 1 token, 5 chars → short (by token rule).
    //          "Date"  = 1 token, 4 chars → short (both rules).
    //          "Title/Role" = 2 tokens after normalize, 10 chars → long.
    //
    // Spec with Title/Role (long) + Phone (short). Text clusters the long
    // label alongside prose, but Phone appears only in disconnected prose.
    // Phone should demote to 0 → needs_human_review.
    const spec = flatSpec(['Title/Role', 'Phone']);
    const text = 'Title/Role of contact person here.\nCall on the phone.\n';
    const result = diff({ spec, text });
    // Title/Role scores; Phone is demoted by cluster check.
    expect(result.status).toBe('needs_human_review');
  });

  it('default config (no matching block) applies the guard', () => {
    const spec = flatSpec(['Phone', 'Email', 'Name']);
    // spec.matching is undefined → defaults engage.
    const text = 'Please enter phone.\nAlso enter email.\nName here.\n';
    const result = diff({ spec, text });
    // 3 short labels, each on its own line → no cluster → all demoted.
    expect(result.status).toBe('needs_human_review');
  });

  it('custom matching.cluster_min_labels=2 loosens the gate', () => {
    const spec = flatSpec(['Phone', 'Email', 'Name']);
    (spec as { matching?: { cluster_min_labels: number } }).matching = {
      cluster_min_labels: 2,
    };
    // Two labels on one line = cluster with min=2.
    const text = 'Phone  Email\nName:\n';
    const result = diff({ spec, text });
    // Phone + Email cluster on line 1 → pass for both. Name is alone on
    // line 2, no cluster → demoted.
    expect(result.status).toBe('needs_human_review');
    // Phone + Email recall = 2/3 ≈ 0.67
    expect(result.recall).toBeCloseTo(2 / 3);
  });
});
