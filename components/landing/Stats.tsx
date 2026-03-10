"use client";

import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import StatsWave from "@/components/icons/StatsWave";

const Stats = () => {
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

  return (
    <section
      id="impact"
      className="py-24 md:py-32 relative bg-linear-to-b from-primary to-forest-dark text-primary-foreground overflow-hidden"
    >
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
          className="max-w-3xl mx-auto text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            {t("badge")}
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
            {t("title")}
          </h2>
          <p className="text-lg text-primary-foreground/80">{t("subtitle")}</p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
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
              className="text-center p-8 rounded-2xl bg-primary-foreground/5 backdrop-blur-sm border border-primary-foreground/10 hover:bg-primary-foreground/10 transition-colors"
            >
              <div className="text-4xl md:text-5xl font-display font-bold mb-2">
                {stat.value}
              </div>
              <div className="font-semibold mb-1">{t(stat.labelKey)}</div>
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
