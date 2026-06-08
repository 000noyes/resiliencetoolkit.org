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
