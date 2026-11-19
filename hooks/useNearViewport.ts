"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Trả về `true` khi phần tử đã (hoặc sắp) vào khung nhìn. Dùng để hoãn việc dựng
 * các khối nặng nằm dưới màn hình đầu (bản đồ, cụm biểu đồ) cho tới khi cần,
 * thay vì dựng tất cả trong cùng một tác vụ lúc tải trang.
 */
export function useNearViewport<T extends Element>(rootMargin = "400px") {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return [ref, near] as const;
}
