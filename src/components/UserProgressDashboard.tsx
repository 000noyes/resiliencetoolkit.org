import React, { useEffect, useState } from 'react';
import {
  getOverallStats,
  getRecentActivity,
  getModuleProgress,
  type OverallStats,
  type ActivityItem,
  type ModuleProgress,
} from '@/lib/storage';
import {
  CheckCircle2,
  Clock,
  BarChart3,
  FileText,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Activity,
} from 'lucide-react';

interface UserProgressDashboardProps {
  className?: string;
}

/**
 * Format relative time from ISO timestamp
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format module key to display name (for activity feed)
 */
function formatModuleKeyDisplay(key: string): string {
  const displayNames: Record<string, string> = {
    'emergency-preparedness': 'Emergency Preparedness',
    'emergency-preparedness-kits': 'Emergency Kits',
    'food-and-water': 'Food & Water',
    'first-aid-medical': 'Medical Supplies',
    'power-supply': 'Power & Energy',
    'warming-cooling-shelter': 'Shelter',
    'vehicles-equipment': 'Vehicles',
    'sanitation-hygiene': 'Sanitation',
    'children-disaster': 'Special Populations',
    'senior-citizens': 'Special Populations',
    'people-with-disabilities': 'Special Populations',
    'lep-populations': 'Special Populations',
    'farm-animals': 'Special Populations',
    'flood-recovery': 'Flood Recovery',
    'mutual-aid': 'Mutual Aid',
    'knowing-your-community': 'Knowing Your Community',
    'knowing-community': 'Knowing Your Community',
    'bringing-people-together': 'Knowing Your Community',
    'baseline-resilience': 'Baseline Resilience',
    'basic-needs': 'Basic Needs',
    'shared-tools': 'Shared Tools',
    'community-building': 'Community Building',
  };

  return (
    displayNames[key] ||
    key
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

/**
 * Map section keys to parent module keys
 */
const EMERGENCY_PREP_KEYS = new Set([
  'emergency-preparedness-kits', 'food-and-water', 'first-aid-medical',
  'power-supply', 'warming-cooling-shelter', 'vehicles-equipment',
  'sanitation-hygiene', 'children-disaster', 'senior-citizens',
  'people-with-disabilities', 'lep-populations', 'farm-animals',
  'flood-recovery', 'mutual-aid',
]);

const BASELINE_KEYS = new Set([
  'basic-needs', 'shared-tools', 'community-building',
]);

const KNOWING_COMMUNITY_KEYS = new Set([
  'knowing-community', 'bringing-people-together',
]);

function getParentModule(moduleKey: string): string {
  if (moduleKey === 'emergency-preparedness' || EMERGENCY_PREP_KEYS.has(moduleKey)) return 'emergency-preparedness';
  if (moduleKey === 'baseline-resilience' || BASELINE_KEYS.has(moduleKey)) return 'baseline-resilience';
  if (moduleKey === 'knowing-your-community' || KNOWING_COMMUNITY_KEYS.has(moduleKey)) return 'knowing-your-community';
  return moduleKey;
}

/**
 * Parent module display names
 */
const PARENT_MODULE_NAMES: Record<string, string> = {
  'knowing-your-community': 'Knowing Your Community',
  'emergency-preparedness': 'Emergency Preparedness',
  'baseline-resilience': 'Baseline Resilience',
};

/**
 * Section within a parent module
 */
interface SectionProgress {
  moduleKey: string;
  displayName: string;
  completedTodos: number;
}

/**
 * Aggregate module progress by parent module with child sections
 * Always shows all 3 main modules, even with 0 progress
 */
interface AggregatedProgress {
  moduleKey: string;
  displayName: string;
  completedTodos: number;
  sections: SectionProgress[];
}

// Define the canonical order of parent modules
const PARENT_MODULE_ORDER = [
  'knowing-your-community',
  'emergency-preparedness',
  'baseline-resilience',
];

// Define all sections per parent module (always visible)
// Keys must match the moduleKey values used in page .astro templates
const PARENT_SECTIONS: Record<string, { key: string; name: string; extraKeys?: string[] }[]> = {
  'knowing-your-community': [], // No sub-sections; uses keys: knowing-community, bringing-people-together
  'emergency-preparedness': [
    { key: 'emergency-preparedness-kits', name: '1.1 Emergency Kits' },
    { key: 'food-and-water', name: '1.2 Food & Water' },
    { key: 'first-aid-medical', name: '1.3 Medical Supplies' },
    { key: 'power-supply', name: '1.4 Power & Energy' },
    { key: 'warming-cooling-shelter', name: '1.5 Shelter' },
    { key: 'vehicles-equipment', name: '1.6 Vehicles' },
    { key: 'sanitation-hygiene', name: '1.7 Sanitation' },
    { key: 'children-disaster', name: '1.8 Special Populations', extraKeys: ['senior-citizens', 'people-with-disabilities', 'lep-populations', 'farm-animals'] },
    { key: 'flood-recovery', name: '1.11 Flood Recovery' },
    { key: 'mutual-aid', name: '1.12 Mutual Aid' },
  ],
  'baseline-resilience': [
    { key: 'basic-needs', name: '2.1 Basic Needs' },
    { key: 'shared-tools', name: '2.2 Shared Tools' },
    { key: 'community-building', name: '2.3 Community Building' },
  ],
};

function aggregateByParentModule(moduleProgress: ModuleProgress[]): AggregatedProgress[] {
  // Build a lookup map for completed counts by moduleKey
  const completedByKey = new Map<string, number>();
  moduleProgress.forEach((mod) => {
    completedByKey.set(mod.moduleKey, mod.completedTodos);
  });

  // Build aggregated progress with all sections always visible
  return PARENT_MODULE_ORDER.map((parentKey) => {
    const sections = PARENT_SECTIONS[parentKey].map((section) => {
      // Sum the primary key + any extra keys (e.g. 1-8 has multiple sub-topic keys)
      let sectionCompleted = completedByKey.get(section.key) ?? 0;
      if (section.extraKeys) {
        for (const extra of section.extraKeys) {
          sectionCompleted += completedByKey.get(extra) ?? 0;
        }
      }
      return {
        moduleKey: section.key,
        displayName: section.name,
        completedTodos: sectionCompleted,
      };
    });

    // Sum up completed items from all sections + parent-level keys
    const parentCompleted = completedByKey.get(parentKey) ?? 0;
    // For knowing-your-community, also sum its sub-keys directly
    let extraParentCompleted = 0;
    if (parentKey === 'knowing-your-community') {
      extraParentCompleted += completedByKey.get('knowing-community') ?? 0;
      extraParentCompleted += completedByKey.get('bringing-people-together') ?? 0;
    }
    const sectionsCompleted = sections.reduce((sum, s) => sum + s.completedTodos, 0);

    return {
      moduleKey: parentKey,
      displayName: PARENT_MODULE_NAMES[parentKey],
      completedTodos: parentCompleted + extraParentCompleted + sectionsCompleted,
      sections,
    };
  });
}

/**
 * Section URL slugs mapping
 */
const SECTION_URL_SLUGS: Record<string, string> = {
  'emergency-preparedness-kits': '1-1',
  'food-and-water': '1-2',
  'first-aid-medical': '1-3',
  'power-supply': '1-4',
  'warming-cooling-shelter': '1-5',
  'vehicles-equipment': '1-6',
  'sanitation-hygiene': '1-7',
  'children-disaster': '1-8',
  'flood-recovery': '1-11',
  'mutual-aid': '1-12',
  'basic-needs': '2-1',
  'shared-tools': '2-2',
  'community-building': '2-3',
};

/**
 * Get module URL from module key
 */
function getModuleUrl(moduleKey: string): string {
  // Check for section-level URLs via slug lookup
  const slug = SECTION_URL_SLUGS[moduleKey];
  if (slug) {
    const parent = getParentModule(moduleKey);
    return `/modules/${parent}/${slug}`;
  }
  // Parent module URLs
  if (moduleKey === 'emergency-preparedness') {
    return '/modules/emergency-preparedness';
  }
  if (moduleKey === 'baseline-resilience') {
    return '/modules/baseline-resilience';
  }
  if (moduleKey === 'knowing-your-community') {
    return '/modules/knowing-your-community';
  }
  return '/modules';
}

export default function UserProgressDashboard({ className = '' }: UserProgressDashboardProps) {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  function toggleModuleExpand(moduleKey: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) {
        next.delete(moduleKey);
      } else {
        next.add(moduleKey);
      }
      return next;
    });
  }

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        const [statsData, activityData, progressData] = await Promise.all([
          getOverallStats(),
          getRecentActivity(5),
          getModuleProgress(),
        ]);

        if (mounted) {
          setStats(statsData);
          setRecentActivity(activityData);
          setModuleProgress(progressData);

          // Check if user has any data
          setHasData(
            statsData.totalTodos > 0 ||
              statsData.totalTableRows > 0 ||
              statsData.modulesStarted > 0
          );
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    // Listen for data changes
    const handleDataChange = () => {
      loadDashboardData();
    };

    document.addEventListener('todo-changed', handleDataChange);
    document.addEventListener('table-changed', handleDataChange);

    return () => {
      mounted = false;
      document.removeEventListener('todo-changed', handleDataChange);
      document.removeEventListener('table-changed', handleDataChange);
    };
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className={`space-y-6 animate-pulse ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-gray-200 dark:bg-gray-700 rounded-lg"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>
    );
  }

  // Empty state for new users — motivational CTA with module cards
  if (!hasData) {
    const starterModules = [
      { key: 'knowing-your-community', name: 'Knowing Your Community', desc: 'Map your local resources and connections', href: '/modules/knowing-your-community/0-1' },
      { key: 'emergency-preparedness', name: 'Emergency Preparedness', desc: 'Build your household emergency kit', href: '/modules/emergency-preparedness' },
      { key: 'baseline-resilience', name: 'Baseline Resilience', desc: 'Assess and improve community readiness', href: '/modules/baseline-resilience' },
    ];

    return (
      <div className={className}>
        <div className="py-8 px-6 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
          <div className="text-center mb-6">
            <div className="mb-3 inline-flex p-3 bg-primary/10 rounded-full">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
              Ready to start?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Pick a module to begin building your community's resilience.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {starterModules.map((mod) => (
              <a
                key={mod.key}
                href={mod.href}
                className="flex flex-col p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50 hover:shadow-md transition-all group no-underline"
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors mb-1">
                  {mod.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {mod.desc}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Progress */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Items Completed
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats?.completedTodos ?? 0}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            items completed
          </p>
        </div>

        {/* Modules Started */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Modules Started
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats?.modulesStarted ?? 0}
            </span>
          </div>
        </div>

        {/* Last Activity */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Last Activity
            </span>
          </div>
          <div className="text-lg font-medium text-gray-900 dark:text-white">
            {stats?.lastActivityDate
              ? formatRelativeTime(stats.lastActivityDate)
              : 'No activity yet'}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Activity & Module Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              Recent Activity
            </h3>
          </div>
          <div className="p-4">
            {recentActivity.length > 0 ? (
              <ul className="space-y-3">
                {recentActivity.map((activity, idx) => (
                  <li
                    key={`${activity.moduleKey}-${activity.itemId}-${idx}`}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div
                      className={`p-1.5 rounded-md ${
                        activity.type === 'todo_completed'
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-blue-100 dark:bg-blue-900/20'
                      }`}
                    >
                      {activity.type === 'todo_completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {activity.type === 'todo_completed'
                          ? 'Completed checklist item'
                          : 'Updated worksheet'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatModuleKeyDisplay(activity.moduleKey)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>

        {/* Module Progress */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              Progress by Module
            </h3>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            <ul className="space-y-2">
              {aggregateByParentModule(moduleProgress).map((module) => {
                const isExpanded = expandedModules.has(module.moduleKey);
                const hasSections = module.sections.length > 0;

                return (
                  <li key={module.moduleKey}>
                    {/* Parent module row */}
                    <div className="flex items-center gap-1">
                      {hasSections ? (
                        <button
                          onClick={() => toggleModuleExpand(module.moduleKey)}
                          className="p-1 -ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="w-6" /> // Spacer for alignment
                      )}
                      <a
                        href={getModuleUrl(module.moduleKey)}
                        className="flex-1 flex items-center justify-between py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                          {module.displayName}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {module.completedTodos} item{module.completedTodos !== 1 ? 's' : ''}
                        </span>
                      </a>
                    </div>

                    {/* Child sections (collapsible) */}
                    {isExpanded && hasSections && (
                      <ul className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {module.sections.map((section) => (
                          <li key={section.moduleKey}>
                            <a
                              href={getModuleUrl(section.moduleKey)}
                              className="flex items-center justify-between py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
                            >
                              <span>{section.displayName}</span>
                              <span className="text-xs">
                                {section.completedTodos} item{section.completedTodos !== 1 ? 's' : ''}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
