import { Megaphone, ArrowRight } from 'lucide-react';
import { getSortedEntries } from '../data/changelog';

function WhatsNewCardInner() {
  const entries = getSortedEntries().slice(0, 3);

  if (entries.length === 0) return null;

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" strokeWidth={1.5} />
          What's New
        </h2>
        <a
          href="/changelog"
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
        >
          View all updates
          <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </a>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <a
            key={entry.id}
            href={`/changelog#entry-${entry.id}`}
            className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <time dateTime={entry.isoDate}>{entry.date}</time>
                </p>
                <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                  {entry.title}
                </h3>
                {entry.summary[0] && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {entry.summary[0]}
                  </p>
                )}
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors shrink-0 mt-1" strokeWidth={1.5} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * Wrapper to prevent Astro's renderer probe from invoking hooks directly.
 */
export default function WhatsNewCard() {
  return <WhatsNewCardInner />;
}
