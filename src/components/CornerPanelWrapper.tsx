import CornerPanel from './CornerPanel.tsx';

/**
 * Hook-heavy React islands must be shielded from Astro's renderer probes,
 * so this wrapper exposes a hook-free component that the renderer can call
 * safely while the real panel only runs during actual React rendering.
 */
export default function CornerPanelWrapper() {
  return <CornerPanel />;
}
