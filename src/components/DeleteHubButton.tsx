import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteHub } from '../lib/supabase';

interface DeleteHubButtonProps {
  hubId: string;
  hubName: string;
  onDeleted?: () => void;
}

export default function DeleteHubButton({ hubId, hubName, onDeleted }: DeleteHubButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (confirmText !== hubName) {
      setError('Hub name does not match');
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await deleteHub(hubId);

      // Success - close modal and notify parent
      setShowModal(false);
      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      console.error('[DeleteHubButton] Error deleting hub:', err);
      setError('Failed to delete hub. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setConfirmText('');
    setError('');
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-destructive hover:bg-destructive/10 transition-all duration-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        type="button"
        aria-label="Delete hub"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Hub
            </h3>
            <p className="text-muted-foreground mb-4">
              This action cannot be undone. This will permanently delete the hub and all associated data.
            </p>
            <p className="text-foreground mb-2 font-medium">
              Type <span className="font-bold text-destructive">{hubName}</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground placeholder:text-muted-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={hubName}
              disabled={isDeleting}
            />
            {error && (
              <p className="text-destructive text-sm mb-4">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-foreground bg-background border border-border rounded-lg hover:bg-muted font-medium transition-all duration-default"
                disabled={isDeleting}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-medium transition-all duration-default disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeleting || confirmText !== hubName}
                type="button"
              >
                {isDeleting ? 'Deleting...' : 'Delete Hub'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
