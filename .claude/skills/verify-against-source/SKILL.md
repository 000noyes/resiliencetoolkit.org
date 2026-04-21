---
name: verify-against-source
description: |
  Enforces the Source Fidelity invariant on resiliencetoolkit.org: every
  user-facing field label, option list, and directory column in wired Astro or
  React components must cite a local source spec (docs/source-specs/*.md) whose
  citation traces back to a workbook page or official template PDF. Fails
  closed on drive_id_not_allowed, source_unregistered, content_drift,
  field_drift, missing_citation, extract_failed, and cache_corrupted.
  source_drift is a soft advisory that only fails with --fail-on-needs-review.
  Run before /ship, in CI on every push, and as a prebuild hook.
---

## How to run

```bash
pnpm verify
```

Flags are passed directly to the CLI (pnpm 10 forwards them without a `--` separator):

| Scenario | Command |
|---|---|
| Full sweep (default) | `pnpm verify` |
| Check changed files vs main | `pnpm verify --since main` |
| Check one file / glob | `pnpm verify --target src/pages/modules/emergency-preparedness/1-9.astro` |
| CI (diff vs prev commit) | `pnpm verify --since HEAD~1` |
| Block merge on needs-review | `pnpm verify --fail-on-needs-review` |

Exit codes: `0 pass | 1 fail | 2 infra-error`. A JSONL report is written to
`~/.gstack/projects/resiliencetoolkit-org/verify-reports/<timestamp>.jsonl` (override
with `--report <path>`).

## What to do when it fails

Look at the report's last `status` entry.

- `drive_id_not_allowed` — mirror the Drive file to `rt-templates/` or
  `docs/source-specs/`, cite the local path.
- `missing_citation` — add `source="<path>"` + `page="<N-M>"` to the component.
- `source_not_found` — the cited PDF does not exist on disk. Restore it or
  point the spec at the correct path.
- `source_unregistered` — the PDF is on disk but has no entry in
  `_sources.yaml`. Run `pnpm scaffold-spec …` (even for an existing spec) to
  register it, then commit the updated registry.
- `source_drift` (soft advisory; exit 0 unless `--fail-on-needs-review`) —
  raw PDF bytes changed but the normalized extracted text is unchanged.
  Re-scaffold to refresh `source_hash` in `_sources.yaml`.
- `content_drift` (hard fail) — the normalized extracted text diverged from
  the registered `content_hash`. The spec was written against a different
  version of the PDF — triage, review, then re-scaffold.
- `field_drift` / `needs_human_review` — update the spec fields or the component.
- `cache_corrupted` — check the quarantined `_sources.yaml.corrupt-*` or
  `_extraction-cache.yaml.corrupt-*` file, rebuild from the good template.

## How the source registry works

`docs/source-specs/_sources.yaml` is the committed registry of every PDF
that verify knows about. One entry per cited PDF:

```yaml
sources:
  rt-templates/leader-directory.pdf:
    source_hash: <sha256 of raw PDF bytes>
    content_hash: <sha256 of normalized pdftotext output>
    last_verified: '<ISO 8601 timestamp>'
meta_hash: <sha256 of the sources map, tamper check>
```

Hash model (locked by the ResilienceToolkit constitution):

| Situation | Status | Exit |
|---|---|---|
| Both hashes match | `pass` / `field_drift` / `needs_human_review` (from diff) | per diff |
| `source_hash` differs, `content_hash` matches | `source_drift` (soft) | 0 (1 w/ --fail-on-needs-review) |
| `content_hash` differs (regardless of source_hash) | `content_drift` | 1 |
| PDF missing from registry | `source_unregistered` | 1 |
| PDF missing from disk | `source_not_found` | 1 |

`content_drift` short-circuits the field diff — once the normalized text
moves, field-level drift reports would be misleading.

## How to scaffold a new spec

```bash
pnpm scaffold-spec --pdf rt-templates/leader-directory.pdf \
                   --page 1 --module 1-9 --template leader-directory
```

Writes a stub to `docs/source-specs/1-9-leader-directory.md` AND registers
the PDF in `docs/source-specs/_sources.yaml` (registry-first atomicity: the
registry entry is written before the spec stub, so a partial crash leaves
an inert orphan entry rather than an unregistered spec). Replace the
placeholder field with real labels from the extracted text preview, commit
both files, then run `pnpm verify` again.

To re-register after a legitimate source update, run
`pnpm scaffold-spec … --force`. The registry entry is overwritten with
fresh hashes and a new timestamp.
