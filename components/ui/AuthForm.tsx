"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { ArrowRight, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import SocialLogin from "@/components/auth/SocialLogin";
import EmailAuthTabs from "@/components/auth/EmailAuthTabs";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { clearGoogleOAuthInflightState } from "@/lib/auth/googleOAuth";

const REMEMBER_EMAIL_KEY = "weavecarbon_auth_email";
const REMEMBER_ME_KEY = "weavecarbon_auth_remember_me";

type CompanyCheckPayload = {
  is_b2b?: boolean;
  has_company?: boolean;
  user_type?: "b2b" | "b2c" | "admin";
  data?: {
    is_b2b?: boolean;
    has_company?: boolean;
    user_type?: "b2b" | "b2c" | "admin";
  };
};

type AccountType = "b2b" | "b2c" | "admin";

const normalizeAccountType = (value?: string | null): AccountType | null => {
  if (value === "b2b" || value === "b2c" || value === "admin") {
    return value;
  }
  return null;
};

const parseAccountTypeMismatch = (message?: string | null) => {
  if (!message?.startsWith("ACCOUNT_TYPE_MISMATCH:")) {
    return null;
  }

  const [, actualRaw, expectedRaw] = message.split(":");
  const actual = normalizeAccountType(actualRaw);
  const expected = normalizeAccountType(expectedRaw);

  if (!actual || !expected) {
    return null;
  }

  return { actual, expected };
};

const normalizeCompanyCheck = (payload: CompanyCheckPayload | null) => {
  const nested = payload?.data;
  const source = nested || payload || {};
  const isB2b =
    typeof source.is_b2b === "boolean" ? source.is_b2b : source.user_type === "b2b";
  const hasCompany =
    typeof source.has_company === "boolean" ? source.has_company : false;
  return { isB2b, hasCompany };
};

const AuthForm: React.FC = () => {
  const locale = useLocale();
  const t = useTranslations("auth");
  const tUserType = useTranslations("userType");
  const { signUp, signIn, signInWithGoogle, startLocalDemo, signOut, user, loading } =
  useAuth();
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const userType = searchParams.get("type") as "b2b" | "b2c" || "b2b";
  const isVi = locale === "vi";
  const forceLogin = searchParams.get("forceLogin") === "1";
  const forceSignOutDoneRef = useRef(false);
  const forceLoginCheckedRef = useRef(false);
  const handledAuthErrorRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});
  const demoSectionLabel =
    t.has("demoSectionLabel") ?
      t("demoSectionLabel") :
      isVi ?
        "dùng thử nhanh" :
        "Quick trial";
  const demoSectionTitle =
    t.has("demoSectionTitle") ?
      t("demoSectionTitle") :
      isVi ?
        "Khám phá các không gian demo" :
        "Explore demo workspaces";
  const demoSectionDescription =
    t.has("demoSectionDescription") ?
      t("demoSectionDescription") :
      isVi ?
        "Mở ngay workspace mẫu để xem trước trải nghiệm mà không ảnh hưởng tới tài khoản thật." :
        "Open a sample workspace to preview the experience without affecting your real account.";
  const demoB2CLabel =
    t.has("demoB2CLabel") ?
      t("demoB2CLabel") :
      tUserType.has("demoB2C") ?
        tUserType("demoB2C") :
        "Demo B2C";
  const demoB2CComingSoon =
    t.has("demoB2CComingSoon") ?
      t("demoB2CComingSoon") :
      tUserType.has("demoComingSoon") ?
        tUserType("demoComingSoon") :
        isVi ?
          "Nút demo B2C hiện mới là placeholder, chưa có sự kiện xử lý." :
          "B2C demo is shown as a placeholder for now and has no action yet.";

  const getAccountTypeLabel = useCallback(
    (type?: AccountType | null) => {
      if (type === "b2b" || type === "b2c") {
        return tUserType(type);
      }
      return "Admin";
    },
    [tUserType]
  );

  const getAccountTypeMismatchMessage = useCallback(
    (actual?: AccountType | null, expected?: AccountType | null) =>
      t("messages.accountTypeMismatch", {
        actualAccountType: getAccountTypeLabel(actual),
        expectedAccountType: getAccountTypeLabel(expected || userType)
      }),
    [getAccountTypeLabel, t, userType]
  );

  const getDashboardPath = useCallback(
    (type: "b2b" | "b2c" | "admin" | undefined) => {
      return type === "b2c" ? "/b2c" : "/overview";
    },
    []
  );

  const resolvePostLoginPath = useCallback(async (
  accountType?: "b2b" | "b2c" | "admin") => {
    const effectiveType = accountType || userType;
    if (effectiveType === "b2c") return "/b2c";

    try {
      const payload = await api.get<CompanyCheckPayload>("/auth/check-company");
      const { isB2b, hasCompany } = normalizeCompanyCheck(payload);
      if (isB2b && !hasCompany) return "/onboarding";
      return "/overview";
    } catch {
      return "/overview";
    }
  }, [userType]);

  const redirectToCheckEmail = useCallback(
    (params: {email?: string;source?: "email" | "google";intent?: "signin" | "signup";}) => {
      const nextParams = new URLSearchParams();
      if (params.email?.trim()) {
        nextParams.set("email", params.email.trim());
      }
      if (params.source) {
        nextParams.set("source", params.source);
      }
      if (params.intent) {
        nextParams.set("intent", params.intent);
      }
      const query = nextParams.toString();
      router.push(query ? `/auth/check-email?${query}` : "/auth/check-email");
    },
    [router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRememberMe = localStorage.getItem(REMEMBER_ME_KEY);
    const rememberedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);

    if (storedRememberMe === "0" || storedRememberMe === "1") {
      setRememberMe(storedRememberMe === "1");
    }
    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const resetGoogleAuthState = () => {
      clearGoogleOAuthInflightState();
      setIsLoading(false);
    };

    resetGoogleAuthState();
    window.addEventListener("pageshow", resetGoogleAuthState);

    return () => {
      window.removeEventListener("pageshow", resetGoogleAuthState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "1" : "0");
    if (!rememberMe) {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  }, [rememberMe]);

  useEffect(() => {
    if (forceLogin || loading || !user) return;

    let cancelled = false;
    const redirectLoggedInUser = async () => {
      if (user.user_type === "b2b") {
        const destination = await resolvePostLoginPath(user.user_type);
        if (!cancelled) {
          router.push(destination);
        }
        return;
      }

      if (!cancelled) {
        router.push(getDashboardPath(user.user_type));
      }
    };

    void redirectLoggedInUser();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, getDashboardPath, forceLogin, resolvePostLoginPath]);

  useEffect(() => {
    if (!forceLogin || loading || forceLoginCheckedRef.current) return;

    forceLoginCheckedRef.current = true;

    if (user && !forceSignOutDoneRef.current) {
      forceSignOutDoneRef.current = true;
      void signOut();
    }
  }, [forceLogin, loading, user, signOut]);

  useEffect(() => {
    const errorCode = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    if (!errorCode) {
      handledAuthErrorRef.current = null;
      return;
    }

    const errorFingerprint = `${errorCode}|${errorDescription || ""}`;
    if (handledAuthErrorRef.current === errorFingerprint) return;
    handledAuthErrorRef.current = errorFingerprint;

    const mismatch =
      errorCode === "ACCOUNT_TYPE_MISMATCH" ?
        parseAccountTypeMismatch(`ACCOUNT_TYPE_MISMATCH:${errorDescription}:${userType}`) :
        null;

    const oauthErrors: Record<string, string> = {
      GOOGLE_ACCOUNT_NOT_FOUND: t("oauthErrors.accountNotFound"),
      GOOGLE_EMAIL_ALREADY_REGISTERED: t("oauthErrors.emailAlreadyRegistered"),
      INVALID_OAUTH_STATE: t("oauthErrors.invalidState"),
      GOOGLE_TOKEN_EXCHANGE_FAILED: t("oauthErrors.googleAuthFailed"),
      GOOGLE_USERINFO_FAILED: t("oauthErrors.googleAuthFailed"),
      GOOGLE_AUTH_FAILED: t("oauthErrors.googleAuthFailed"),
      MISSING_CODE: t("oauthErrors.missingCode"),
      EMAIL_NOT_VERIFIED: t("oauthErrors.emailNotVerified"),
      ACCOUNT_TYPE_MISMATCH:
        mismatch ?
          getAccountTypeMismatchMessage(mismatch.actual, mismatch.expected) :
          t("messages.invalidLoginByType", {
            accountType: userType === "b2c" ? t("messages.consumer") : t("messages.business")
          }),
      missing_tokens: t("oauthErrors.missingCode")
    };

    if (errorCode === "EMAIL_NOT_VERIFIED") {
      redirectToCheckEmail({
        email: errorDescription || email,
        source: "google",
        intent: "signin"
      });
      return;
    }

    const message = oauthErrors[errorCode] || errorDescription || errorCode;

    toast({
      title: t("oauthErrors.title"),
      description: message,
      variant: "destructive"
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("error_description");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/auth?${nextQuery}` : "/auth");
  }, [
    searchParams,
    toast,
    router,
    t,
    redirectToCheckEmail,
    email,
    getAccountTypeMismatchMessage,
    userType
  ]);

  const validateForm = (isSignUp: boolean) => {
    const emailSchema = z.string().email(t("validation.invalidEmail"));
    const passwordSchema = z.
    string().
    min(8, t("validation.passwordMin")).
    regex(/[A-Z]/, t("validation.passwordUppercase")).
    regex(/[a-z]/, t("validation.passwordLowercase")).
    regex(/[0-9]/, t("validation.passwordNumber")).
    regex(/[^A-Za-z0-9]/, t("validation.passwordSpecial"));

    const newErrors: {
      email?: string;
      password?: string;
      name?: string;
    } = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.issues[0].message;
      }
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.issues[0].message;
      }
    }

    if (isSignUp && !fullName.trim()) {
      newErrors.name = t("validation.fullNameRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsLoading(true);

    const { error, needsConfirmation } = await signIn(email, password, userType, {
      rememberMe
    });

    if (needsConfirmation) {
      setIsLoading(false);
      redirectToCheckEmail({
        email,
        source: "email",
        intent: "signin"
      });
      return;
    }

    if (error) {
      const mismatch = parseAccountTypeMismatch(error.message);
      setIsLoading(false);
      toast({
        title: t("error"),
        description:
        mismatch ?
          getAccountTypeMismatchMessage(mismatch.actual, mismatch.expected) :
          error.message === "Invalid login credentials" ?
            t("messages.invalidLoginByType", {
              accountType: userType === "b2c" ? t("messages.consumer") : t("messages.business")
            }) :
            error.message,
        variant: "destructive"
      });
    } else {
      if (typeof window !== "undefined" && rememberMe) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      }
      const destination = await resolvePostLoginPath();
      setIsLoading(false);
      router.push(destination);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    const result = await signUp(email, password, fullName, userType);

    if (result.error) {
      setIsLoading(false);
      let errorMessage = result.error.message;
      if (result.error.message.includes("already registered")) {
        errorMessage = t("messages.alreadyRegisteredPleaseLogin");
      }
      toast({
        title: t("error"),
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      setIsLoading(false);

      if (result.needsConfirmation) {
        toast({
          title: t("messages.checkEmailTitle"),
          description: t("messages.checkEmailDescription")
        });
        setActiveTab("login");
        redirectToCheckEmail({
          email,
          source: "email",
          intent: "signup"
        });
      } else {
        toast({
          title: t("messages.signupSuccessTitle"),
          description: t("messages.signupSuccessDescription")
        });
        const destination = await resolvePostLoginPath();
        router.push(destination);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const intent = activeTab === "signup" ? "signup" : "signin";
    const { error } = await signInWithGoogle(userType, intent, { rememberMe });

    if (error) {
      setIsLoading(false);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    const { error } = await startLocalDemo("b2b_standard_20");

    if (error) {
      setIsLoading(false);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(false);
    router.push("/demo/overview");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>);

  }

  if (authDisabled) {
    return (
      <Card className="border-border/50 shadow-xl">
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground text-center">
            {t("messages.authDisabled")}
          </p>
        </CardContent>
      </Card>);

  }

  return (
    <Card className="border-border/50 shadow-xl">
      <CardContent className="space-y-5 pt-6 md:space-y-6">
        <SocialLogin
          onGoogleLogin={handleGoogleLogin}
          isLoading={isLoading} />

        <EmailAuthTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          fullName={fullName}
          setFullName={setFullName}
          errors={errors}
          isLoading={isLoading}
          onLogin={handleEmailLogin}
          onSignUp={handleEmailSignUp}
          rememberMe={rememberMe}
          setRememberMe={setRememberMe} />

        <div className="rounded-2xl border border-primary/12 bg-linear-to-r from-primary/[0.07] via-primary/[0.04] to-transparent p-4 sm:p-5">
          <div className="space-y-4">
            <div
              className="space-y-2 text-left"
              data-demo-copy={`${demoSectionTitle} ${demoSectionDescription}`}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>{demoSectionLabel}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-primary/20 bg-background/90 hover:bg-background"
                disabled={isLoading}
                onClick={handleDemoLogin}
              >
                {isLoading ? t("loading") : tUserType("demoB2B")}
                {!isLoading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-dashed border-border bg-background/70 text-muted-foreground"
                disabled
                title={demoB2CComingSoon}
              >
                <User className="h-4 w-4" />
                <span>{demoB2CLabel}</span>
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {demoB2CComingSoon}
          </p>
        </div>

      </CardContent>
    </Card>);

};

export default AuthForm;
