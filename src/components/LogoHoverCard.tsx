import { useState, useEffect, useRef } from 'react';

interface LogoHoverCardProps {
  logoSrc: string;
  title?: string;
  description?: string;
}

// called in Header.astro
// currently unused, but could be useful later

export default function LogoHoverCard({
  logoSrc,
  title = "What is a Resilience Hub?",
  description = "A resilience hub can look many ways, but at its core, it is a centralized source of information, support, and supplies that supports community resilience. Read more about Resilience Hubs on the Introduction page."
}: LogoHoverCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [hasPosition, setHasPosition] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const calculatePosition = () => {
    const logoElement = document.getElementById('header-logo');
    if (!logoElement) return false;

    const logoRect = logoElement.getBoundingClientRect();

    // Position below and slightly to the right of the logo (top left of card near logo)
    const left = logoRect.left;
    const top = logoRect.bottom + 8; // 8px gap below logo

    setPosition({
      left: Math.max(16, left), // Prevent overflow on left
      top: top
    });
    setHasPosition(true);
    return true;
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      const positioned = calculatePosition();
      if (positioned) {
        setIsVisible(true);
      }
    }, 200); // Small delay before showing
  };

  const handleMouseLeave = () => {
    // Delay hiding to allow mouse to move to card
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setHasPosition(false);
    }, 100); // Small delay before hiding
  };

  const handleCardMouseEnter = () => {
    // Keep card visible when hovering over it
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    // Hide card when leaving it
    setIsVisible(false);
    setHasPosition(false);
  };

  useEffect(() => {
    const logoElement = document.getElementById('header-logo');
    if (!logoElement) return;

    logoElement.addEventListener('mouseenter', handleMouseEnter);
    logoElement.addEventListener('mouseleave', handleMouseLeave);

    // Reposition on window resize
    const handleResize = () => {
      if (isVisible) {
        calculatePosition();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      logoElement.removeEventListener('mouseenter', handleMouseEnter);
      logoElement.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [isVisible]);

  // Only render card if it should be visible and has a valid position
  if (!isVisible || !hasPosition) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 9999,
        backgroundColor: 'var(--surface-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-raised)',
        padding: 'var(--spacing-lg)',
        maxWidth: '384px',
        animation: 'logo-card-fade-in 120ms cubic-bezier(0.33, 0, 0.2, 1)'
      }}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      <img
        src={logoSrc}
        alt="Resilience Hub Toolkit"
        style={{
          width: '111px',
          height: '111px',
          marginBottom: 'var(--spacing-md)',
          display: 'block'
        }}
      />
      <h3
        style={{
          color: 'var(--text-primary)',
          fontSize: 'var(--text-subtitle)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-sm)',
          marginTop: 0
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: 'var(--text-muted)',
          fontSize: 'var(--text-body-small)',
          lineHeight: 1.5,
          margin: 0
        }}
      >
        {description}
      </p>
    </div>
  );
}
