# Removed code ledger

Orphaned code retired from the tree. Every removal is recoverable from git
history; the bulk removal commit is also tagged `archive/w2-orphan-sweep`.
The authoritative orphan list is produced by `knip` (see `knip.json`), not by
hand audit. One line per removed file: what · why · how to recover.

## 2026-06-08 — W2 orphan sweep (tag: `archive/w2-orphan-sweep`)

Detector: `knip` (unused files). Each entry was additionally confirmed by a
direct importer grep before removal. PlanForm.tsx was flagged unused but
**retained** (recognized verify component class + scheduled Step-2 re-wiring);
it is allowlisted in `knip.json`.

| File | Why removed |
|------|-------------|
| `src/_archived-pages/invest.astro` | Unrouted archived page, zero importers |
| `src/_archived-pages/journey.astro` | Unrouted archived page, zero importers |
| `src/design-system/_deferred/EmptyState.astro` | Deferred design-system component, zero importers |
| `src/design-system/_deferred/OfflineReadyBanner.astro` | Deferred design-system component, zero importers |
| `src/design-system/_deferred/SegmentedControl.astro` | Deferred design-system component, zero importers |
| `src/design-system/_deferred/WhatsNewBanner.tsx` | Deferred design-system component, zero importers |
| `src/components/InfoCallout.astro` | UX meta-instruction removed from module pages during source-fidelity sweep; leftover |
| `src/components/Modal.astro` | Generic modal primitive, zero importers, superseded by ExternalLinkModal |
| `src/design-system/blocks/GuideTable.astro` | Artifact of the reverted Keystatic/content-collections line |
| `src/design-system/blocks/ChecklistRow.tsx` | Reachable only via the unused barrel; superseded by DataTable/Todo |
| `src/design-system/blocks/ChecklistSection.tsx` | Used only by InteractiveChecklist (also removed) + the unused barrel |
| `src/design-system/blocks/InteractiveChecklist.tsx` | Superseded by DataTable/Todo/SlotCollection; barrel-only |
| `src/design-system/blocks/index.ts` | Barrel with zero importers; Todo/SlotCollection are imported directly |
| `src/lib/icons.ts` | Pre-MVP icon helper, superseded by lucide-react, zero importers |

### Navigation orphan cluster (same sweep)

Documented dead in TODOS; removed in buildable order per its recipe.

| File | Why removed |
|------|-------------|
| `src/lib/navigation.ts` | `getModuleSections()` leftover from the dynamic-routing era; all sections now carry inline `sectionData`. Zero importers. |
| `src/content/modules/baseline-resilience.yaml` | Parsed/validated at build but never read; only consumer was `navigation.ts`. |
| `src/content/modules/emergency-preparedness.yaml` | Same — duplicate of the now-authoritative inline section data. |
| `modules` collection in `src/content.config.ts` | Definition + zod schema removed (sourceSpecs collection retained — verify depends on it). |

### Evaluated, retained (not removed)

- `src/components/PlanForm.tsx` — flagged by knip, but it is a verify-recognized
  content-component class and TODOS schedules a Step-2 re-wiring. Allowlisted.
- `rt-templates/` — gitignored class-(b) source material (operational spreadsheet
  templates). No active source-spec cites it today, but it is the third content
  layer and may be wired later, so it is retained, not scrapped.

To recover any removed file: `git show archive/w2-orphan-sweep~1:<path>` or
`git checkout archive/w2-orphan-sweep~1 -- <path>`.

## CI gate scope decision (2026-06-08)

The CI `knip` gate (`pnpm knip:files`, in the `verify` job) checks **unused
files only** — not unused exports or dependencies.

**Why files-only for now:** orphaned *files* re-accumulating is the root cause
this cleanup targets, and a files-only gate stays green and meaningful. A
full-strength gate (exports + types) would immediately fail CI on the
source-fidelity verifier's deliberate internal API — it exports ~48 functions and ~28 types
that are part of its contract, not dead code. Pruning or allowlisting all of
those is out of scope for the foundation cleanup and would risk the Source
Fidelity machinery.

**Revisit later:** we may widen the gate to exports/deps once the verifier's
public surface is audited and an intentional-export allowlist is curated. Until
then, run `pnpm knip` locally for the full report (files + exports + deps).

## 2026-07-18 — backup journey revamp (streak retirement)

| File | Why removed |
|------|-------------|
| `src/components/StreakGoalCard.tsx` | Streak and goal card retired from the dashboard: a broken streak reads as shame, and safety is never gamified here. The underlying metadata is untouched; only the card is gone. Recover from git history. |
| `src/components/ExportDataButton.tsx` | Absorbed into the dashboard safety card island (one backup surface, one vocabulary). Recover from git history. |
| `src/components/ImportDataButton.tsx` | Absorbed into the restore zone island, which adds the preview-before-anything-changes step. Recover from git history. |

## 2026-07-18 — dashboard design-review fix pass

Operator design review of the built dashboard overrode parts of the ratified
spec. Two surfaces were pulled entirely (each due its own redesign later), which
orphaned their files under the files-only `knip` gate.

| File | Why removed |
|------|-------------|
| `src/components/WhatsNewCard.tsx` | Pulled from the dashboard: the What's New / changelog card is due its own redesign outside this scope, and it was the card's only mount point. The changelog itself still lives at `/changelog`. Recover from git history. |
| `src/pages/recovery-card.astro` | The printable recovery card (DR11) is rethought in a future cycle; the standalone page did not carry a backup control and read as a wasted surface. The precache regenerates from `dist/` automatically; its phone-relay e2e assertion was removed with it. Recover from git history. |

## 2026-07-18 — dashboard rail redesign (quiet secondary column)

The dashboard's secondary column was a mini-dashboard-within-the-dashboard (3-up
metric cards, a recent-activity feed, a two-column progress grid) that out-shouted
the safety answer and crushed in the narrow rail. It is replaced by a single quiet
`WorkProgress` list (progress, notes, links), which orphaned the old component.

| File | Why removed |
|------|-------------|
| `src/components/UserProgressDashboard.tsx` | Retired from the dashboard rail. Its metric cards, activity feed, and off-system blue/amber chips were the inverted-hierarchy problem the redesign fixes; replaced by `WorkProgress.tsx` (a quiet, chroma-0, navigational progress list). It was the component's only mount point. Recover from git history. |
