"use client";
import { motion, useInView } from "motion/react";
import {
  CheckCircle2,
  ClipboardList,
  FileCheck,
  Package,
  Recycle,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const HowItWorks = () => {
  const t = useTranslations("howItWorks");
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [reducedEffects, setReducedEffects] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    const syncReducedEffects = () => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;

      setReducedEffects(
        prefersReducedMotion || isCoarsePointer || hardwareConcurrency <= 6,
      );
      setIsDesktopLayout(window.innerWidth >= 1024);
    };

    syncReducedEffects();
    window.addEventListener("resize", syncReducedEffects);
    return () => {
      window.removeEventListener("resize", syncReducedEffects);
    };
  }, []);

  const steps = [
    {
      number: "01",
      icon: <ClipboardList className="w-7 h-7" />,
      titleKey: "step1.title",
      descKey: "step1.desc",
      items: ["step1.item1", "step1.item2", "step1.item3"],
      gradient:
        "linear-gradient(135deg, hsl(96 41% 19%) 0%, hsl(96 30% 30%) 100%)",
      glowColor: "hsl(96 41% 19% / 0.15)",
      borderColor: "hsl(96 41% 19% / 0.2)",
    },
    {
      number: "02",
      icon: <Package className="w-7 h-7" />,
      titleKey: "step2.title",
      descKey: "step2.desc",
      items: ["step2.item1", "step2.item2", "step2.item3"],
      gradient:
        "linear-gradient(135deg, hsl(96 30% 40%) 0%, hsl(96 25% 35%) 100%)",
      glowColor: "hsl(96 30% 40% / 0.15)",
      borderColor: "hsl(96 30% 40% / 0.2)",
    },
    {
      number: "03",
      icon: <Recycle className="w-7 h-7" />,
      titleKey: "step3.title",
      descKey: "step3.desc",
      items: ["step3.item1", "step3.item2", "step3.item3"],
      gradient:
        "linear-gradient(135deg, hsl(25 45% 50%) 0%, hsl(25 35% 45%) 100%)",
      glowColor: "hsl(25 45% 50% / 0.15)",
      borderColor: "hsl(25 45% 50% / 0.2)",
    },
    {
      number: "04",
      icon: <FileCheck className="w-7 h-7" />,
      titleKey: "step4.title",
      descKey: "step4.desc",
      items: ["step4.item1", "step4.item2", "step4.item3"],
      gradient:
        "linear-gradient(135deg, hsl(25 35% 60%) 0%, hsl(30 25% 65%) 100%)",
      glowColor: "hsl(25 35% 60% / 0.15)",
      borderColor: "hsl(25 35% 60% / 0.2)",
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative -mt-8 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,rgba(44,68,29,0.08)_22%,rgba(44,68,29,0.32)_56%,#2c441d_100%)] pt-[4.75rem] pb-14 sm:-mt-10 sm:pt-[4.75rem] sm:pb-16 md:mt-0 md:bg-linear-to-t md:from-primary md:via-primary/5 md:to-background md:py-32"
      style={{ contain: "layout paint" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 md:hidden">
        <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-white/0 via-white/75 to-white" />
      </div>

      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-1/4 -left-48 w-96 h-96 rounded-full bg-primary/5 ${
            reducedEffects ? "opacity-60 blur-2xl" : "blur-3xl"
          }`}
        />
        <div
          className={`absolute bottom-1/4 -right-48 w-96 h-96 rounded-full bg-primary/5 ${
            reducedEffects ? "opacity-60 blur-2xl" : "blur-3xl"
          }`}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto mb-10 max-w-3xl text-center sm:mb-12 md:mb-20"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-linear-to-r from-primary/10 to-primary/5 text-primary text-sm font-medium mb-6 border border-primary/20"
          >
            <Sparkles className="w-4 h-4" />
            {t("badge")}
          </motion.span>
          <h2 className="text-4xl md:text-6xl font-display font-bold text-foreground mb-6 bg-clip-text bg-linear-to-r from-foreground to-foreground/70">
            {t("title")}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Timeline Steps */}
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            {/* Animated vertical line for mobile/tablet */}
            {!isDesktopLayout && (
              reducedEffects ? (
                <div className="lg:hidden absolute left-8 top-0 h-full w-0.5 bg-linear-to-b from-primary via-primary/50 to-primary/20" />
              ) : (
                <motion.div
                  initial={{ height: 0 }}
                  animate={isInView ? { height: "100%" } : { height: 0 }}
                  transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
                  className="lg:hidden absolute left-8 top-0 w-0.5 bg-linear-to-b from-primary via-primary/50 to-primary/20"
                />
              )
            )}

            {steps.map((step, index) => {
              const isEven = index % 2 === 0;

              return (
                <div key={step.number} className="relative">
                  {isDesktopLayout ? (
                    <div className="hidden lg:block">
                      {/* Desktop Layout - Alternating sides */}
                        <div
                          className={`flex items-center gap-12 mb-24 ${isEven ? "" : "flex-row-reverse"}`}
                        >
                          {/* Content Card */}
                          <motion.div
                            initial={{ opacity: 0, x: isEven ? -60 : 60 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{
                              duration: 0.7,
                              ease: "easeOut",
                              delay: index * 0.15,
                            }}
                            className="flex-1 transform-gpu"
                          >
                            <motion.div
                              whileHover={reducedEffects ? undefined : { scale: 1.02, y: -8 }}
                              transition={{ duration: 0.3 }}
                              className={`relative rounded-3xl p-8 shadow-lg transition-all duration-300 group ${
                                reducedEffects ?
                                  "bg-card hover:shadow-xl" :
                                  "bg-card/80 backdrop-blur-sm hover:shadow-2xl"
                              }`}
                              style={{
                                borderWidth: "1px",
                                borderColor: step.borderColor,
                              }}
                            >
                              {/* Gradient overlay on hover */}
                              <div
                                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-5 transition-opacity duration-300"
                                style={{ background: step.gradient }}
                              />

                              <div className="relative z-10">
                                {/* Number */}
                                <div className="flex items-center justify-between mb-6">
                                  <span className="text-7xl font-display font-bold bg-clip-text text-transparent bg-linear-to-br from-primary/30 to-primary/10">
                                    {step.number}
                                  </span>
                                  <motion.div
                                    whileHover={reducedEffects ? undefined : { rotate: 360, scale: 1.1 }}
                                    transition={{ duration: 0.6 }}
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
                                    style={{ background: step.gradient }}
                                  >
                                    {step.icon}
                                  </motion.div>
                                </div>

                                <h3 className="text-2xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                                  {t(step.titleKey)}
                                </h3>
                                <p className="text-muted-foreground mb-6 leading-relaxed">
                                  {t(step.descKey)}
                                </p>

                                {/* Checklist */}
                                <ul className="space-y-3">
                                  {step.items.map((item) => (
                                    <li
                                      key={item}
                                      className="flex items-start gap-3 text-sm text-muted-foreground group/item"
                                    >
                                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5 group-hover/item:scale-110 transition-transform" />
                                      <span className="group-hover/item:text-foreground transition-colors">
                                        {t(item)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </motion.div>
                          </motion.div>

                          {/* Center Node */}
                          <div className="relative shrink-0">
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              whileInView={{ scale: 1, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{
                                duration: 0.5,
                                delay: index * 0.15 + 0.3,
                              }}
                              className="relative transform-gpu"
                            >
                              <div
                                aria-hidden="true"
                                data-step-number={step.number}
                                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-2xl ring-8 ring-background before:content-[attr(data-step-number)]"
                                style={{ background: step.gradient }}
                              />
                              <div
                                className="absolute inset-0 -z-10 rounded-full opacity-20 blur-md"
                                style={{ background: step.gradient }}
                              />
                            </motion.div>

                            {/* Connecting line */}
                            {index < steps.length - 1 && (
                              reducedEffects ? (
                                <div
                                  className="absolute left-1/2 top-20 w-1 -translate-x-1/2 bg-linear-to-b from-primary to-primary/20"
                                  style={{ height: "calc(100% + 6rem)" }}
                                />
                              ) : (
                                <motion.div
                                  initial={{ height: 0 }}
                                  whileInView={{ height: "100%" }}
                                  viewport={{ once: true }}
                                  transition={{
                                    duration: 0.8,
                                    delay: index * 0.15 + 0.5,
                                  }}
                                  className="absolute left-1/2 top-20 w-1 -translate-x-1/2 bg-linear-to-b from-primary to-primary/20"
                                  style={{ height: "calc(100% + 6rem)" }}
                                />
                              )
                            )}
                          </div>

                          {/* Empty space for alternating layout */}
                          <div className="flex-1" />
                        </div>
                    </div>
                  ) : (
                    <div
                      className={`lg:hidden ${index === steps.length - 1 ? "" : "mb-6 sm:mb-8"}`}
                    >
                      {/* Mobile/Tablet Layout */}
                        <div className="flex gap-6">
                          {/* Timeline node */}
                          <div className="relative shrink-0">
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              whileInView={{ scale: 1, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.5, delay: index * 0.15 }}
                              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-xl ring-4 ring-background relative z-10"
                              style={{ background: step.gradient }}
                            >
                              {step.number}
                            </motion.div>
                          </div>

                          {/* Content */}
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.15 }}
                            className="flex-1 pb-2 sm:pb-4 transform-gpu"
                          >
                            <div
                              className={`rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 ${
                                reducedEffects ? "bg-card" : "bg-card/80 backdrop-blur-sm"
                              }`}
                              style={{
                                borderWidth: "1px",
                                borderColor: step.borderColor,
                              }}
                            >
                              <div className="flex items-center gap-4 mb-4">
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                                  style={{ background: step.gradient }}
                                >
                                  <div className="scale-[0.72]">{step.icon}</div>
                                </div>
                                <h3 className="text-xl font-bold text-foreground flex-1">
                                  {t(step.titleKey)}
                                </h3>
                              </div>

                              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                                {t(step.descKey)}
                              </p>

                              <ul className="space-y-2">
                                {step.items.map((item) => (
                                  <li
                                    key={item}
                                    className="flex items-start gap-2 text-sm text-muted-foreground"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span>{t(item)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
