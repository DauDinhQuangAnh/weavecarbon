"use client";

import React, { useState, useEffect } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { getSubscriptionApiPayload } from "@/lib/subscriptionApi";
import {
  resolveSubscriptionState,
  type SubscriptionApiPayload
} from "@/lib/subscriptionState";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";
import { Company } from "@/types/app.type";

interface DashboardSidebarShellProps {
  company: Company | null;
}

const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";

type AccountPayload = {
  company?: Company | null;
};

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
    const companyPlan = (company?.current_plan || "").trim();
    if (!companyPlan) return;

    setResolvedPlan((prev) => prev || companyPlan);
  }, [company?.current_plan]);

  useEffect(() => {
    const companyPlan = (resolvedCompany?.current_plan || "").trim();
    if (!companyPlan) return;

    setResolvedPlan((prev) => prev || companyPlan);
  }, [resolvedCompany?.current_plan]);

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
        const account = await api.get<AccountPayload>("/account", {
          disableResponseCache: true
        });
        const nextCompany = account?.company || null;
        if (!cancelled) {
          setResolvedCompany(nextCompany);
          const accountPlan = (nextCompany?.current_plan || "").trim();
          if (accountPlan) {
            setResolvedPlan((prev) => prev || accountPlan);
          }
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
        const fallbackPlan =
          resolvedCompany?.current_plan || company?.current_plan || null;
        const subscription: SubscriptionApiPayload =
          await getSubscriptionApiPayload();
        const resolved = resolveSubscriptionState(subscription, {
          fallbackPlan
        });
        const nextPlan =
          resolved.plan === "free" && !fallbackPlan ? null : resolved.plan;

        if (!cancelled && nextPlan) {
          setResolvedPlan(nextPlan);
          writeSubscriptionLockState({
            current_plan: nextPlan,
            trial_ends_at: resolved.trialEndsAt,
            trial_expired: resolved.trialExpired,
            features_locked: resolved.featuresLocked
          });
        }
      } catch {

      }
    };

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [company?.current_plan, resolvedCompany?.current_plan, userId, userType]);

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
