import FeedbackWidget from './FeedbackWidget.tsx';

/**
 * Hook-heavy React islands must be shielded from Astro's renderer probes,
 * so this wrapper exposes a hook-free component that the renderer can call
 * safely while the real widget only runs during actual React rendering.
 */
export default function FeedbackWidgetWrapper() {
  return <FeedbackWidget />;
}
