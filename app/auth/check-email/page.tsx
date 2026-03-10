"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckEmailPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();

  const source = searchParams.get("source") === "google" ? "google" : "email";
  const email = (searchParams.get("email") || "").trim();

  const hintText = useMemo(
    () =>
      source === "google"
        ? t("checkEmailPage.googleHint")
        : t("checkEmailPage.emailHint"),
    [source, t]
  );

  return (
    <Card className="border-border/50 shadow-xl">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl flex items-center justify-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          {t("checkEmailPage.title")}
        </CardTitle>
        <CardDescription>{t("checkEmailPage.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {email &&
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            {t("checkEmailPage.emailLabel")}: <span className="font-medium">{email}</span>
          </div>
        }
        <p className="text-xs text-muted-foreground">{hintText}</p>

        <div className="grid gap-2">
          <Button
            type="button"
            onClick={() => router.push("/auth")}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("checkEmailPage.continueSignin")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
