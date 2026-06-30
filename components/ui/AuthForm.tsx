"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { ArrowRight, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildCheckEmailUrl,
  normalizeAuthUserTypeOrNull,
  resolvePostLoginPath as resolveSharedPostLoginPath
} from "@/lib/auth/routing";
import {
  Card,
  CardContent
} from "@/components/ui/card";
import SocialLogin from "@/components/auth/SocialLogin";
import EmailAuthTabs from "@/components/auth/EmailAuthTabs";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { clearGoogleOAuthInflightState } from "@/lib/auth/googleOAuth";const REMEMBER_EMAIL_KEY = "weavecarbon_auth_email";
const REMEMBER_ME_KEY = "weavecarbon_auth_remember_me";

type AccountType = "b2b" | "b2c" | "admin";

const normalizeAccountType = (value?: string | null): AccountType | null => {
  return normalizeAuthUserTypeOrNull(value);
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

const AuthForm: React.FC = () => {
  const t = useTranslations("auth");
  const tUserType = useTranslations("userType");
  const { signUp, signIn, signInWithGoogle, signInDemo, startLocalDemo, signOut, user, loading } =
  useAuth();
  const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "1";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const userType = searchParams.get("type") === "b2c" ? "b2c" : "b2b";
  const forceLogin = searchParams.get("forceLogin") === "1";
  const forceSignOutDoneRef = useRef(false);
  const forceLoginCheckedRef = useRef(false);
  const handledAuthErrorRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"b2b" | "b2c" | null>(null);
  const [activeTab, setActiveTab] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
  }>({});
  const demoSectionLabel =
    t.has("demoSectionLabel") ?
      t("demoSectionLabel") :
      "D\u00f9ng th\u1eed nhanh";
  const demoSectionTitle =
    t.has("demoSectionTitle") ?
      t("demoSectionTitle") :
      "Kh\u00e1m ph\u00e1 c\u00e1c kh\u00f4ng gian demo";
  const demoSectionDescription =
    t.has("demoSectionDescription") ?
      t("demoSectionDescription") :
      "M\u1edf ngay workspace m\u1eabu \u0111\u1ec3 xem tr\u01b0\u1edbc tr\u1ea3i nghi\u1ec7m m\u00e0 kh\u00f4ng \u1ea3nh h\u01b0\u1edfng t\u1edbi t\u00e0i kho\u1ea3n th\u1eadt.";
  const demoB2CLabel =
    t.has("demoB2CLabel") ?
      t("demoB2CLabel") :
      tUserType.has("demoB2C") ?
        tUserType("demoB2C") :
        "Demo B2C";
  const openDemoB2CLabel =
    t.has("openDemoB2C") ?
      t("openDemoB2C") :
      demoB2CLabel;

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

  const resolvePostLoginPath = useCallback(async (
  accountType?: "b2b" | "b2c" | "admin") => {
    return resolveSharedPostLoginPath({
      accountType: accountType || userType,
      onboardingPath: "/onboarding"
    });
  }, [userType]);

  const redirectToCheckEmail = useCallback(
    (params: {email?: string;source?: "email" | "google";intent?: "signin" | "signup";}) => {
      router.push(buildCheckEmailUrl({
        email: params.email,
        intent: params.intent,
        source: params.source,
        type: userType
      }));
    },
    [router, userType]
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
    const { error } = await signInWithGoogle(userType, intent);

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
    setDemoLoading("b2b");
    const { error } = await startLocalDemo("b2b_standard_20");

    if (error) {
      setIsLoading(false);
      setDemoLoading(null);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(false);
    setDemoLoading(null);
    router.push("/demo/overview");
  };

  const handleB2CDemoLogin = async () => {
    setIsLoading(true);
    setDemoLoading("b2c");
    const { error } = await signInDemo("b2c");

    if (error) {
      setIsLoading(false);
      setDemoLoading(null);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(false);
    setDemoLoading(null);
    router.push("/b2c");
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
                {demoLoading === "b2b" ? t("loading") : tUserType("demoB2B")}
                {demoLoading !== "b2b" && <ArrowRight className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-primary/20 bg-background/90 hover:bg-background"
                disabled={isLoading}
                onClick={handleB2CDemoLogin}
              >
                <User className="h-4 w-4" />
                <span>{demoLoading === "b2c" ? t("loading") : openDemoB2CLabel}</span>
                {demoLoading !== "b2c" && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>);

};

export default AuthForm;
