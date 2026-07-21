// @vitest-environment node
/**
 * "Your progress" count reconciliation.
 *
 * The dashboard shows saved work in two places: this navigation list ("Your
 * progress") and the safety card's "Work on this device" meter. They must
 * agree on the number for any module both list. The meter counts checked todos
 * plus filled table rows; aggregate() must count the same, so a module with
 * saved rows but nothing checked no longer reads "0 items" here while the meter
 * shows those rows.
 */
import { describe, it, expect } from 'vitest';
import { aggregate } from './WorkProgress';
import type { ModuleProgress } from '@/lib/storage';

function mod(partial: Partial<ModuleProgress> & { moduleKey: string; displayName: string }): ModuleProgress {
  return {
    totalTodos: 0,
    completedTodos: 0,
    percentage: 0,
    tableRowCount: 0,
    lastActivity: null,
    ...partial,
  };
}

describe('aggregate — Your progress counts checked items plus filled rows', () => {
  it('counts a module whose only saved work is filled table rows (the ignored-rows bug)', () => {
    // Emergency Preparedness: nothing checked, three filled rows. The meter
    // reports 3; "Your progress" used to report 0.
    const parents = aggregate([
      mod({ moduleKey: 'emergency-preparedness-kits', displayName: 'Emergency Kits', completedTodos: 0, tableRowCount: 3 }),
    ]);
    const emergency = parents.find((p) => p.key === 'emergency-preparedness')!;
    expect(emergency.count).toBe(3);
    const kits = emergency.sections.find((s) => s.key === 'emergency-preparedness-kits')!;
    expect(kits.count).toBe(3);
  });

  it('sums checked todos and filled rows within a module', () => {
    const parents = aggregate([
      mod({ moduleKey: 'food-and-water', displayName: 'Food & Water', completedTodos: 2, tableRowCount: 4 }),
    ]);
    const emergency = parents.find((p) => p.key === 'emergency-preparedness')!;
    expect(emergency.count).toBe(6);
  });

  it('rolls the parent count up across its own key and its children', () => {
    const parents = aggregate([
      mod({ moduleKey: 'emergency-preparedness', displayName: 'Emergency Preparedness', completedTodos: 1 }),
      mod({ moduleKey: 'food-and-water', displayName: 'Food & Water', completedTodos: 0, tableRowCount: 2 }),
      mod({ moduleKey: 'mutual-aid', displayName: 'Mutual Aid', completedTodos: 3 }),
    ]);
    const emergency = parents.find((p) => p.key === 'emergency-preparedness')!;
    expect(emergency.count).toBe(6); // 1 + 2 + 3
  });

  it('does not count an unchecked todo with no filled rows as progress', () => {
    // A checked-then-unchecked (completed:false) record is saved but is not
    // work on this list: totalTodos is 1, but count stays 0.
    const parents = aggregate([
      mod({ moduleKey: 'food-and-water', displayName: 'Food & Water', totalTodos: 1, completedTodos: 0, tableRowCount: 0 }),
    ]);
    const emergency = parents.find((p) => p.key === 'emergency-preparedness')!;
    expect(emergency.count).toBe(0);
    expect(emergency.sections.every((s) => s.count === 0)).toBe(true);
  });

  it('always returns the three top-level modules in fixed order', () => {
    const parents = aggregate([]);
    expect(parents.map((p) => p.key)).toEqual([
      'knowing-your-community',
      'emergency-preparedness',
      'baseline-resilience',
    ]);
    expect(parents.every((p) => p.count === 0)).toBe(true);
  });
});
