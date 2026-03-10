"use client";

import React, { useEffect, useRef, useState } from "react";

interface LazyMountOnViewProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}

const LazyMountOnView: React.FC<LazyMountOnViewProps> = ({
  children,
  placeholder = null,
  className,
  rootMargin = "200px 0px",
  threshold = 0.01,
  once = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (isVisible && once) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isVisible, once, rootMargin, threshold]);

  return <div ref={containerRef} className={className}>{isVisible ? children : placeholder}</div>;
};

export default LazyMountOnView;
