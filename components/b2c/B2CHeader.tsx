"use client";

import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Leaf, Star } from "lucide-react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CHeaderProps {
  profile: UserProfile | null;
  onSignOut: () => void;
}

const B2CHeader: React.FC<B2CHeaderProps> = ({
  profile,
  onSignOut
}) => {
  const t = useTranslations("b2c");

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/b2c"
              className="flex items-center gap-2 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-forest shadow-sm">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-foreground">
                WEAVE<span className="text-primary">CARBON</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-500" />
              {profile?.circularPoints || 0} {t("pointsAbbrev")}
            </Badge>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">{t("signOut")}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>);

};

export default B2CHeader;
