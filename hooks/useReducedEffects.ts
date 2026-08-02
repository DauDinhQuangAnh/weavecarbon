"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` when the landing page should scale back expensive visual
 * effects (large stacked `blur-3xl` blobs, looping motion animations, backdrop
 * blur). We treat a device as "low power" when the user asked for reduced
 * motion, when the primary pointer is coarse (touch / low-end mobile), or when
 * the CPU reports 4 or fewer logical cores.
 *
 * SSR-safe: renders `false` on the server and during first paint, then syncs to
 * the real device capabilities after mount.
 */
export function useReducedEffects(): boolean {
  const [reducedEffects, setReducedEffects] = useState(false);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    const sync = () => {
      const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
      setReducedEffects(
        reducedMotionQuery.matches ||
          coarsePointerQuery.matches ||
          hardwareConcurrency <= 4,
      );
    };

    sync();
    reducedMotionQuery.addEventListener("change", sync);
    coarsePointerQuery.addEventListener("change", sync);
    window.addEventListener("resize", sync);

    return () => {
      reducedMotionQuery.removeEventListener("change", sync);
      coarsePointerQuery.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return reducedEffects;
}
