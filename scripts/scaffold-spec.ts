#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import {
  scaffoldSpec,
  ScaffoldError,
  type ScaffoldOptions,
  type ScaffoldResult,
} from '../src/lib/verify/scaffold';

export interface ScaffoldCliValues {
  pdf?: string;
  page?: string;
  module?: string;
  template?: string;
  title?: string;
  out?: string;
  force?: boolean;
}

export function parseScaffoldCli(argv: readonly string[]): ScaffoldCliValues {
  const { values } = parseArgs({
    args: argv as string[],
    options: {
      pdf: { type: 'string' },
      page: { type: 'string' },
      module: { type: 'string' },
      template: { type: 'string' },
      title: { type: 'string' },
      out: { type: 'string' },
      force: { type: 'boolean' },
    },
    allowPositionals: false,
  });
  return values as ScaffoldCliValues;
}

export interface ScaffoldMainOptions {
  argv?: readonly string[];
  cwd?: string;
  scaffolder?: (opts: ScaffoldOptions) => Promise<ScaffoldResult>;
}

export async function main(opts: ScaffoldMainOptions = {}): Promise<number> {
  const argv = opts.argv ?? process.argv.slice(2);
  const cwd = opts.cwd ?? process.cwd();
  const scaffold = opts.scaffolder ?? scaffoldSpec;

  let values: ScaffoldCliValues;
  try {
    values = parseScaffoldCli(argv);
  } catch (e) {
    process.stderr.write(`scaffold-spec: ${(e as Error).message}\n`);
    return 2;
  }

  for (const required of ['pdf', 'module', 'template'] as const) {
    if (!values[required]) {
      process.stderr.write(`scaffold-spec: missing required --${required}\n`);
      return 2;
    }
  }

  try {
    const result = await scaffold({
      projectRoot: resolve(cwd),
      pdf: values.pdf!,
      page: values.page,
      module: values.module!,
      template: values.template!,
      title: values.title,
      outRelPath: values.out,
      force: Boolean(values.force),
    });
    process.stdout.write(
      `scaffold-spec: wrote ${result.outRelPath} (cache saved: ${result.cacheSaved}, registry saved: ${result.registrySaved})\n`,
    );
    return 0;
  } catch (e) {
    if (e instanceof ScaffoldError) {
      process.stderr.write(`scaffold-spec: ${e.status}: ${e.message}\n`);
      return e.status === 'cache_corrupted' ? 2 : 1;
    }
    process.stderr.write(`scaffold-spec: ${(e as Error).message}\n`);
    return 2;
  }
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
      process.stderr.write(`scaffold-spec: ${err?.message ?? err}\n`);
      process.exit(2);
    },
  );
}
