'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Anima un número desde 0 (o un valor inicial) hasta `target`.
 * Usa requestAnimationFrame con easing cubic-out.
 *
 * @param target valor final
 * @param duration duración total en ms (default 900)
 * @param decimals decimales a mantener
 */
export function useCountUp(target: number, duration = 900, decimals = 0): number {
  const [value, setValue] = useState(target === 0 ? 0 : 0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(0); return; }
    let raf = 0;
    const start = performance.now();
    const initial = startedRef.current ? value : 0;
    startedRef.current = true;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = initial + (target - initial) * eased;
      setValue(decimals === 0 ? Math.round(v) : +v.toFixed(decimals));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  return value;
}
