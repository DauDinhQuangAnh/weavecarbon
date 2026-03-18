"use client";

import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import StatsWave from "@/components/icons/StatsWave";

const Stats = () => {
  const locale = useLocale();
  const t = useTranslations("stats");
  const stats = [
    {
      value: "50K+",
      labelKey: "co2Tracked.title",
      description: "co2Tracked.description",
    },
    {
      value: "2.5M",
      labelKey: "carbon.title",
      description: "carbon.description",
    },
    {
      value: "180K",
      labelKey: "recycled.title",
      description: "recycled.description",
    },
    {
      value: "98%",
      labelKey: "exports.title",
      description: "exports.description",
    },
  ];

  const renderStatLabel = (labelKey: string) => {
    if (locale !== "vi") {
      return t(labelKey);
    }

    if (labelKey === "co2Tracked.title") {
      return (
        <>
          <span className="block md:inline">CO₂e</span>
          <span className="block md:inline md:ml-1">theo dõi</span>
        </>
      );
    }

    if (labelKey === "recycled.title") {
      return (
        <>
          <span className="block md:inline">Dệt may</span>
          <span className="block md:inline md:ml-1">tái chế</span>
        </>
      );
    }

    return t(labelKey);
  };

  return (
    <section
      id="impact"
      className="relative -mt-12 overflow-hidden bg-linear-to-b from-primary via-primary/95 to-forest-dark pt-14 pb-14 text-primary-foreground sm:-mt-16 sm:pt-16 sm:pb-16 md:mt-0 md:py-32"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 md:hidden">
        <div className="absolute inset-x-0 top-0 h-8 bg-linear-to-b from-primary/0 via-primary/60 to-primary" />
        <div className="absolute left-1/2 top-[-1rem] h-12 w-[138%] -translate-x-1/2 rounded-full bg-primary/90 blur-3xl" />
      </div>

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full border border-primary-foreground/30" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full border border-primary-foreground/20" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto mb-8 max-w-3xl text-center sm:mb-10 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            {t("badge")}
          </div>
          <h2 className="mx-auto mb-6 max-w-[11ch] text-balance text-3xl font-display font-bold leading-[1.08] md:max-w-none md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-lg text-primary-foreground/80">{t("subtitle")}</p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.labelKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                delay: index * 0.08,
              }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 text-center backdrop-blur-sm transition-colors hover:bg-primary-foreground/10 sm:p-6 md:p-8"
            >
              <div className="text-4xl md:text-5xl font-display font-bold mb-2">
                {stat.value}
              </div>
              <div className="mb-1 font-semibold leading-tight">
                {renderStatLabel(stat.labelKey)}
              </div>
              <div className="text-sm text-primary-foreground/70">
                {t(stat.description)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="absolute -bottom-96 left-0 right-0 z-0">
        <StatsWave />
      </div>
    </section>
  );
};

export default Stats;
