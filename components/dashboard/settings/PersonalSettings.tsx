"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { api, authTokenStore, isApiError } from "@/lib/apiClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription } from
"@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Save, X, User, KeyRound, CalendarDays, Mail } from "lucide-react";
import { toast } from "sonner";

interface AccountData {
  profile?: {
    created_at?: string;
  } | null;
}

const ACCOUNT_ENDPOINT_ENABLED =
process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";

const toInitials = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return "U";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
};

const isEndpointUnavailableError = (error: unknown) => {
  if (isApiError(error)) {
    return error.status === 404 || error.status === 501;
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("route") ||
    message.includes("not implemented"));
};

const PersonalSettings: React.FC = () => {
  const t = useTranslations("settings.system");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const { user, updateUser, refreshUser } = useAuth();
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [personalEditMode, setPersonalEditMode] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    full_name: "",
    email: ""
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });

  const createdDateLabel = accountCreatedAt ?
  new Date(accountCreatedAt).toLocaleDateString(displayLocale) :
  t("notUpdated");
  const displayName = user?.full_name?.trim() || t("notUpdated");
  const displayEmail = user?.email?.trim() || t("noEmail");
  const displayInitials = toInitials(user?.full_name?.trim() || user?.email?.trim() || "U");

  useEffect(() => {
    setPersonalForm({
      full_name: user?.full_name?.trim() || "",
      email: user?.email?.trim() || ""
    });
  }, [user?.email, user?.full_name]);

  useEffect(() => {
    let isMounted = true;
    const fetchAccount = async () => {
      if (!ACCOUNT_ENDPOINT_ENABLED || !user?.id) {
        if (isMounted) {
          setAccountCreatedAt(null);
          setLoading(false);
        }
        return;
      }

      const hasToken = Boolean(
        authTokenStore.getAccessToken() || authTokenStore.getRefreshToken()
      );
      if (!hasToken) {
        if (isMounted) {
          setAccountCreatedAt(null);
          setLoading(false);
        }
        return;
      }

      try {
        const account = await api.get<AccountData>("/account");
        if (isMounted) {
          setAccountCreatedAt(account.profile?.created_at || null);
        }
      } catch (error) {
        console.error("Error fetching account profile:", error);
        if (isMounted) {
          setAccountCreatedAt(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchAccount();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleCancelPersonalEdit = () => {
    setPersonalEditMode(false);
    setPersonalForm({
      full_name: user?.full_name?.trim() || "",
      email: user?.email?.trim() || ""
    });
  };

  const handlePersonalSave = async () => {
    const email = personalForm.email.trim();
    const fullName = personalForm.full_name.trim();

    if (!fullName) {
      toast.error(t("validationFullNameRequired"));
      return;
    }

    if (!email) {
      toast.error(t("validationEmailRequired"));
      return;
    }

    setPersonalSaving(true);
    try {
      const updated = await api.put<{
        email?: string;
        full_name?: string;
      }>("/account/profile", {
        full_name: fullName,
        email
      });

      updateUser({
        full_name:
        typeof updated?.full_name === "string" && updated.full_name.trim() ?
        updated.full_name :
        fullName,
        email:
        typeof updated?.email === "string" && updated.email.trim() ?
        updated.email :
        email
      });
      await refreshUser();
      setPersonalEditMode(false);
      toast.success(t("personalUpdateSuccess"));
    } catch (error) {
      console.error("Error saving personal profile:", error);
      toast.error(error instanceof Error ? error.message : t("updateError"));
    } finally {
      setPersonalSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.error(t("validationPasswordRequired"));
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error(t("validationPasswordMinLength"));
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(t("validationPasswordConfirmMismatch"));
      return;
    }

    const endpoints = [
    "/account/change-password",
    "/account/company/password",
    "/account/password",
    "/auth/change-password"];

    setPasswordSaving(true);
    try {
      let changed = false;
      let lastError: unknown = null;

      for (const path of endpoints) {
        try {
          await api.post(path, {
            current_password: passwordForm.current_password,
            new_password: passwordForm.new_password
          });
          changed = true;
          break;
        } catch (error) {
          lastError = error;
          if (isEndpointUnavailableError(error)) {
            continue;
          }
          throw error;
        }
      }

      if (!changed) {
        throw (
          lastError instanceof Error ?
          lastError :
          new Error(t("changePasswordUnavailable"))
        );
      }

      setPasswordDialogOpen(false);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: ""
      });
      toast.success(t("passwordChangeSuccess"));
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error(error instanceof Error ? error.message : t("changePasswordUnavailable"));
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-lg border border-slate-200 bg-slate-100/70 animate-pulse" />
      </div>);

  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <CardHeader className="rounded-t-[inherit] border-b border-slate-200 bg-gradient-to-r from-white via-emerald-50/40 to-slate-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-sm font-semibold tracking-wide text-emerald-700">
                {displayInitials}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <User className="w-5 h-5" />
                  {t("personalInfo")}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {t("personalInfoDesc")}
                </CardDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                    <Mail className="h-3.5 w-3.5" />
                    {displayEmail}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {createdDateLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {!personalEditMode ?
              <Button
                variant="outline"
                className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                type="button"
                onClick={() => setPersonalEditMode(true)}>

                  {t("edit")}
                </Button> :

              <>
                  <Button
                  variant="ghost"
                  className="text-slate-700 hover:bg-slate-200"
                  onClick={handleCancelPersonalEdit}>

                    <X className="w-4 h-4 mr-1" /> {t("cancel")}
                  </Button>
                  <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={handlePersonalSave}
                  disabled={personalSaving}>

                    <Save className="w-4 h-4 mr-1" /> {t("save")}
                  </Button>
                </>
              }
              <Button
                variant="outline"
                className="gap-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                type="button"
                onClick={() => setPasswordDialogOpen(true)}>

                <KeyRound className="w-4 h-4" />
                {t("changePassword")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("fullName")}
              </Label>
              <Input
                value={personalEditMode ? personalForm.full_name : displayName}
                className={`border-slate-200 text-slate-800 ${personalEditMode ? "bg-white" : "bg-white/85 disabled:text-slate-800 disabled:opacity-100"}`}
                disabled={!personalEditMode}
                onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, full_name: e.target.value }))
                } />

            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("email")}
              </Label>
              <Input
                value={personalEditMode ? personalForm.email : displayEmail}
                className={`border-slate-200 text-slate-800 ${personalEditMode ? "bg-white" : "bg-white/85 disabled:text-slate-800 disabled:opacity-100"}`}
                disabled={!personalEditMode}
                onChange={(e) =>
                setPersonalForm((prev) => ({ ...prev, email: e.target.value }))
                } />

            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("accountCreated")}
              </Label>
              <Input
                value={createdDateLabel}
                className="border-slate-200 bg-white/85 text-slate-800 disabled:text-slate-800 disabled:opacity-100"
                disabled />

            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="border border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{t("changePassword")}</DialogTitle>
            <DialogDescription>
              {t("changePasswordDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("currentPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  current_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
            <div className="space-y-2">
              <Label>{t("newPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  new_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
            <div className="space-y-2">
              <Label>{t("confirmNewPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  confirm_password: e.target.value
                }))
                }
                className="border-slate-300 bg-white" />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPasswordDialogOpen(false)}
              disabled={passwordSaving}>
              {t("cancel")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleChangePassword}
              disabled={passwordSaving}>
              {t("changePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
};

export default PersonalSettings;
