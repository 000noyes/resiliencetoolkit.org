import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// /workflows renders PhaseSlider WITHOUT the homepage's showDescriptions opt-in.
// These assertions prove the default-off contract: the phase descriptions the
// homepage folds into the cards must never leak onto /workflows, while the two
// deliberate phases.ts lead changes (shared data) DO appear here.
// dist/ is gitignored build output — assertions skip when it is absent.
// Run `pnpm build` then `pnpm vitest run tests/build/workflows-phase-cards.test.ts`.

const distDir = path.resolve(__dirname, '../../dist');
const workflowsHtmlPath = path.join(distDir, 'workflows', 'index.html');
const WORKFLOWS_PRESENT = existsSync(workflowsHtmlPath);

const PHASE_DESCRIPTIONS = [
  'Map assets, build networks, prepare supplies, and train volunteers before disaster strikes.',
  'Coordinate response, track needs, manage volunteers, and communicate with your community.',
  'Track recovery progress, support rebuilding, and strengthen long-term community resilience.',
];

describe('workflows phase cards (descriptions default-off)', () => {
  const html = WORKFLOWS_PRESENT ? readFileSync(workflowsHtmlPath, 'utf-8') : '';

  it.skipIf(!WORKFLOWS_PRESENT)('renders NO phase descriptions (showDescriptions defaults off)', () => {
    for (const description of PHASE_DESCRIPTIONS) {
      expect(html).not.toContain(description);
    }
  });

  it.skipIf(!WORKFLOWS_PRESENT)('During card carries the "If you are in it now" lead', () => {
    expect(html).toContain('If you are in it now');
  });

  it.skipIf(!WORKFLOWS_PRESENT)('After card lead is "In progress" (old lead and sr-only duplication gone)', () => {
    expect(html).toContain('In progress');
    expect(html).not.toContain('Help shape this path');
    expect(html).not.toContain('in progress, help shape this path');
  });
});
