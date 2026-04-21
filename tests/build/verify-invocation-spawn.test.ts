import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const ROOT = resolve(__dirname, '../..');

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function runPnpm(args: string[]): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync('pnpm', args, {
      cwd: ROOT,
      env: { ...process.env, CI: '1' },
      timeout: 60_000,
    });
    return { stdout, stderr, code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; code?: number | null };
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      code: typeof err.code === 'number' ? err.code : 1,
    };
  }
}

/**
 * Why: the invocation-purity test asserts the text of the documented
 * invocations but never executes them. That let H1 (pnpm 10 rejecting the
 * `--` separator under allowPositionals:false) ship unnoticed. This spawn
 * test executes the canonical documented form end-to-end so a future
 * packaging change cannot silently break the CLI again.
 */
describe('verify-against-source spawn-level invocation', () => {
  it('pnpm verify --target <no-match-glob> exits cleanly with no parse error', async () => {
    const result = await runPnpm([
      'verify',
      '--target',
      'src/pages/__no_match_for_spawn_test__.astro',
    ]);
    expect(result.stderr, `stderr: ${result.stderr}`).not.toMatch(
      /Unexpected argument/,
    );
    expect(result.stderr).not.toMatch(/does not take positional arguments/);
    expect(result.code).toBe(0);
  }, 70_000);

  it('pnpm scaffold-spec --help-like invocation does not fail on arg parsing', async () => {
    // --pdf pointing at a missing file exits 1 via ScaffoldError, not 2 via
    // parseArgs. What we're asserting here is that argv parsing survived.
    const result = await runPnpm([
      'scaffold-spec',
      '--pdf',
      '/no/such/file.pdf',
      '--module',
      '1-9',
      '--template',
      'spawn-smoke',
    ]);
    expect(result.stderr).not.toMatch(/Unexpected argument/);
    expect(result.stderr).not.toMatch(/does not take positional arguments/);
  }, 70_000);

  it('pnpm measure-accuracy invocation does not fail on arg parsing', async () => {
    const result = await runPnpm([
      'measure-accuracy',
      '--spec',
      '/no/such/spec.md',
      '--template',
      '/no/such/template.pdf',
    ]);
    expect(result.stderr).not.toMatch(/Unexpected argument/);
    expect(result.stderr).not.toMatch(/does not take positional arguments/);
  }, 70_000);
});
