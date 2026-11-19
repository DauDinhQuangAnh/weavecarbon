"use client";

import type { ReactNode } from "react";
import { useNearViewport } from "@/hooks/useNearViewport";

/**
 * Chỉ dựng `children` khi khối sắp vào khung nhìn. Trước đó giữ chỗ bằng
 * `minHeight` để trang không nhảy bố cục.
 */
export default function DeferUntilVisible({
  children,
  minHeight,
  rootMargin = "400px",
}: {
  children: ReactNode;
  minHeight: number | string;
  rootMargin?: string;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>(rootMargin);
  return (
    <div ref={ref} style={near ? undefined : { minHeight }}>
      {near ? children : null}
    </div>
  );
}
