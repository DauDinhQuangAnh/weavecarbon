"use client";

import React, { createContext, useContext, useState } from "react";

interface DashboardContextType {
  title: string;
  subtitle?: string;
  setPageTitle: (title: string, subtitle?: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export function DashboardProvider({ children }: {children: React.ReactNode;}) {
  const [title, setTitle] = useState("Dashboard");
  const [subtitle, setSubtitle] = useState<string | undefined>();

  const setPageTitle = (newTitle: string, newSubtitle?: string) => {
    setTitle(newTitle);
    setSubtitle(newSubtitle);
  };

  return (
    <DashboardContext.Provider value={{ title, subtitle, setPageTitle }}>
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