import React, { useCallback, useEffect, useState } from 'react';
import {
  getModuleProgress,
  getOverallStats,
  getPersonalNotes,
  type ModuleProgress,
} from '@/lib/storage';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { PARENT_ORDER, PARENT_NAMES, parentOf } from '@/lib/module-taxonomy';

/**
 * The secondary column's progress list: the quiet "Your progress" section of
 * the dashboard rail. Three parent modules, each a row linking back into the
 * work, with an optional drill-down to its sections. No metric cards, no
 * activity feed, no categorical color. This is navigation ("pick back up"),
 * the honest counterpart to the safety card's meter ("what a backup saves").
 *
 * It also owns the page's work-state signal: on load it sets
 * #dash[data-work] to "has" or "empty", which drives the single-column empty
 * layout (no side rail, no canyon) vs the two-column working layout. The
 * inline head script sets an early guess from the has-work canary to avoid a
 * layout flash; this authoritative read (which also counts notes-only work)
 * corrects it.
 */

const SECTION_SLUGS: Record<string, string> = {
  'emergency-preparedness-kits': '1-1', 'food-and-water': '1-2', 'first-aid-medical': '1-3',
  'power-supply': '1-4', 'warming-cooling-shelter': '1-5', 'vehicles-equipment': '1-6',
  'sanitation-hygiene': '1-7', 'children-disaster': '1-8', 'flood-recovery': '1-11',
  'mutual-aid': '1-12', 'basic-needs': '2-1', 'shared-tools': '2-2', 'community-building': '2-3',
};

function urlFor(k: string): string {
  const slug = SECTION_SLUGS[k];
  if (slug) return `/modules/${parentOf(k)}/${slug}`;
  if (PARENT_ORDER.includes(k)) return `/modules/${k}`;
  return '/modules';
}

interface Section {
  key: string;
  name: string;
  count: number;
}
interface Parent {
  key: string;
  name: string;
  count: number;
  sections: Section[];
}

/**
 * Saved work in a module: checked items plus filled table rows. This is the
 * same quantity the safety card's "Work on this device" meter reports (its
 * rows are already blank-row filtered upstream), so the two dashboard surfaces
 * show the same number for any module both list. completedTodos alone dropped
 * table work to zero: a module with saved rows but nothing checked read
 * "0 items" here while the meter showed those rows.
 */
function savedWork(m: ModuleProgress): number {
  return m.completedTodos + m.tableRowCount;
}

export function aggregate(progress: ModuleProgress[]): Parent[] {
  const byKey = new Map<string, number>();
  progress.forEach((m) => byKey.set(m.moduleKey, savedWork(m)));
  return PARENT_ORDER.map((pk) => {
    let count = byKey.get(pk) ?? 0;
    const sections: Section[] = [];
    progress.forEach((m) => {
      if (m.moduleKey !== pk && parentOf(m.moduleKey) === pk) {
        sections.push({ key: m.moduleKey, name: m.displayName, count: savedWork(m) });
        count += savedWork(m);
      }
    });
    return {
      key: pk,
      name: PARENT_NAMES[pk],
      count,
      sections: sections.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

export default function WorkProgress() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const progress = await getModuleProgress();
      const stats = await getOverallStats();
      const notes = await getPersonalNotes();
      setParents(aggregate(progress));
      setLoaded(true);
      const hasWork = stats.totalTodos > 0 || stats.totalTableRows > 0 || notes.length > 0;
      const el = typeof document !== 'undefined' ? document.getElementById('dash') : null;
      if (el) el.dataset.work = hasWork ? 'has' : 'empty';
    } catch {
      // storage unreadable: leave the layout at its pre-resolved guess
    }
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    document.addEventListener('todo-changed', onChange);
    document.addEventListener('table-changed', onChange);
    return () => {
      document.removeEventListener('todo-changed', onChange);
      document.removeEventListener('table-changed', onChange);
    };
  }, [load]);

  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  if (!loaded) return <div className="h-32 rounded-lg bg-muted animate-pulse" />;

  return (
    <section aria-label="Your progress">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Your progress
      </h2>
      <ul className="mt-3 space-y-0.5">
        {parents.map((p) => {
          // A progress list shows real work, not pages merely opened. Drill
          // down only into child sections that have saved work (a checked item
          // or a filled row) AND a name distinct from the parent, so glanced-at
          // 0-work modules and the single child that duplicates its parent name
          // (knowing-community and bringing-people-together both display as
          // "Knowing Your Community") never surface as noise. The parent count
          // still rolls up all work.
          const drilldown = p.sections.filter((s) => s.count > 0 && s.name !== p.name);
          const isOpen = expanded.has(p.key);
          const hasSections = drilldown.length > 0;
          return (
            <li key={p.key}>
              <div className="flex items-center">
                {hasSections ? (
                  <button
                    type="button"
                    onClick={() => toggle(p.key)}
                    className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={isOpen ? `Collapse ${p.name}` : `Expand ${p.name}`}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                ) : (
                  <span className="w-5" aria-hidden="true" />
                )}
                <a
                  href={urlFor(p.key)}
                  className="flex-1 flex items-center justify-between py-1.5 rounded hover:bg-muted transition-colors group no-underline"
                >
                  <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">{items(p.count)}</span>
                </a>
              </div>
              {isOpen && hasSections && (
                <ul className="ml-5 border-l border-border pl-3 space-y-0.5">
                  {drilldown.map((s) => (
                    <li key={s.key}>
                      <a
                        href={urlFor(s.key)}
                        className="flex items-center justify-between py-1 text-sm text-muted-foreground hover:text-primary transition-colors no-underline"
                      >
                        <span>{s.name}</span>
                        <span className="text-xs tabular-nums">{items(s.count)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
