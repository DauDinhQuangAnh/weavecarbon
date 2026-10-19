"use client";

import React, { useEffect } from "react";

/**
 * ScrollExperience & Global Design System Engine
 * Implements Section 5, 6, 7, 8, 9, 17, 20, 21, 24, 40 of Design System & Animation Spec:
 * - 3-layer body background formula
 * - Pointer-reactive ambient glow with RAF CSS variables
 * - Top scroll progress bar
 * - Section reveal via IntersectionObserver
 * - body[data-scrolled] toggle for sticky glass header
 * - prefers-reduced-motion handling
 */
export default function ScrollExperience() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const docEl = document.documentElement;
    const bodyEl = document.body;

    // 1. Google Fonts: Load Inter & Manrope
    const fontId = "weavecarbon-design-system-fonts";
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap";
      document.head.appendChild(link);
    }

    // 2. Inject Design System Core Tokens & Styles
    const styleId = "weavecarbon-design-system-spec-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        :root {
          --background: 80 30% 96%;
          --foreground: 103 37% 8%;
          --card: 75 33% 98%;
          --card-foreground: 103 37% 8%;
          --primary: 150 61% 20%;
          --primary-foreground: 80 30% 96%;
          --secondary: 90 28% 93%;
          --secondary-foreground: 97 40% 19%;
          --muted: 100 28% 88%;
          --muted-foreground: 101 15% 34%;
          --accent: 93 32% 57%;
          --accent-foreground: 96 49% 10%;
          --destructive: 0 52% 54%;
          --border: 100 22% 84%;
          --input: 100 22% 84%;
          --ring: 150 61% 20%;
          --radius: 0.85rem;
          --navy: 96 49% 10%;
          --forest-dark: 97 40% 19%;
          --forest-light: 150 35% 35%;
          --earth-warm: 98 43% 21%;
          --warning: 38 70% 52%;
          --motion-fast: 140ms;
          --motion-base: 300ms;
          --motion-slow: 680ms;
          --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
          --pointer-x: 50vw;
          --pointer-y: 30vh;
          --scroll-progress: 0;
        }

        body {
          background-color: #F6F8F2 !important;
          background-image: 
            radial-gradient(44rem 44rem at calc(18% + var(--scroll-progress, 0) * 6%) calc(-6% + var(--scroll-progress, 0) * 8%), rgba(58, 120, 89, 0.22), transparent 62%),
            radial-gradient(38rem 38rem at calc(86% - var(--scroll-progress, 0) * 8%) calc(8% + var(--scroll-progress, 0) * 10%), rgba(142, 180, 110, 0.18), transparent 62%),
            linear-gradient(180deg, #F6F8F2 0%, #EDF2E8 50%, #F6F8F2 100%) !important;
          background-attachment: fixed !important;
          color: #111C0D !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
          letter-spacing: -0.01em;
        }

        h1, h2, h3, h4, .font-heading, .font-display {
          font-family: 'Manrope', system-ui, -apple-system, sans-serif !important;
          letter-spacing: -0.025em;
        }

        /* Pointer-reactive ambient glow (Section 6) */
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: radial-gradient(22rem 22rem at var(--pointer-x, 50vw) var(--pointer-y, 30vh), rgba(142, 180, 110, 0.10), transparent 72%);
          opacity: 1;
          transition: opacity 300ms ease;
        }

        /* Scroll progress bar (Section 7) */
        #wc-scroll-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          z-index: 9999;
          transform-origin: left center;
          transform: scaleX(var(--scroll-progress, 0));
          background: linear-gradient(90deg, #8EB46E 0%, #145233 50%, #17260D 100%);
          box-shadow: 0 0 10px rgba(20, 82, 51, 0.35);
          pointer-events: none;
          will-change: transform;
        }

        /* Glass styles (Section 16) */
        .glass-card {
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.85) 0%, rgba(246, 248, 242, 0.55) 100%) !important;
          backdrop-filter: blur(24px) saturate(170%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(170%) !important;
          border: 1px solid rgba(255, 255, 255, 0.82) !important;
          box-shadow: 0 16px 40px -24px rgba(23, 38, 13, 0.28), 0 1px 0 rgba(255, 255, 255, 0.82) inset !important;
        }

        .glass-panel {
          background: rgba(246, 248, 242, 0.72) !important;
          backdrop-filter: blur(24px) saturate(170%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(170%) !important;
          border: 1px solid rgba(255, 255, 255, 0.75) !important;
        }

        .glass-shell {
          background: rgba(246, 248, 242, 0.64) !important;
          backdrop-filter: blur(30px) saturate(185%) !important;
          -webkit-backdrop-filter: blur(30px) saturate(185%) !important;
          border: 1px solid rgba(255, 255, 255, 0.70) !important;
        }

        /* Sticky Glass Header (Section 17) */
        .sticky-glass-header {
          background: rgba(246, 248, 242, 0.64);
          backdrop-filter: blur(30px) saturate(190%);
          -webkit-backdrop-filter: blur(30px) saturate(190%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 2px 8px -5px rgba(23, 38, 13, 0.12);
          transition: background 300ms ease, box-shadow 300ms ease;
        }

        body[data-scrolled="true"] .sticky-glass-header {
          background: rgba(246, 248, 242, 0.85);
          box-shadow: 0 16px 40px -24px rgba(23, 38, 13, 0.25);
        }

        /* Motion Reveal (Section 9) */
        .motion-reveal {
          opacity: 0;
          transform: translateY(28px) scale(0.985);
          filter: blur(8px);
          transition: opacity 760ms cubic-bezier(0.22, 1, 0.36, 1),
                      transform 760ms cubic-bezier(0.16, 1, 0.3, 1),
                      filter 760ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform, filter;
        }

        .motion-reveal.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }

        /* Interactive surface for clickable cards (Section 15) */
        @media (hover: hover) and (pointer: fine) {
          .interactive-surface {
            transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
                        box-shadow 300ms cubic-bezier(0.22, 1, 0.36, 1),
                        border-color 300ms ease;
          }
          .interactive-surface:hover {
            transform: translateY(-5px) scale(1.008);
            border-color: rgba(20, 82, 51, 0.24) !important;
            box-shadow: 0 16px 40px -24px rgba(23, 38, 13, 0.36), 0 1px 0 rgba(255, 255, 255, 0.82) inset !important;
          }
          .interactive-surface:active {
            transform: translateY(-1px) scale(0.985);
          }
        }

        /* Page Stage (Section 18) */
        .page-stage {
          position: relative;
          border-radius: 24px;
          scroll-snap-align: start;
        }

        /* Soft scroll snap (Section 19) */
        .scroll-snap-soft {
          scroll-snap-type: y proximity;
          overscroll-behavior-y: contain;
          scroll-behavior: smooth;
        }

        .scroll-snap-soft > * {
          scroll-snap-align: start;
          scroll-margin-top: 88px;
        }

        /* Custom Scrollbar (Section 20) */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(20, 82, 51, 0.35) transparent;
        }

        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          border: 3px solid transparent;
          border-radius: 999px;
          background-clip: padding-box;
          background-color: rgba(58, 120, 89, 0.45);
        }

        ::-webkit-scrollbar-thumb:hover {
          background-color: rgba(20, 82, 51, 0.75);
        }

        /* Text selection (Section 21) */
        ::selection {
          background-color: rgba(20, 82, 51, 0.18);
          color: inherit;
        }

        /* Gradients (Section 22) */
        .text-gradient-forest {
          background-image: linear-gradient(135deg, #2C441D 0%, #3A7859 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
        }

        .bg-gradient-forest {
          background-image: linear-gradient(135deg, #2C441D 0%, #3A7859 100%) !important;
        }

        .bg-gradient-hero {
          background: radial-gradient(ellipse at 20% 15%, rgba(58, 120, 89, 0.22) 0%, transparent 60%), linear-gradient(180deg, #F6F8F2 0%, #EDF2E8 100%) !important;
        }

        /* Prefers-reduced-motion (Section 24) */
        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto !important;
          }
          body::before, #wc-scroll-progress-bar {
            display: none !important;
          }
          .motion-reveal {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
            transition: none !important;
          }
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 3. Scroll Progress & body[data-scrolled] tracking (RAF)
    let scrollRafId = 0;
    const handleScroll = () => {
      cancelAnimationFrame(scrollRafId);
      scrollRafId = requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? Math.min(Math.max(scrollTop / scrollHeight, 0), 1) : 0;

        docEl.style.setProperty("--scroll-progress", progress.toFixed(4));
        bodyEl.setAttribute("data-scrolled", scrollTop > 12 ? "true" : "false");
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // 4. Pointer-reactive ambient glow tracking (RAF)
    let pointerRafId = 0;
    const handlePointerMove = (e: MouseEvent) => {
      cancelAnimationFrame(pointerRafId);
      pointerRafId = requestAnimationFrame(() => {
        docEl.style.setProperty("--pointer-x", `${e.clientX}px`);
        docEl.style.setProperty("--pointer-y", `${e.clientY}px`);
      });
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });

    // 5. Motion Reveal via IntersectionObserver (Section 9)
    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.08,
          rootMargin: "0px 0px -40px 0px",
        }
      );

      const observeRevealElements = () => {
        if (!observer) return;
        document.querySelectorAll(".motion-reveal:not(.is-visible)").forEach((el) => {
          observer!.observe(el);
        });
      };

      observeRevealElements();

      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(() => {
          observeRevealElements();
        });
        mutationObserver.observe(bodyEl, { childList: true, subtree: true });
      }
    } else {
      // Fallback for environments without IntersectionObserver (e.g. tests)
      document.querySelectorAll(".motion-reveal").forEach((el) => {
        el.classList.add("is-visible");
      });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handlePointerMove);
      cancelAnimationFrame(scrollRafId);
      cancelAnimationFrame(pointerRafId);
      observer?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  return (
    <div
      id="wc-scroll-progress-bar"
      aria-hidden="true"
    />
  );
}
