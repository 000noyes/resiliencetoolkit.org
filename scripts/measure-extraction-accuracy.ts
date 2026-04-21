#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import {
  AccuracyError,
  RECALL_THRESHOLD,
  runAccuracyMeasurement,
  type RunAccuracyOptions,
  type RunAccuracyResult,
} from '../src/lib/verify/accuracy';

export interface AccuracyCliValues {
  spec: string[];
  template: string[];
  out?: string;
}

export interface AccuracyCliParsed {
  inputs: { template: string; specPath: string }[];
  out?: string;
}

const USAGE =
  'measure-extraction-accuracy --spec <path> --template <name> [--spec <path> --template <name> ...] [--out <path>]';

export function parseAccuracyCli(argv: readonly string[]): AccuracyCliParsed {
  const { values } = parseArgs({
    args: argv as string[],
    options: {
      spec: { type: 'string', multiple: true },
      template: { type: 'string', multiple: true },
      out: { type: 'string' },
    },
    allowPositionals: false,
  });
  const specs = (values.spec ?? []) as string[];
  const templates = (values.template ?? []) as string[];
  if (specs.length === 0) {
    throw new Error('--spec is required (at least one)');
  }
  if (templates.length !== specs.length) {
    throw new Error(
      `each --spec must be paired with a --template; got ${specs.length} specs and ${templates.length} templates`,
    );
  }
  const inputs = specs.map((specPath, i) => ({ template: templates[i], specPath }));
  return { inputs, out: values.out as string | undefined };
}

export interface AccuracyMainOptions {
  argv?: readonly string[];
  cwd?: string;
  runner?: (opts: RunAccuracyOptions) => Promise<RunAccuracyResult>;
}

export async function main(opts: AccuracyMainOptions = {}): Promise<number> {
  const argv = opts.argv ?? process.argv.slice(2);
  const cwd = opts.cwd ?? process.cwd();
  const run = opts.runner ?? runAccuracyMeasurement;

  let parsed: AccuracyCliParsed;
  try {
    parsed = parseAccuracyCli(argv);
  } catch (e) {
    process.stderr.write(`measure-extraction-accuracy: ${(e as Error).message}\n`);
    process.stderr.write(`usage: ${USAGE}\n`);
    return 2;
  }

  try {
    const result = await run({
      projectRoot: resolve(cwd),
      inputs: parsed.inputs,
      outRelPath: parsed.out,
    });

    process.stdout.write(`measure-extraction-accuracy: wrote ${result.outRelPath}\n`);
    for (const o of result.outcomes) {
      process.stdout.write(
        `  ${o.template}: precision=${o.metrics.precision.toFixed(3)} ` +
          `recall=${o.metrics.recall.toFixed(3)} ` +
          `(${o.metrics.true_positives}/${o.metrics.expected_field_count} expected, ` +
          `${o.metrics.extracted_candidate_count} candidate lines)\n`,
      );
    }
    if (!result.meetsThreshold) {
      process.stderr.write(
        `measure-extraction-accuracy: one or more templates below recall threshold ${RECALL_THRESHOLD}\n`,
      );
      return 1;
    }
    return 0;
  } catch (e) {
    if (e instanceof AccuracyError) {
      process.stderr.write(`measure-extraction-accuracy: ${e.status}: ${e.message}\n`);
      if (e.status === 'cache_corrupted') return 2;
      // M5: pdftotext binary missing (ENOENT/ENOTFOUND) is an infra error,
      // not a template-quality failure. Exit 2 so CI triage isn't misdirected.
      if (e.status === 'extract_failed' && (e.code === 'ENOENT' || e.code === 'ENOTFOUND')) {
        return 2;
      }
      return 1;
    }
    process.stderr.write(`measure-extraction-accuracy: ${(e as Error).message}\n`);
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
      process.stderr.write(`measure-extraction-accuracy: ${err?.message ?? err}\n`);
      process.exit(2);
    },
  );
}
