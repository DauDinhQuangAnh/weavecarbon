"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Pause, Play, SkipForward, SkipBack, Sparkles } from "lucide-react";
import {
  DEMO_TOUR_STEPS,
  findTourStepIndex,
  getNextTourIndex,
  getPrevTourIndex,
} from "@/lib/demo/autoTour";

// How long each page is shown before the tour advances.
const SLIDE_INTERVAL_MS = 9000;
// After the user interacts, how long the tour waits (idle) before resuming.
const IDLE_RESUME_MS = 30000;
// Give the landing page a moment before the very first auto-advance.
const INITIAL_START_DELAY_MS = 1200;

type TourStatus = "playing" | "paused" | "off";

// User-input events that count as "the user is touching the demo". Programmatic
// router navigation never fires these, so the tour's own page changes are safe.
const INTERACTION_EVENTS: readonly (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
];

const DemoAutoTour: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const steps = DEMO_TOUR_STEPS;

  const [status, setStatus] = useState<TourStatus>("playing");
  const [activeIndex, setActiveIndex] = useState(0);

  // Refs mirror state so window-event handlers and timers read fresh values
  // without being re-bound on every render.
  const statusRef = useRef<TourStatus>(status);
  const indexRef = useRef(0);
  const advanceTimerRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;
      indexRef.current = index;
      setActiveIndex(index);
      router.push(step.route);
    },
    [router, steps]
  );

  // Schedule the next auto-advance; re-arms itself while status stays "playing".
  const scheduleAdvance = useCallback(
    (delay: number) => {
      clearAdvanceTimer();
      advanceTimerRef.current = window.setTimeout(() => {
        if (statusRef.current !== "playing") return;
        goToIndex(getNextTourIndex(indexRef.current, steps.length));
        scheduleAdvance(SLIDE_INTERVAL_MS);
      }, delay);
    },
    [clearAdvanceTimer, goToIndex, steps.length]
  );

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setStatus("playing");
    }, IDLE_RESUME_MS);
  }, [clearResumeTimer]);

  // Keep the highlighted step in sync when the user navigates manually.
  useEffect(() => {
    const matched = findTourStepIndex(pathname, steps);
    if (matched >= 0) {
      indexRef.current = matched;
      setActiveIndex(matched);
    }
  }, [pathname, steps]);

  // Drive the tour off the status value.
  useEffect(() => {
    if (status === "playing") {
      clearResumeTimer();
      if (!initializedRef.current) {
        // First run: start from wherever the user already is, then advance.
        const matched = findTourStepIndex(pathname, steps);
        if (matched >= 0) {
          indexRef.current = matched;
          setActiveIndex(matched);
        }
        initializedRef.current = true;
        scheduleAdvance(INITIAL_START_DELAY_MS);
      } else {
        // Resuming after an interaction: re-show the last tour page it was on,
        // then keep advancing from there.
        goToIndex(indexRef.current);
        scheduleAdvance(SLIDE_INTERVAL_MS);
      }
      return clearAdvanceTimer;
    }

    if (status === "paused") {
      clearAdvanceTimer();
      scheduleResume();
      return clearResumeTimer;
    }

    // status === "off"
    clearAdvanceTimer();
    clearResumeTimer();
    return undefined;
    // pathname intentionally excluded: this effect reacts to status changes,
    // not to every navigation (navigation is handled by the sync effect above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Listen for real user input to pause the tour, and reset the idle countdown.
  useEffect(() => {
    const handleInteraction = () => {
      if (statusRef.current === "off") return;
      if (statusRef.current === "playing") {
        setStatus("paused");
      } else {
        scheduleResume();
      }
    };

    INTERACTION_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleInteraction, { passive: true });
    });
    return () => {
      INTERACTION_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleInteraction);
      });
    };
  }, [scheduleResume]);

  // Clean up any pending timers on unmount.
  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      clearResumeTimer();
    };
  }, [clearAdvanceTimer, clearResumeTimer]);

  const handleManualJump = useCallback(
    (nextIndex: number) => {
      // Manual prev/next: keep playing but restart the dwell timer on the new page.
      clearResumeTimer();
      setStatus("playing");
      goToIndex(nextIndex);
      scheduleAdvance(SLIDE_INTERVAL_MS);
    },
    [clearResumeTimer, goToIndex, scheduleAdvance]
  );

  const handleTogglePlay = useCallback(() => {
    setStatus((prev) => (prev === "off" ? "playing" : "off"));
  }, []);

  // Interacting with the control itself is not "touching the demo content", so
  // keep these events from bubbling to the window interaction listener.
  const stopInteractionBubble = useCallback(
    (event: React.SyntheticEvent) => {
      event.stopPropagation();
    },
    []
  );

  const activeStep = steps[activeIndex] ?? steps[0];
  const isRunning = status === "playing";
  const statusLabel =
    status === "playing"
      ? "Đang trình chiếu"
      : status === "paused"
        ? "Tạm dừng — sẽ tự chạy lại"
        : "Đã tắt trình chiếu";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 lg:pl-56">
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/95 px-2 py-1.5 shadow-lg shadow-emerald-900/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        onPointerDown={stopInteractionBubble}
        onKeyDown={stopInteractionBubble}
        onWheel={stopInteractionBubble}
        onTouchStart={stopInteractionBubble}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isRunning ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
          }`}
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4" />
        </span>

        <div className="min-w-0 pr-1">
          <p className="truncate text-xs font-semibold text-slate-900">
            {activeStep?.label ?? "Demo"}
            <span className="ml-1 font-normal text-slate-400">
              {activeIndex + 1}/{steps.length}
            </span>
          </p>
          <p className="truncate text-[11px] leading-tight text-slate-500">{statusLabel}</p>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Trang trước"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            onClick={() => handleManualJump(getPrevTourIndex(indexRef.current, steps.length))}
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={status === "off" ? "Bật trình chiếu tự động" : "Tắt trình chiếu tự động"}
            aria-pressed={isRunning}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              isRunning
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-slate-900 text-white hover:bg-slate-700"
            }`}
            onClick={handleTogglePlay}
          >
            {status === "off" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Trang tiếp theo"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            onClick={() => handleManualJump(getNextTourIndex(indexRef.current, steps.length))}
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoAutoTour;
