#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  runVerify,
  type RunVerifyOptions,
  type TargetSelector,
} from '../src/lib/verify/runner';

export interface CliValues {
  target?: string;
  all?: boolean;
  since?: string;
  report?: string;
  'fail-on-needs-review'?: boolean;
}

export function parseCli(argv: readonly string[]): CliValues {
  const { values } = parseArgs({
    args: argv as string[],
    options: {
      target: { type: 'string' },
      all: { type: 'boolean' },
      since: { type: 'string' },
      report: { type: 'string' },
      'fail-on-needs-review': { type: 'boolean' },
    },
    allowPositionals: false,
  });
  return values as CliValues;
}

export function makeSelector(values: CliValues): TargetSelector {
  const flags = [
    values.target ? 'target' : null,
    values.all ? 'all' : null,
    values.since ? 'since' : null,
  ].filter(Boolean);
  if (flags.length > 1) {
    throw new Error(
      `verify-against-source: specify exactly one of --target, --all, --since (got ${flags.join(', ')})`,
    );
  }
  if (values.target) return { kind: 'target', pattern: values.target };
  if (values.since) return { kind: 'since', ref: values.since };
  return { kind: 'all' };
}

export function defaultReportPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(
    homedir(),
    '.gstack',
    'projects',
    'resiliencetoolkit-org',
    'verify-reports',
    `${stamp}.jsonl`,
  );
}

export interface MainOptions {
  argv?: readonly string[];
  cwd?: string;
  runner?: (opts: RunVerifyOptions) => ReturnType<typeof runVerify>;
}

export async function main(opts: MainOptions = {}): Promise<number> {
  const argv = opts.argv ?? process.argv.slice(2);
  const cwd = opts.cwd ?? process.cwd();
  const run = opts.runner ?? runVerify;

  let values: CliValues;
  let selector: TargetSelector;
  try {
    values = parseCli(argv);
    selector = makeSelector(values);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  const result = await run({
    projectRoot: resolve(cwd),
    selector,
    failOnNeedsReview: Boolean(values['fail-on-needs-review']),
  });

  const reportPath = values.report ? resolve(values.report) : defaultReportPath();
  await mkdir(dirname(reportPath), { recursive: true });
  const body =
    result.entries.map((e) => JSON.stringify(e)).join('\n') +
    (result.entries.length ? '\n' : '');
  await writeFile(reportPath, body, 'utf-8');

  process.stdout.write(
    `verify-against-source: ${result.entries.length} entries, exit ${result.exitCode}, report ${reportPath}\n`,
  );
  return result.exitCode;
}

const invokedAsScript =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedAsScript) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`verify-against-source: ${err?.message ?? err}\n`);
      process.exit(2);
    },
  );
}
