"use client";

import { motion } from "motion/react";
import { Leaf, Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import UserTypeDialog from "./UserTypeDialog";
import { LanguageToggle } from "../ui/LanguageToggle";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

const Header = () => {
  const navigate = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserTypeDialog, setShowUserTypeDialog] = useState(false);
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const sectionOffsets: Record<string, number> = {
    "#features": 28,
    "#how-it-works": 22,
    "#impact": 18,
    "#contact": 14,
  };

  const getSectionOffset = (href: string) => {
    const defaultOffset = sectionOffsets[href] ?? 16;

    if (!window.matchMedia("(max-width: 1023px)").matches) {
      return defaultOffset;
    }

    const mobileSectionOffsets: Record<string, number> = {
      "#how-it-works": 32,
    };

    return mobileSectionOffsets[href] ?? defaultOffset;
  };

  const navLinks = [
    { labelKey: "features", href: "#features" },
    { labelKey: "howItWorks", href: "#how-it-works" },
    { labelKey: "impact", href: "#impact" },
    { labelKey: "contact", href: "#contact" },
  ];

  const scrollToSection = (href: string) => {
    const target = document.querySelector<HTMLElement>(href);
    if (!target) return;

    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
    const top =
      target.getBoundingClientRect().top +
      window.scrollY -
      headerHeight +
      getSectionOffset(href);

    if (window.location.hash !== href) {
      window.history.replaceState(null, "", href);
    }

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  };

  const handleAnchorClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    if (!href.startsWith("#")) return;

    event.preventDefault();
    setIsMenuOpen(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToSection(href);
      });
    });
  };

  return (
    <>
      <motion.header
        ref={headerRef}
        initial={{ y: -100 }}
        animate={{
          y: [null, 0],
          transition: { duration: 0.5, times: [0, 1] },
        }}
        className="fixed top-0 left-0 right-0 z-50 overflow-x-clip backdrop-blur-md bg-white/70"
      >
        <div className="mx-auto w-full max-w-[1800px] px-3 sm:px-4 md:px-6 lg:px-8 2xl:px-10">
          <div className="relative flex h-14 items-center justify-between gap-2 sm:h-16 md:h-20">
            <Link href="/" className="group flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-forest shadow-md transition-shadow group-hover:shadow-lg sm:h-10 sm:w-10">
                <Leaf className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
              </div>
              <span className="max-w-[9.5rem] truncate text-base font-display font-semibold text-foreground sm:max-w-none sm:text-xl">
                WeaveCarbon
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
              {pathname !== "/calculator" && (
                <>
                  {navLinks.map((link) =>
                    link.href.startsWith("/") ? (
                      <Link
                        key={link.labelKey}
                        href={link.href}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t(link.labelKey)}
                      </Link>
                    ) : (
                      <a
                        key={link.labelKey}
                        href={link.href}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(event) => handleAnchorClick(event, link.href)}
                      >
                        {t(link.labelKey)}
                      </a>
                    ),
                  )}
                </>
              )}
            </nav>

            <div className="hidden lg:flex items-center justify-end gap-3">
              <LanguageToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate.push("/calculator")}
              >
                {t("calculator")}
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={() => setShowUserTypeDialog(true)}
              >
                {t("login")}
              </Button>
            </div>

            <div className="flex shrink-0 gap-1.5 sm:gap-2 lg:hidden">
              <LanguageToggle />
              <button
                className="shrink-0 rounded-lg p-2 text-foreground hover:bg-muted sm:p-2.5 lg:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden bg-background border-b border-border animate-fade-in">
            <nav className="mx-auto w-full max-w-[1800px] flex flex-col gap-4 px-4 py-4 md:px-6 lg:px-8 2xl:px-10">
              {navLinks.map((link) =>
                link.href.startsWith("/") ? (
                  <Link
                    key={link.labelKey}
                    href={link.href}
                    className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t(link.labelKey)}
                  </Link>
                ) : (
                    <a
                      key={link.labelKey}
                      href={link.href}
                      className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={(event) => handleAnchorClick(event, link.href)}
                    >
                      {t(link.labelKey)}
                    </a>
                ),
              )}
              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate.push("/calculator");
                  }}
                >
                  {t("calculator")}
                </Button>
                <Button
                  variant="hero"
                  className="w-full justify-center"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowUserTypeDialog(true);
                  }}
                >
                  {t("login")}
                </Button>
              </div>
            </nav>
          </div>
        )}
      </motion.header>

      <UserTypeDialog
        open={showUserTypeDialog}
        onOpenChange={setShowUserTypeDialog}
      />
    </>
  );
};

export default Header;
