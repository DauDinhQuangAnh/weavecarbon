"use client";

import { useEffect } from "react";

/**
 * Hiệu ứng toàn cục (đồng bộ với bản Lovable):
 * - cập nhật --scroll-progress / --pointer-x / --pointer-y cho nền + thanh tiến trình
 * - reveal mượt các khối `.glass-panel`, `.glass-card`, `[data-motion-reveal]` khi cuộn tới
 * Hoạt động với cả window scroll lẫn vùng cuộn bên trong (`[data-scroll-root]`).
 */
const REVEAL_SELECTOR = [".glass-panel", ".glass-card", "[data-motion-reveal]"].join(",");

export default function ScrollExperience() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const scrollSource = (): { y: number; max: number } => {
      const inner = document.querySelector<HTMLElement>("[data-scroll-root]");
      if (inner && inner.scrollHeight > inner.clientHeight + 4) {
        return { y: inner.scrollTop, max: Math.max(1, inner.scrollHeight - inner.clientHeight) };
      }
      return { y: window.scrollY, max: Math.max(1, root.scrollHeight - window.innerHeight) };
    };

    const updateScroll = () => {
      raf = 0;
      const { y, max } = scrollSource();
      root.style.setProperty("--scroll-y", `${y}px`);
      root.style.setProperty("--scroll-progress", String(Math.min(1, Math.max(0, y / max))));
      document.body.dataset.scrolled = y > 18 ? "true" : "false";
    };
    const requestScrollUpdate = () => {
      if (!raf) raf = requestAnimationFrame(updateScroll);
    };
    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("motion-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
    );

    const observe = () => {
      if (reduced) return;
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((element) => {
        if (element.dataset.motionObserved || element.closest("[data-no-reveal]")) return;
        element.dataset.motionObserved = "true";
        const rect = element.getBoundingClientRect();
        // Khối đã nằm trong màn hình lúc tải: không ẩn đi để tránh nháy.
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          element.classList.add("motion-reveal", "motion-revealed");
          return;
        }
        element.classList.add("motion-reveal");
        observer.observe(element);
      });
    };

    const mutationObserver = new MutationObserver(observe);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    observe();
    updateScroll();

    window.addEventListener("scroll", requestScrollUpdate, { passive: true, capture: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", requestScrollUpdate, { capture: true });
      window.removeEventListener("resize", requestScrollUpdate);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  return null;
}
