"use client";

import React from "react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CWelcomeProps {
  profile: UserProfile | null;
}

const B2CWelcome: React.FC<B2CWelcomeProps> = ({ profile }) => {
  const t = useTranslations("b2c.welcome");

  return (
    <div className="text-center py-4">
      <h1 className="text-2xl font-display font-bold mb-2">
        {t("greeting", { name: profile?.fullName || t("fallbackUser") })} 👋
      </h1>
      <p className="text-muted-foreground">
        {t("subtitle")}
      </p>
    </div>);

};

export default B2CWelcome;
