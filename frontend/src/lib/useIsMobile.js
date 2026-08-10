import { useEffect, useState } from 'react';

// 768px — index.css-ийн RESPONSIVE breakpoint-той адил (@media max-width: 768px).
const QUERY = '(max-width: 768px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false
  ));

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
