"use client";

import { useEffect, useRef } from "react";

/**
 * Hiệu ứng toàn cục (đồng bộ với bản Lovable):
 * - nền chuyển màu theo cuộn + thanh tiến trình: chạy bằng CSS scroll-driven animation
 *   (xem body::before / body::after trong globals.css), không cần JavaScript;
 * - ánh sáng theo con trỏ: chỉ đổi transform của một phần tử riêng;
 * - reveal mượt các khối `.glass-panel`, `.glass-card`, `[data-motion-reveal]` khi cuộn tới.
 *
 * Không ghi biến CSS lên <html> ở mỗi khung hình: biến kế thừa xuống mọi phần tử nên
 * mỗi lần ghi buộc trình duyệt tính lại style cả trang (~8–9 ms/khung trên trang chủ).
 */
const REVEAL_SELECTOR = [".glass-panel", ".glass-card", "[data-motion-reveal]"].join(",");

export default function ScrollExperience() {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let scrollRaf = 0;
    let pointerRaf = 0;
    let observeRaf = 0;
    let scrolled: boolean | null = null;
    let pointerX = 0;
    let pointerY = 0;

    const scrollTop = () => {
      const inner = document.querySelector<HTMLElement>("[data-scroll-root]");
      if (inner && inner.scrollHeight > inner.clientHeight + 4) return inner.scrollTop;
      return window.scrollY;
    };

    // Chỉ ghi thuộc tính khi trạng thái thật sự đổi (dùng cho .sticky-glass).
    const updateScrolled = () => {
      scrollRaf = 0;
      const next = scrollTop() > 18;
      if (next !== scrolled) {
        scrolled = next;
        document.body.dataset.scrolled = next ? "true" : "false";
      }
    };
    const requestScrollUpdate = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScrolled);
    };

    const movePointerGlow = () => {
      pointerRaf = 0;
      const glow = glowRef.current;
      if (glow) glow.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
    };
    const updatePointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerRaf) pointerRaf = requestAnimationFrame(movePointerGlow);
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
      observeRaf = 0;
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
    // Gom nhiều thay đổi DOM trong cùng một khung hình thành một lần quét.
    const requestObserve = () => {
      if (!observeRaf) observeRaf = requestAnimationFrame(observe);
    };

    const mutationObserver = new MutationObserver(requestObserve);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    observe();
    updateScrolled();

    window.addEventListener("scroll", requestScrollUpdate, { passive: true, capture: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    if (!reduced) window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      if (pointerRaf) cancelAnimationFrame(pointerRaf);
      if (observeRaf) cancelAnimationFrame(observeRaf);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", requestScrollUpdate, { capture: true });
      window.removeEventListener("resize", requestScrollUpdate);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  return <div ref={glowRef} aria-hidden className="ambient-pointer-glow" />;
}
