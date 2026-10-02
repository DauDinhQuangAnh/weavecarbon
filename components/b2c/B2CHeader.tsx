"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Leaf, Coins, HeartHandshake, MapPin, TicketPercent, History } from "lucide-react";
import { UserProfile } from "@/hooks/useUserProfile";
import { useTranslations } from "next-intl";

interface B2CHeaderProps {
  profile: UserProfile | null;
  onSignOut: () => void;
}

const navItems = [
  { label: "Trang chủ", href: "/b2c", icon: Leaf },
  { label: "Quyên góp", href: "/b2c/donate", icon: HeartHandshake },
  { label: "Điểm thu gom", href: "/b2c/collection-points", icon: MapPin },
  { label: "Đổi ưu đãi", href: "/b2c/coupons", icon: TicketPercent },
  { label: "Lịch sử", href: "/b2c/history", icon: History },
];

const B2CHeader: React.FC<B2CHeaderProps> = ({
  profile,
  onSignOut
}) => {
  const t = useTranslations("b2c");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md transition-colors">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link
              href="/b2c"
              className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-forest shadow-sm">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-base font-bold tracking-tight text-foreground sm:text-lg">
                  WEAVE<span className="text-primary">CARBON</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground -mt-1">
                  Circular Consumer
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/b2c" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right actions: Points badge & Sign out */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 shadow-xs">
              <Coins className="h-4 w-4 text-amber-600" />
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-foreground">
                  {(profile?.circularPoints || 0).toLocaleString("vi-VN")}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t("pointsAbbrev") || "pts"}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              className="h-8 border-border text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">{t("signOut") || "Đăng xuất"}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1 border-t border-border/60 scrollbar-none">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/b2c" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default B2CHeader;
