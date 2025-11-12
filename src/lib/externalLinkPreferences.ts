/**
 * External Link Preferences
 *
 * Manages user preferences for trusted external link domains.
 * Stores preferences in localStorage for quick access.
 */

const STORAGE_KEY = 'externalLinkPreferences';

export interface DomainPreference {
  alwaysAllow: boolean;
  addedAt: string;
}

export interface ExternalLinkPreferences {
  [domain: string]: DomainPreference;
}

/**
 * Get all trusted domain preferences from localStorage
 */
export function getTrustedDomains(): ExternalLinkPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ExternalLinkPreferences;
  } catch (error) {
    console.error('Failed to read external link preferences:', error);
    return {};
  }
}

/**
 * Check if a specific domain is trusted
 */
export function isDomainTrusted(domain: string): boolean {
  const preferences = getTrustedDomains();
  return preferences[domain]?.alwaysAllow === true;
}

/**
 * Add a domain to the trusted list
 */
export function addTrustedDomain(domain: string): void {
  try {
    const preferences = getTrustedDomains();
    preferences[domain] = {
      alwaysAllow: true,
      addedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save external link preference:', error);
  }
}

/**
 * Remove a domain from the trusted list
 */
export function removeTrustedDomain(domain: string): void {
  try {
    const preferences = getTrustedDomains();
    delete preferences[domain];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to remove external link preference:', error);
  }
}

/**
 * Clear all trusted domain preferences
 */
export function clearAllTrustedDomains(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear external link preferences:', error);
  }
}

/**
 * Get the count of trusted domains
 */
export function getTrustedDomainCount(): number {
  const preferences = getTrustedDomains();
  return Object.keys(preferences).length;
}

/**
 * Get array of trusted domain names (for display in settings)
 */
export function getTrustedDomainList(): Array<{ domain: string; addedAt: string }> {
  const preferences = getTrustedDomains();
  return Object.entries(preferences)
    .filter(([_, pref]) => pref.alwaysAllow)
    .map(([domain, pref]) => ({
      domain,
      addedAt: pref.addedAt,
    }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt)); // Most recent first
}
