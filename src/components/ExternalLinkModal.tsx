import { useEffect, useRef, useState } from 'react';
import { Shield, Lock, X } from 'lucide-react';

interface ExternalLinkModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
  onConfirm: (rememberDomain: boolean) => void;
}

export default function ExternalLinkModal({
  isOpen,
  url,
  onClose,
  onConfirm,
}: ExternalLinkModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [rememberDomain, setRememberDomain] = useState(false);

  // Extract domain from URL
  const getDomain = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };

  // Check if URL is HTTPS
  const isHttps = url.startsWith('https://');
  const domain = getDomain(url);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      // Reset checkbox state when modal opens
      setRememberDomain(false);
      // Focus the confirm button when modal opens
      setTimeout(() => confirmButtonRef.current?.focus(), 0);
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Handle escape key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const clickedOutside =
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom;

      if (clickedOutside) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    dialog.addEventListener('keydown', handleTabKey);
    return () => dialog.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      className="external-link-modal"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      aria-modal="true"
    >
      <div className="external-link-modal__content">
        {/* Close button */}
        <button
          onClick={onClose}
          className="external-link-modal__close"
          aria-label="Close dialog"
          type="button"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="external-link-modal__icon">
          <Shield size={32} strokeWidth={2} />
        </div>

        {/* Title */}
        <h2 id="modal-title" className="external-link-modal__title">
          External Link
        </h2>

        {/* Domain */}
        <div className="external-link-modal__domain">
          {domain}
        </div>

        {/* Full URL */}
        <div className="external-link-modal__url-container">
          <div className="external-link-modal__url">
            {isHttps && (
              <span className="external-link-modal__https-indicator" aria-label="Secure connection">
                <Lock size={12} />
              </span>
            )}
            <code>{url}</code>
          </div>
        </div>

        {/* Description */}
        <p id="modal-description" className="external-link-modal__description">
          This link will open in a new tab. Make sure you trust the destination before continuing.
        </p>

        {/* Remember Domain Checkbox */}
        <label className="external-link-modal__checkbox-label">
          <input
            type="checkbox"
            checked={rememberDomain}
            onChange={(e) => setRememberDomain(e.target.checked)}
            className="external-link-modal__checkbox"
          />
          <span className="external-link-modal__checkbox-text">
            Don't ask again for {domain}
          </span>
        </label>

        {/* Actions */}
        <div className="external-link-modal__actions">
          <button
            ref={confirmButtonRef}
            onClick={() => onConfirm(rememberDomain)}
            className="external-link-modal__button external-link-modal__button--primary"
            type="button"
          >
            Open Link
          </button>
          <button
            onClick={onClose}
            className="external-link-modal__button external-link-modal__button--secondary"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}
