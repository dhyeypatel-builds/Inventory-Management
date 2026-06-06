import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render when it changes.
 * Initial value is read synchronously so the first paint is already correct.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent): void => setMatches(e.matches);
    // Sync in case the query changed between render and effect.
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * App-wide responsive breakpoints (mirrors Tailwind's md/lg).
 * Desktop is the implicit default: neither mobile nor tablet.
 */
export const BREAKPOINTS = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1023px)',
} as const;

export interface Layout {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/** Resolve the current layout. Falls back to desktop when nothing matches. */
export function useLayout(): Layout {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);
  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}
