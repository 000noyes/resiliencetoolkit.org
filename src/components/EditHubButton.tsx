import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { updateHub } from '../lib/supabase';

interface EditHubButtonProps {
  hubId: string;
  hubName: string;
  hubDescription?: string | null;
  hubLocation?: string | null;
  hubTimezone?: string;
  onUpdated?: () => void;
}

export default function EditHubButton({
  hubId,
  hubName,
  hubDescription,
  hubLocation,
  hubTimezone,
  onUpdated,
}: EditHubButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState(hubName);
  const [description, setDescription] = useState(hubDescription || '');
  const [location, setLocation] = useState(hubLocation || '');
  const [timezone, setTimezone] = useState(hubTimezone || 'America/New_York');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Hub name is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await updateHub(hubId, {
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        timezone,
      });

      // Success - close modal and notify parent
      setShowModal(false);
      if (onUpdated) {
        onUpdated();
      }
    } catch (err) {
      console.error('[EditHubButton] Error updating hub:', err);
      setError(err instanceof Error ? err.message : 'Failed to update hub. Please try again.');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    // Reset form to original values
    setName(hubName);
    setDescription(hubDescription || '');
    setLocation(hubLocation || '');
    setTimezone(hubTimezone || 'America/New_York');
    setError('');
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-primary hover:bg-primary/10 transition-all duration-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        aria-label="Edit hub"
      >
        <Pencil className="w-4 h-4" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Edit Hub
            </h3>

            <div className="space-y-4">
              {/* Hub Name */}
              <div>
                <label htmlFor="hub-name" className="block text-sm font-medium text-foreground mb-1">
                  Hub Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="hub-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter hub name"
                  disabled={isSaving}
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="hub-description" className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  id="hub-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Optional description"
                  rows={3}
                  disabled={isSaving}
                />
              </div>

              {/* Location */}
              <div>
                <label htmlFor="hub-location" className="block text-sm font-medium text-foreground mb-1">
                  Location
                </label>
                <input
                  id="hub-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g., River's Bend, Sprucetown"
                  disabled={isSaving}
                />
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="hub-timezone" className="block text-sm font-medium text-foreground mb-1">
                  Timezone
                </label>
                <select
                  id="hub-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isSaving}
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="America/Anchorage">Alaska Time</option>
                  <option value="Pacific/Honolulu">Hawaii Time</option>
                </select>
              </div>

              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-foreground bg-background border border-border rounded-lg hover:bg-muted font-medium transition-all duration-default"
                disabled={isSaving}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium transition-all duration-default disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSaving || !name.trim()}
                type="button"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
