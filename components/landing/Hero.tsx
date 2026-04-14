"use client";

import { Button } from "@/components/ui/button";
import { motion, useInView } from "motion/react";
import { ArrowRight, Shield } from "lucide-react";
import dynamic from "next/dynamic";
import UserTypeDialog from "./UserTypeDialog";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Waves from "../icons/Waves";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

const DesktopLeafHero = dynamic(() => import("./LeafHero3D"), {
  ssr: false,
  loading: () => null,
});

const Hero = () => {
  const [showUserTypeDialog, setShowUserTypeDialog] = useState(false);
  const [isDesktopHero, setIsDesktopHero] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const locale = useLocale();
  const t = useTranslations("hero");
  const isHeroInView = useInView(heroRef, { amount: 0.15 });
  const heroTitle = t("title");
  const trustText = t("trust");
  const trustMatch =
    locale === "vi" ? trustText.match(/^(.*)\s(Việt Nam)$/u) : null;
  // const tFeatures = useTranslations("features");

  useEffect(() => {
    const syncViewport = () => {
      setIsDesktopHero(window.innerWidth >= 1024);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative flex w-full items-start justify-center overflow-x-clip overflow-y-hidden bg-gradient-hero pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-10 sm:pt-[calc(env(safe-area-inset-top)+6.5rem)] sm:pb-14 lg:min-h-[100svh] lg:items-center lg:pt-40 lg:pb-20"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-b from-primary-foreground to-secondary overflow-hidden pointer-events-none">
        {isDesktopHero ? (
          <DesktopLeafHero />
        ) : (
          <>
            <div className="absolute top-24 right-[-18%] h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-3xl sm:right-[-8%] sm:h-[28rem] sm:w-[28rem]" />
            <div className="absolute bottom-[-8%] right-[-10%] h-[20rem] w-[20rem] rounded-full border border-primary/10 bg-[radial-gradient(circle_at_30%_30%,rgba(45,69,29,0.16),rgba(45,69,29,0.06),transparent_72%)] blur-2xl sm:h-[24rem] sm:w-[24rem]" />
          </>
        )}

        {isDesktopHero ? (
          <>
            <motion.div
              className="absolute top-16 left-20 w-96 h-96 bg-primary/50 rounded-full blur-3xl"
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="absolute top-1/4 right-20 w-80 h-80 bg-accent/50 rounded-full blur-3xl"
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 0.5 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-primary/3 rounded-full blur-3xl"
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 0.3 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            />
          </>
        ) : (
          <>
            <div className="absolute top-12 left-[-18%] h-52 w-52 rounded-full bg-primary/25 blur-3xl sm:left-[-10%] sm:h-64 sm:w-64" />
            <div className="absolute top-1/3 right-[-10%] h-44 w-44 rounded-full bg-accent/20 blur-3xl sm:h-56 sm:w-56" />
            <div className="absolute bottom-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl sm:h-80 sm:w-80" />
          </>
        )}
      </div>

      <div className="container relative z-10 w-full max-w-full px-2 sm:px-6">
        <div className="mx-auto w-full max-w-[min(100%,40rem)] rounded-[28px] border border-white/60 bg-white/65 px-3 py-3 text-center shadow-[0_24px_60px_-32px_rgba(31,47,20,0.55)] backdrop-blur-md sm:max-w-[min(100%,44rem)] sm:p-6 md:max-w-4xl md:p-8 lg:mx-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:py-0 lg:pr-0 lg:pl-10 lg:text-left lg:shadow-none lg:backdrop-blur-none xl:pl-14">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-6 inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-primary sm:mb-8"
          >
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium sm:text-sm">{t("badge")}</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
            className="mb-5 text-3xl font-bold leading-[1.05] tracking-tight text-foreground sm:mb-6 sm:text-4xl md:text-5xl lg:text-7xl"
          >
            {heroTitle}{" "}
            <span className="text-gradient-forest">{t("titleHighlight")}</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="mb-8 text-base leading-7 text-muted-foreground sm:mb-10 sm:text-lg md:text-xl"
          >
            {t("subtitle")}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="mb-7 flex flex-col items-stretch gap-3 sm:mb-10 sm:flex-row sm:items-center sm:gap-4 md:mb-16"
          >
            <Button
              variant="hero"
              size="xl"
              className="h-12 w-full px-6 text-base sm:h-14 sm:w-auto sm:px-10 sm:text-lg"
              onClick={() => {
                trackEvent("wc_landing_start_clicked", {});
                setShowUserTypeDialog(true);
              }}
            >
              {t("cta.start")}
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Link
              href="/calculator"
              className="w-full sm:w-auto"
              onClick={() => {
                trackEvent("wc_landing_calculator_clicked", {});
              }}>
              <Button
                variant="heroOutline"
                size="xl"
                className="h-12 w-full px-6 text-base sm:h-14 sm:w-auto sm:px-10 sm:text-lg"
              >
                {t("cta.calculate")}
              </Button>
            </Link>
          </motion.div>

          {/* Feature highlights */}
          {/* <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title={tFeatures("carbonProxy.title")}
              description={tFeatures("carbonProxy.desc")}
            />
            <FeatureCard
              icon={<Recycle className="w-6 h-6" />}
              title={tFeatures("circularHub.title")}
              description={tFeatures("circularHub.desc")}
            />
            <FeatureCard
              icon={<Shield className="w-6 h-6" />}
              title={tFeatures("exportReady.title")}
              description={tFeatures("exportReady.desc")}
            />
          </motion.div> */}

          {/* Trust badge */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.25 }}
            className="max-w-xl text-center text-sm leading-6 text-muted-foreground md:text-left"
          >
            {trustMatch ? (
              <>
                <span>{trustMatch[1]} </span>
                <span className="block sm:inline">{trustMatch[2]}</span>
              </>
            ) : (
              trustText
            )}
          </motion.p>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-0 flex justify-center sm:top-16 lg:top-0">
        <Waves
          animated={isDesktopHero && isHeroInView}
          className={
            isDesktopHero ?
              "block h-[20rem] w-full opacity-80 lg:h-auto lg:opacity-100" :
              "block h-[20rem] w-[155%] max-w-none opacity-100 sm:h-[22rem] sm:w-[145%] md:w-full"
          }
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent via-secondary/65 to-secondary md:hidden" />
      <div className="pointer-events-none absolute bottom-[-1rem] left-1/2 h-10 w-[145%] -translate-x-1/2 rounded-full bg-secondary/90 blur-3xl md:hidden" />

      {/* User Type Selection Dialog */}
      <UserTypeDialog
        open={showUserTypeDialog}
        onOpenChange={setShowUserTypeDialog}
      />
    </section>
  );
};

// const FeatureCard = ({
//   icon,
//   title,
//   description,
// }: {
//   icon: React.ReactNode;
//   title: string;
//   description: string;
// }) => (
//   <motion.div
//     initial={{ opacity: 0, y: 18 }}
//     whileInView={{ opacity: 1, y: 0 }}
//     viewport={{ once: true, amount: 0.5 }}
//     transition={{ duration: 0.6, ease: "easeOut" }}
//     whileHover={{ y: -4, scale: 1.02 }}
//     className="glass-card rounded-2xl p-6 text-left transition-transform duration-300"
//   >
//     <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
//       {icon}
//     </div>
//     <h3 className="font-semibold text-foreground mb-2">{title}</h3>
//     <p className="text-sm text-muted-foreground">{description}</p>
//   </motion.div>
// );

export default Hero;
