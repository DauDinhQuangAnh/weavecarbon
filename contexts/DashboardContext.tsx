"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

interface DashboardContextType {
  title: string;
  subtitle?: string;
  titlePath?: string;
  setPageTitle: (title: string, subtitle?: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export function DashboardProvider({ children }: {children: React.ReactNode;}) {
  const [title, setTitle] = useState("Dashboard");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [titlePath, setTitlePath] = useState<string | undefined>();

  const setPageTitle = useCallback((newTitle: string, newSubtitle?: string) => {
    setTitle(newTitle);
    setSubtitle(newSubtitle);
    setTitlePath(
      typeof window === "undefined" ? undefined : window.location.pathname
    );
  }, []);

  return (
    <DashboardContext.Provider value={{ title, subtitle, titlePath, setPageTitle }}>
      {children}
    </DashboardContext.Provider>);

}

export function useDashboardTitle() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardTitle must be used within DashboardProvider");
  }
  return context;
}
