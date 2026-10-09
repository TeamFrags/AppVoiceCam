'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Fades in `[data-reveal]` elements as they scroll into view. Hiding is switched on from here,
 * so without JavaScript, or with reduced motion, the page stays fully visible.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    for (const el of document.querySelectorAll('[data-reveal]:not(.is-in)')) {
      // Already on screen: mark it before hiding is enabled, so nothing blinks after hydration.
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      else observer.observe(el);
    }
    document.documentElement.classList.add('reveal-on');

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
