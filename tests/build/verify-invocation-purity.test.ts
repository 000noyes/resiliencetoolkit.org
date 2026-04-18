import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

const ROOT = resolve(__dirname, '../..');

const PACKAGE_JSON = resolve(ROOT, 'package.json');
const WORKFLOW = resolve(ROOT, '.github/workflows/verify.yml');
const SKILL = resolve(ROOT, '.claude/skills/verify-against-source/SKILL.md');

/**
 * Axis 6 of the locked eng-review spec: all four invocation paths MUST be
 * three-line thunks calling scripts/verify-against-source.ts with no logic of
 * their own. This test grep-enforces that invariant so new shell glue cannot
 * sneak in unnoticed.
 *
 * Why: any per-invocation logic (conditional skips, multi-step setup embedded
 * in the thunk, alternative entrypoints) forks the verify behavior between
 * local and CI, which is exactly the drift the verify skill exists to prevent.
 */
describe('verify-against-source invocation purity', () => {
  it('package.json scripts.verify is a bare tsx thunk to the CLI', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    const verify = pkg.scripts?.verify;
    expect(verify, 'scripts.verify is missing').toBeDefined();
    expect(verify).toMatch(/^tsx scripts\/verify-against-source\.ts(\s|$)/);
    // No chained commands, no pipes, no redirection.
    expect(verify).not.toMatch(/&&|\|\||;|>\s|<\s/);
  });

  it('package.json scripts.prebuild thunks only to pnpm verify', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    const prebuild = pkg.scripts?.prebuild;
    expect(prebuild, 'scripts.prebuild is missing').toBeDefined();
    expect(prebuild).toMatch(/^pnpm verify(\s|$)/);
    expect(prebuild).not.toMatch(/&&|\|\||;|>\s|<\s/);
  });

  it('GH Actions workflow runs pnpm verify as a single step with no embedded logic', () => {
    const wf = load(readFileSync(WORKFLOW, 'utf-8')) as {
      jobs: { verify: { steps: Array<{ name?: string; run?: string; uses?: string }> } };
    };
    const steps = wf.jobs?.verify?.steps ?? [];
    const verifyStep = steps.find(
      (s) => typeof s.run === 'string' && /pnpm verify/.test(s.run),
    );
    expect(verifyStep, 'no step in verify.yml invokes pnpm verify').toBeDefined();
    const cmd = verifyStep!.run!.trim();
    expect(cmd).toMatch(/^pnpm verify(\s|$)/);
    // Flags are fine after -- but no command chaining.
    expect(cmd).not.toMatch(/&&|\|\||;/);
  });

  it('SKILL.md documents running via pnpm verify and contains no chained commands', () => {
    const skill = readFileSync(SKILL, 'utf-8');
    expect(skill).toMatch(/pnpm verify/);
    // Reject inline shell glue in the "how to run" table — operators should
    // be told to invoke the CLI directly, not to compose it.
    const tableLines = skill.split('\n').filter((line) => line.trim().startsWith('|'));
    for (const line of tableLines) {
      // The CLI itself uses `--` to forward flags to tsx; that's allowed.
      // What's NOT allowed is chaining to another program.
      expect(line, `SKILL.md table row chains commands: ${line}`).not.toMatch(/&&|\|\|/);
    }
  });

  it('SKILL.md has frontmatter with name = verify-against-source', () => {
    const skill = readFileSync(SKILL, 'utf-8');
    const fmMatch = /^---\n([\s\S]*?)\n---/.exec(skill);
    expect(fmMatch, 'SKILL.md missing YAML frontmatter').not.toBeNull();
    const fm = load(fmMatch![1]) as { name?: string };
    expect(fm.name).toBe('verify-against-source');
  });

  it('all four invocation paths point at the same CLI entrypoint', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    const wf = load(readFileSync(WORKFLOW, 'utf-8')) as {
      jobs: { verify: { steps: Array<{ run?: string }> } };
    };
    const skill = readFileSync(SKILL, 'utf-8');

    // All four must either invoke the CLI directly OR go through pnpm verify,
    // which itself points at the CLI. That covers the full chain end-to-end.
    expect(pkg.scripts.verify).toContain('scripts/verify-against-source.ts');
    expect(pkg.scripts.prebuild).toContain('pnpm verify');
    const ciStep = (wf.jobs.verify.steps ?? []).find(
      (s) => typeof s.run === 'string' && /pnpm verify/.test(s.run),
    );
    expect(ciStep?.run).toContain('pnpm verify');
    expect(skill).toContain('pnpm verify');
  });
});
