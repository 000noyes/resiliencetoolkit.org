/**
 * Recovery Continuum data — shape invariants.
 *
 * Guards the structure RecoveryContinuum.astro relies on: exactly five FEMA
 * phases, exactly one external Long-term (LTRG) destination, exactly one
 * incomplete open-ring phase, internal nodes that resolve to real /workflows
 * routes, and an attributed source on every activity (the source-fidelity
 * discipline for the NDRF-derived recovery text). Also confirms every activity
 * cross-walk points at a real toolkit module page, so a stale link cannot ship.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recoveryPhases } from './recovery-continuum';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Resolve a site route to its concrete Astro page file (`route.astro` or `route/index.astro`). */
function routeFileExists(route: string): boolean {
  const rel = route.replace(/^\//, '').replace(/\/$/, '');
  return (
    existsSync(resolve(projectRoot, 'src/pages', `${rel}.astro`)) ||
    existsSync(resolve(projectRoot, 'src/pages', rel, 'index.astro'))
  );
}

describe('recovery continuum data', () => {
  it('has exactly five phases', () => {
    expect(recoveryPhases).toHaveLength(5);
  });

  it('has exactly one external (LTRG) phase', () => {
    expect(recoveryPhases.filter((p) => p.external)).toHaveLength(1);
  });

  it('has exactly one incomplete (open-ring) phase', () => {
    expect(recoveryPhases.filter((p) => p.incomplete)).toHaveLength(1);
  });

  it('makes the external phase the incomplete Long-term node', () => {
    const external = recoveryPhases.find((p) => p.external);
    expect(external?.incomplete).toBe(true);
  });

  it('has exactly one Disaster pivot that is neither a link nor a content node', () => {
    const pivots = recoveryPhases.filter((p) => p.pivot);
    expect(pivots).toHaveLength(1);
    expect(pivots[0].href).toBeUndefined();
    expect(pivots[0].activities ?? []).toHaveLength(0);
  });

  it('routes every internal node to a real /workflows route', () => {
    const internal = recoveryPhases.filter((p) => p.href && !p.external && !p.pivot);
    expect(internal.length).toBeGreaterThan(0);
    for (const phase of internal) {
      expect(phase.href!.startsWith('/workflows/')).toBe(true);
      expect(routeFileExists(phase.href!), `${phase.href} should resolve to a page`).toBe(true);
    }
  });

  it('gives every activity a non-empty source', () => {
    const activities = recoveryPhases.flatMap((p) => p.activities ?? []);
    expect(activities.length).toBeGreaterThan(0);
    for (const a of activities) {
      expect(a.source.trim().length).toBeGreaterThan(0);
    }
  });

  it('cross-walks activities only to real toolkit module routes', () => {
    const moduleHrefs = recoveryPhases
      .flatMap((p) => p.activities ?? [])
      .map((a) => a.moduleHref)
      .filter((h): h is string => Boolean(h));
    for (const href of moduleHrefs) {
      expect(routeFileExists(href), `${href} should resolve to a page`).toBe(true);
    }
  });
});
