import React, { useState } from 'react';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) {
      return;
    }

    const subject = encodeURIComponent('Resilience Toolkit Feedback');
    const body = encodeURIComponent(feedback);
    const mailtoLink = `mailto:resiliencetoolkit@gocros.org?subject=${subject}&body=${body}`;

    // Open email client immediately
    window.location.href = mailtoLink;

    setIsSubmitted(true);

    // Auto-close after 3 seconds
    setTimeout(() => {
      setFeedback('');
      setIsSubmitted(false);
      setIsOpen(false);
    }, 3000);
  };

  const handleClose = () => {
    setFeedback('');
    setIsSubmitted(false);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="feedback-widget-button fixed bottom-lg right-lg md:bottom-lg md:right-lg bottom-md right-md z-40 h-12 md:h-12 h-10 px-lg md:px-lg px-md rounded-xl bg-primary text-primary-foreground shadow-raised hover:shadow-modal transition-all duration-default ease-default active:translate-y-px flex items-center gap-xs text-body font-medium hover:-translate-y-0.5"
        aria-label="Open feedback form"
      >
        {/* Question mark icon */}
        <svg
          className="w-5 h-5 md:w-5 md:h-5 w-4 h-4"
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
        {/* Text - hide on mobile for smaller button */}
        <span className="hidden sm:inline">Have Questions?</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-[640px] bg-card border border-border rounded-lg shadow-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="feedback-modal-title"
            aria-describedby="feedback-modal-description"
          >
            {/* Header */}
            <div className="p-lg border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2
                    id="feedback-modal-title"
                    className="text-title font-semibold text-foreground"
                  >
                    Have Questions?
                  </h2>
                  <p
                    id="feedback-modal-description"
                    className="text-body-small text-muted-foreground mt-xxs"
                  >
                    Tell us what's working and what isn't — it's how the toolkit improves.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="ml-md -mt-xxs p-xxs rounded-lg hover:bg-muted transition-colors duration-default"
                  aria-label="Close feedback modal"
                >
                  <svg
                    className="w-5 h-5 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit}>
              <div className="p-lg">
                {isSubmitted ? (
                  <div className="text-center py-xl">
                    <div className="inline-flex items-center justify-center w-12 h-12 mb-md">
                      <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-body font-medium text-foreground">
                      Check your email app to send it.
                    </p>
                    <p className="text-body-small text-muted-foreground mt-xs">
                      If it didn't open, email us directly at{' '}
                      <a href="mailto:resiliencetoolkit@gocros.org" className="text-primary hover:underline">
                        resiliencetoolkit@gocros.org
                      </a>
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="mt-md h-10 px-lg rounded-lg border border-border bg-background text-body font-medium text-foreground hover:bg-muted transition-all duration-default"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="feedback-textarea"
                      className="block text-label font-medium text-foreground mb-xs"
                    >
                      What are you noticing?
                    </label>
                    <textarea
                      id="feedback-textarea"
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

              {/* Actions */}
              {!isSubmitted && (
                <div className="p-lg border-t border-border flex justify-end gap-sm">
                  <button
                    type="button"
                    onClick={handleClose}
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
          </div>
        </div>
      )}
    </>
  );
}
