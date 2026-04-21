import { describe, it, expect, vi } from 'vitest';

import {
  parseScaffoldCli,
  main,
} from '../../scripts/scaffold-spec';
import {
  ScaffoldError,
  type ScaffoldOptions,
  type ScaffoldResult,
} from '../../src/lib/verify/scaffold';

describe('scaffold-cli: parseScaffoldCli', () => {
  it('parses --pdf --page --module --template --title --out --force', () => {
    const v = parseScaffoldCli([
      '--pdf', 'rt-templates/x.pdf',
      '--page', '14-15',
      '--module', '1-9',
      '--template', 'leader-directory',
      '--title', 'Community Leader Directory',
      '--out', 'custom.md',
      '--force',
    ]);
    expect(v).toEqual({
      pdf: 'rt-templates/x.pdf',
      page: '14-15',
      module: '1-9',
      template: 'leader-directory',
      title: 'Community Leader Directory',
      out: 'custom.md',
      force: true,
    });
  });
});

describe('scaffold-cli: main', () => {
  const okResult: ScaffoldResult = {
    outAbsolutePath: '/abs/docs/source-specs/1-9-leader-directory.md',
    outRelPath: 'docs/source-specs/1-9-leader-directory.md',
    content: '---\nmodule: "1-9"\n---\nbody',
    extractedText: 'extracted',
    cacheSaved: true,
  };

  function mockScaffold(result: ScaffoldResult | Error) {
    if (result instanceof Error) {
      return vi.fn<(opts: ScaffoldOptions) => Promise<ScaffoldResult>>(async () => {
        throw result;
      });
    }
    return vi.fn<(opts: ScaffoldOptions) => Promise<ScaffoldResult>>(async () => result);
  }

  it('returns 0 on success, passes args through', async () => {
    const scaffolder = mockScaffold(okResult);
    const code = await main({
      argv: [
        '--pdf', 'rt-templates/x.pdf',
        '--page', '14-15',
        '--module', '1-9',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(0);
    expect(scaffolder).toHaveBeenCalledWith(
      expect.objectContaining({
        pdf: 'rt-templates/x.pdf',
        page: '14-15',
        module: '1-9',
        template: 'leader-directory',
      }),
    );
  });

  it('returns 2 when --pdf missing', async () => {
    const scaffolder = mockScaffold(okResult);
    const code = await main({
      argv: ['--module', '1-9', '--template', 'x'],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(2);
    expect(scaffolder).not.toHaveBeenCalled();
  });

  it('returns 2 when --module missing', async () => {
    const scaffolder = mockScaffold(okResult);
    const code = await main({
      argv: ['--pdf', 'a.pdf', '--template', 'x'],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(2);
  });

  it('returns 2 when --template missing', async () => {
    const scaffolder = mockScaffold(okResult);
    const code = await main({
      argv: ['--pdf', 'a.pdf', '--module', '1-9'],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(2);
  });

  it('returns 1 when scaffolder throws a non-infra ScaffoldError', async () => {
    const err = new ScaffoldError('bad template', 'spec_parse_error');
    const scaffolder = mockScaffold(err);
    const code = await main({
      argv: [
        '--pdf', 'a.pdf',
        '--module', '1-9',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(1);
  });

  it('returns 2 when scaffolder throws cache_corrupted', async () => {
    const err = new ScaffoldError('quarantined', 'cache_corrupted');
    const scaffolder = mockScaffold(err);
    const code = await main({
      argv: [
        '--pdf', 'a.pdf',
        '--module', '1-9',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(2);
  });

  it('returns 2 on unexpected exceptions', async () => {
    const scaffolder = mockScaffold(new Error('boom'));
    const code = await main({
      argv: [
        '--pdf', 'a.pdf',
        '--module', '1-9',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(2);
  });

  it('returns 1 when scaffolder throws `exists` (ScaffoldError status)', async () => {
    const err = new ScaffoldError('already exists', 'exists');
    const scaffolder = mockScaffold(err);
    const code = await main({
      argv: [
        '--pdf', 'a.pdf',
        '--module', '1-9',
        '--template', 'leader-directory',
      ],
      cwd: '/abs',
      scaffolder,
    });
    expect(code).toBe(1);
  });
});
