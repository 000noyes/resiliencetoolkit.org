import { useState, useEffect, useRef, type ReactNode } from 'react';
import ExternalLinkIcon from 'lucide-react/dist/esm/icons/external-link';
import ExternalLinkModal from './ExternalLinkModal';
import { isDomainTrusted, addTrustedDomain } from '../lib/externalLinkPreferences';

interface ExternalLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export default function ExternalLink({ href, children, className = '' }: ExternalLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHoverCapable, setIsHoverCapable] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect if device supports hover (desktop)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsHoverCapable(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHoverCapable(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Extract domain from URL for tooltip
  const getDomain = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };

  const domain = getDomain(href);

  // Check if link is external
  const isExternal = (() => {
    try {
      const url = new URL(href, window.location.origin);
      return url.hostname !== window.location.hostname;
    } catch {
      return false;
    }
  })();

  // If not external, render as regular link
  if (!isExternal) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  // Handle click - check preferences before opening modal
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowTooltip(false); // Hide tooltip when modal opens

    // Check if domain is trusted - if so, open directly
    if (isDomainTrusted(domain)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    // Otherwise, show confirmation modal
    setIsModalOpen(true);
  };

  // Handle modal confirmation - open link and save preference if requested
  const handleConfirm = (rememberDomain: boolean) => {
    // Save preference if checkbox was checked
    if (rememberDomain) {
      addTrustedDomain(domain);
    }

    // Open the link
    window.open(href, '_blank', 'noopener,noreferrer');
    setIsModalOpen(false);
  };

  // Handle modal close
  const handleClose = () => {
    setIsModalOpen(false);
  };

  // Handle hover for desktop
  const handleMouseEnter = () => {
    if (!isHoverCapable) return;

    // Small delay before showing tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltip(false);
  };

  // Position tooltip
  useEffect(() => {
    if (!showTooltip || !linkRef.current || !tooltipRef.current) return;

    const link = linkRef.current;
    const tooltip = tooltipRef.current;
    const linkRect = link.getBoundingClientRect();

    // Position below the link, centered
    const tooltipLeft = linkRect.left + linkRect.width / 2;
    const tooltipTop = linkRect.bottom + 8;

    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.top = `${tooltipTop}px`;
  }, [showTooltip]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <a
        ref={linkRef}
        href={href}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`external-link ${className}`}
        aria-label={`External link to ${domain}`}
      >
        {children}
        <span className="external-link__icon" aria-hidden="true">
          <ExternalLinkIcon size={14} strokeWidth={2} />
        </span>
      </a>

      {/* Hover tooltip (desktop only) */}
      {showTooltip && isHoverCapable && (
        <div
          ref={tooltipRef}
          className="external-link__tooltip"
          role="tooltip"
          aria-hidden="true"
        >
          <span className="external-link__tooltip-domain">{domain}</span>
        </div>
      )}

      {/* Confirmation modal */}
      <ExternalLinkModal
        isOpen={isModalOpen}
        url={href}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    </>
  );
}
