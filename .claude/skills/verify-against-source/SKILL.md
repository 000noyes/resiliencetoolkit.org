---
name: verify-against-source
description: |
  Enforces the Source Fidelity invariant on resiliencetoolkit.org: every
  user-facing field label, option list, and directory column in wired Astro or
  React components must cite a local source spec (docs/source-specs/*.md) whose
  citation traces back to a workbook page or official template PDF. Fails
  closed on drive_id_not_allowed, source_drift, content_drift, field_drift,
  missing_citation, extract_failed, and cache_corrupted. Run before /ship, in
  CI on every push, and as a prebuild hook.
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
- `source_not_found` / `source_drift` — refresh `rt-templates/` or regenerate the spec.
- `content_drift` — the extracted PDF text diverged from the registered hash; triage.
- `field_drift` / `needs_human_review` — update the spec fields or the component.
- `cache_corrupted` — check the quarantined `_sources.yaml.corrupt-*` or
  `_extraction-cache.yaml.corrupt-*` file, rebuild from the good template.

## How to scaffold a new spec

```bash
pnpm scaffold-spec --pdf rt-templates/leader-directory.pdf \
                   --page 1 --module 1-9 --template leader-directory
```

Writes a stub to `docs/source-specs/1-9-leader-directory.md`. Replace the
placeholder field with real labels from the extracted text preview, then
run `pnpm verify` again.
