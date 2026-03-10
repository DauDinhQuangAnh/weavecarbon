"use client";

import React, { useState, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Company } from "@/types/app.type";

interface DashboardSidebarShellProps {
  company: Company | null;
}

const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";

export default function DashboardSidebarShell({
  company
}: DashboardSidebarShellProps) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const userType = user?.user_type;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [resolvedCompany, setResolvedCompany] = useState<Company | null>(
    company
  );
  const [resolvedPlan, setResolvedPlan] = useState<string | null>(
    company?.current_plan || null
  );

  useEffect(() => {
    setMounted(true);


    const initializeSidebarState = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    initializeSidebarState();


    const handleToggle = () => {
      setSidebarOpen((prev) => !prev);
    };


    const handleResize = () => {

      if (window.innerWidth >= 1024) {

        setSidebarOpen(true);
      } else {

        setSidebarOpen(false);
      }
    };

    window.addEventListener("toggleSidebar", handleToggle);
    window.addEventListener("resize", handleResize);


    const handleCloseOnNavigation = () => {

      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("sidebarNavigate", handleCloseOnNavigation);

    return () => {
      window.removeEventListener("toggleSidebar", handleToggle);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("sidebarNavigate", handleCloseOnNavigation);
    };
  }, []);

  useEffect(() => {
    setResolvedCompany(company);
  }, [company]);

  useEffect(() => {
    setResolvedPlan(company?.current_plan || null);
  }, [company?.current_plan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (resolvedPlan) return;
    try {
      const raw = localStorage.getItem("weavecarbon_subscription_lock_state");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { current_plan?: string };
      const cachedPlan = (parsed.current_plan || "").trim();
      if (cachedPlan) {
        setResolvedPlan(cachedPlan);
      }
    } catch {

    }
  }, [resolvedPlan]);

  useEffect(() => {
    let cancelled = false;

    const loadCompany = async () => {
      if (company || !user || !ACCOUNT_ENDPOINT_ENABLED) return;

      try {
        const account = await api.get<{company?: Company | null;}>("/account");
        if (!cancelled) {
          setResolvedCompany(account?.company || null);
        }
      } catch {
        if (!cancelled) {
          setResolvedCompany(null);
        }
      }
    };

    loadCompany();

    return () => {
      cancelled = true;
    };
  }, [company, user]);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      if (!userId || userType === "b2c") return;

      try {
        const subscription = await api.get<{
          current_plan?: string;
          subscription?: {
            current_plan?: string;
          };
        }>("/subscription");
        const nextPlan =
          subscription?.current_plan ||
          subscription?.subscription?.current_plan ||
          null;
        if (!cancelled && nextPlan) {
          setResolvedPlan(nextPlan);
        }
      } catch {

      }
    };

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [userId, userType]);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(!sidebarOpen);
    }
  };


  if (!mounted) {
    return null;
  }

  return (
    <DashboardSidebar
      company={resolvedCompany}
      profile={user}
      currentPlan={resolvedPlan}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={handleToggleSidebar} />);


}
