import React, { useEffect, useState } from 'react';
import { Plus, X, Sprout } from 'lucide-react';

/**
 * The corner panel, successor to the "Have Questions?" pill. Closed, it is
 * an icon-only plus button (the phone speed-dial convention: a small set of
 * actions lives here). Open, it holds one row per door that really opens:
 * Questions (the mailto modal the pill always led to) and Fund this work
 * (the coalition's donate paths). Doors that do not open yet do not render.
 *
 * `staticOpen` is the workshop round-page mode: the panel renders open,
 * build-time, with no client JS. The proposal under review, inert.
 */

const CONTACT_EMAIL = 'resiliencetoolkit@gocros.org';
const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=THSYSAQ43SVBS';

function ModalShell(props: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={props.onClose}
    >
      <div
        className="relative w-full max-w-[640px] bg-card border border-border rounded-lg shadow-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby={props.titleId}
      >
        {props.children}
      </div>
    </div>
  );
}

/**
 * The Questions door destination: the same mailto form the pill offered,
 * with the literal address visible as the always-works fallback.
 */
export function QuestionsModal(props: { onClose: () => void }) {
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    const subject = encodeURIComponent('Resilience Toolkit Feedback');
    const body = encodeURIComponent(feedback);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setIsSubmitted(true);
  };

  return (
    <ModalShell titleId="questions-modal-title" onClose={props.onClose}>
      <div className="p-lg border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="questions-modal-title" className="text-title font-semibold text-foreground">
              Have Questions?
            </h2>
            <p className="text-body-small text-muted-foreground mt-xxs">
              Tell us what's working and what isn't. That's how the toolkit improves.
            </p>
          </div>
          <button
            onClick={props.onClose}
            className="ml-md -mt-xxs p-xxs rounded-lg hover:bg-muted transition-colors duration-default"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-lg">
          {isSubmitted ? (
            <div className="text-center py-xl">
              <p className="text-body font-medium text-foreground">
                Check your email app to send it.
              </p>
              <p className="text-body-small text-muted-foreground mt-xs">
                If it didn't open, email us directly at{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <button
                type="button"
                onClick={props.onClose}
                className="mt-md h-10 px-lg rounded-lg border border-border bg-background text-body font-medium text-foreground hover:bg-muted transition-all duration-default"
              >
                Close
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor="questions-textarea"
                className="block text-label font-medium text-foreground mb-xs"
              >
                What are you noticing?
              </label>
              <textarea
                id="questions-textarea"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What's working? What's confusing? What's missing?"
                rows={5}
                className="w-full px-md py-md border border-border rounded-lg bg-input text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-default ease-default shadow-ambient resize-none"
                required
              />
            </div>
          )}
        </div>

        {!isSubmitted && (
          <div className="p-lg border-t border-border flex justify-end gap-sm">
            <button
              type="button"
              onClick={props.onClose}
              className="h-10 px-lg rounded-lg border border-border bg-background text-body font-medium text-foreground hover:bg-muted transition-all duration-default shadow-sm hover:shadow-raised active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!feedback.trim()}
              className="h-10 px-lg rounded-lg bg-primary text-primary-foreground text-body font-medium shadow-sm hover:shadow-raised transition-all duration-default active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-sm"
            >
              Send
            </button>
          </div>
        )}
      </form>
    </ModalShell>
  );
}

/** The fund door destination, in the coalition's own words. */
export function FundModal(props: { onClose: () => void }) {
  return (
    <ModalShell titleId="fund-modal-title" onClose={props.onClose}>
      <div className="p-lg border-b border-border">
        <div className="flex items-start justify-between">
          <h2 id="fund-modal-title" className="text-title font-semibold text-foreground">
            Fund this work
          </h2>
          <button
            onClick={props.onClose}
            className="ml-md -mt-xxs p-xxs rounded-lg hover:bg-muted transition-colors duration-default"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="p-lg">
        <p className="text-body text-foreground">
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Donate online
          </a>{' '}
          or mail a check to Community Resilience Organizations, P.O. Box 1002, Montpelier, VT
          05602.
        </p>
        <p className="text-body text-foreground mt-sm">Put Toolkit in the memo.</p>
      </div>
    </ModalShell>
  );
}

interface DoorRowProps {
  icon: React.ReactNode;
  label: string;
  subline: string;
  onOpen?: () => void;
}

function DoorRow(props: DoorRowProps) {
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="w-full min-h-[44px] flex items-center gap-md p-md border border-border rounded-xl bg-background text-left hover:bg-muted transition-colors duration-default"
    >
      <span aria-hidden="true" className="shrink-0 flex items-center justify-center">
        {props.icon}
      </span>
      <span>
        <span className="block text-body font-medium text-foreground">{props.label}</span>
        <span className="block text-body-small text-muted-foreground">{props.subline}</span>
      </span>
    </button>
  );
}

export default function CornerPanel({ staticOpen = false }: { staticOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(staticOpen);
  const [door, setDoor] = useState<'questions' | 'fund' | null>(null);

  // Esc closes whatever is open, panel or modal (modals also close on scrim
  // tap and their own close buttons).
  useEffect(() => {
    if (staticOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDoor(null);
      setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [staticOpen]);

  const openDoor = (which: 'questions' | 'fund') => {
    setIsOpen(false);
    setDoor(which);
  };

  return (
    <>
      <div
        data-annot="corner-panel"
        className={`fixed right-md md:right-lg z-40 flex flex-col items-end gap-sm ${
          // On the frozen round page the open proposal sits above the
          // page's own bottom action bar (Leave a note), so on a phone
          // neither covers the other; in normal use the button keeps its
          // corner.
          staticOpen ? 'bottom-28 md:bottom-32' : 'bottom-md md:bottom-lg'
        }`}
      >
        {isOpen && (
          <div className="w-72 max-w-[calc(100vw-2rem)] p-sm flex flex-col gap-sm bg-card border border-border rounded-xl shadow-modal">
            <DoorRow
              icon={
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              label="Questions"
              subline="Write to the people who tend this toolkit."
              onOpen={staticOpen ? undefined : () => openDoor('questions')}
            />
            <DoorRow
              icon={<Sprout className="w-5 h-5 text-table-accent" strokeWidth={2} />}
              label="Fund this work"
              subline="Help keep the hubs and this toolkit going."
              onOpen={staticOpen ? undefined : () => openDoor('fund')}
            />
          </div>
        )}

        <button
          type="button"
          onClick={staticOpen ? undefined : () => setIsOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="Questions and support"
          className="h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-raised hover:shadow-modal transition-all duration-default ease-default active:translate-y-px hover:-translate-y-0.5 flex items-center justify-center"
        >
          <Plus
            className={`w-6 h-6 transition-transform duration-default ${isOpen ? 'rotate-45' : ''}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </div>

      {door === 'questions' && <QuestionsModal onClose={() => setDoor(null)} />}
      {door === 'fund' && <FundModal onClose={() => setDoor(null)} />}
    </>
  );
}
