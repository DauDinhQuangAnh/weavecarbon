"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Home, ArrowLeft, Leaf, Star } from "lucide-react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CHeaderProps {
  profile: UserProfile | null;
  onSignOut: () => void;
  onNavigateBack: () => void;
  onNavigateHome: () => void;
}

const B2CHeader: React.FC<B2CHeaderProps> = ({
  profile,
  onSignOut,
  onNavigateBack,
  onNavigateHome
}) => {
  const t = useTranslations("b2c");

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateBack}
              className="text-muted-foreground hover:text-foreground">
              
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNavigateHome}
              className="text-muted-foreground hover:text-foreground">
              
              <Home className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-forest flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-foreground hidden sm:block">
                WEAVE<span className="text-primary">CARBON</span>
              </span>
            </div>
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
