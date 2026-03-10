"use client";

import * as React from "react";

const MOBILE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1023;
const PHONE_COMPACT_MAX_WIDTH = 389;

type BreakpointState = {
  isPhoneCompact: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
};

const resolveBreakpointState = (): BreakpointState => {
  if (typeof window === "undefined") {
    return {
      isPhoneCompact: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const width = window.innerWidth;
  const isMobile = width <= MOBILE_MAX_WIDTH;
  const isTablet = width > MOBILE_MAX_WIDTH && width <= TABLET_MAX_WIDTH;

  return {
    isPhoneCompact: width <= PHONE_COMPACT_MAX_WIDTH,
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
  };
};

export function useBreakpoint(): BreakpointState {
  const [state, setState] = React.useState<BreakpointState>(resolveBreakpointState);

  React.useEffect(() => {
    const sync = () => {
      setState(resolveBreakpointState());
    };

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  return state;
}

