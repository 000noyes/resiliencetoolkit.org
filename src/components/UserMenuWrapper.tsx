import UserMenu from './UserMenu.tsx';

/**
 * Astro's React renderer probes components by invoking them outside of
 * React's dispatcher. Wrapping hook-using islands in a hook-free shell
 * prevents those probe calls from tripping "Invalid hook call" warnings.
 */
export default function UserMenuWrapper() {
  return <UserMenu />;
}
