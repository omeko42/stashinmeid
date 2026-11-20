'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Angka yang menghitung naik ke nilai target.
 * Motion ini menjawab perubahan nilai, bukan dekorasi yang berjalan sendiri.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [state, setState] = useState({ target, value: target });
  const frameRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const value = state.target === target ? state.value : target;

  const animate = useCallback(() => {
    if (reduceMotion) {
      setState({ target, value: target });
      return;
    }

    const currentValue = state.target === target ? state.value : state.value;
    const delta = target - currentValue;
    if (delta === 0) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextValue = currentValue + delta * eased;
      setState({ target, value: nextValue });
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [durationMs, reduceMotion, state.target, state.value, target]);

  useEffect(() => {
    animate();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [animate]);

  return value;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}
