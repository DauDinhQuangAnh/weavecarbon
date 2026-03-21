"use client";
import { motion, AnimatePresence, useInView } from "motion/react";
import {
  BarChart3,
  Globe,
  Leaf,
  Package,
  PieChart,
  Recycle,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const DESKTOP_DECORATIVE_PARTICLES = [
  { left: "18%", top: "18%", size: 8, duration: 4.2, delay: 0.1, drift: 16 },
  { left: "26%", top: "68%", size: 10, duration: 5.1, delay: 0.5, drift: 22 },
  { left: "37%", top: "24%", size: 6, duration: 4.6, delay: 0.9, drift: 18 },
  { left: "61%", top: "22%", size: 9, duration: 5.4, delay: 0.3, drift: 20 },
  { left: "74%", top: "33%", size: 7, duration: 4.8, delay: 1.1, drift: 16 },
  { left: "81%", top: "58%", size: 10, duration: 5.6, delay: 0.7, drift: 24 },
  { left: "67%", top: "78%", size: 8, duration: 4.4, delay: 1.3, drift: 18 },
  { left: "43%", top: "82%", size: 9, duration: 5.2, delay: 0.2, drift: 20 },
] as const;

const ORBITING_DOT_ROTATIONS = [0, 120, 240] as const;

type FeatureItem = {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  gradient: string;
  glowColor: string;
};

interface FeatureLayoutProps {
  features: FeatureItem[];
  t: (key: string) => string;
  reducedEffects?: boolean;
}

const MobileSliderLayout: React.FC<FeatureLayoutProps> = ({
  features,
  t,
  reducedEffects = false,
}) => {
  const locale = useLocale();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const isSliderInView = useInView(sliderRef, { amount: 0.35 });
  const activeFeature = features[activeIndex];
  const mobileHeaderTitle =
    locale === "vi" ?
      ["Tính năng mạnh mẽ", "thời trang bền vững"] :
      [t("title")];
  const mobileHeaderSubtitle =
    locale === "vi" ?
      t("subtitle").replace("khí thải carbon", "khí thải\u00a0carbon") :
      t("subtitle");

  const selectIndex = (index: number) => {
    const safeIndex = Math.max(0, Math.min(index, features.length - 1));
    if (safeIndex === activeIndex) return;

    setDirection(safeIndex > activeIndex ? 1 : -1);
    setActiveIndex(safeIndex);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touchStartX = touchStartXRef.current;
    const touchEndX = event.changedTouches[0]?.clientX;

    touchStartXRef.current = null;

    if (touchStartX === null || typeof touchEndX !== "number") return;

    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) < 42) return;

    selectIndex(activeIndex + (deltaX < 0 ? 1 : -1));
  };

  useEffect(() => {
    if (reducedEffects || features.length <= 1 || !isSliderInView) return;

    const timer = window.setTimeout(() => {
      setDirection(1);
      setActiveIndex((currentIndex) => (currentIndex + 1) % features.length);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeIndex, features.length, isSliderInView, reducedEffects]);

  return (
    <>
      {/* Background blur mesh */}
      <div className="absolute inset-0 bg-linear-to-b from-secondary to-background overflow-hidden pointer-events-none">
        {/* Large forest orb */}
        <div
          className={`absolute top-12 -left-20 w-64 h-64 rounded-full ${reducedEffects ? "blur-2xl" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 30% 40% / 0.5) 0%, hsl(96 41% 25% / 0.3) 100%)",
          }}
        />

        {/* Top right accent */}
        <div
          className={`absolute top-32 -right-16 w-56 h-56 rounded-full ${reducedEffects ? "blur-2xl" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(40 20% 85% / 0.4) 0%, hsl(30 30% 80% / 0.2) 100%)",
          }}
        />

        {/* Bottom accent */}
        <div
          className={`absolute -bottom-20 left-1/3 w-64 h-64 rounded-full ${reducedEffects ? "blur-2xl" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(25 45% 50% / 0.35) 0%, hsl(96 30% 35% / 0.25) 100%)",
          }}
        />

        {/* Bottom right accent */}
        <div
          className={`absolute -bottom-12 -right-20 w-56 h-56 rounded-full ${reducedEffects ? "blur-2xl" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 40% 30% / 0.4) 0%, hsl(96 30% 40% / 0.3) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div ref={sliderRef} className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto mb-10 max-w-[22rem] text-center"
        >
          <span
            className={`mb-4 inline-flex rounded-full border border-primary/10 px-4 py-1.5 text-sm font-medium text-primary shadow-sm ${
              reducedEffects ? "bg-white/85" : "bg-white/55 backdrop-blur-sm"
            }`}
          >
            {t("badge")}
          </span>
          <h2 className="mb-4 text-[2.15rem] font-display font-bold leading-[1.08] tracking-tight text-foreground">
            {mobileHeaderTitle.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="mx-auto max-w-[20.75rem] text-pretty text-[1rem] leading-7 text-muted-foreground">
            {mobileHeaderSubtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.65, ease: "easeOut", delay: 0.1 }}
          className="mx-auto max-w-sm"
        >
          <div
            className={`relative overflow-hidden rounded-[2rem] border border-white/65 p-3 shadow-[0_26px_70px_-40px_rgba(45,74,28,0.5)] ${
              reducedEffects ? "bg-white/90" : "bg-white/45 backdrop-blur-md"
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {!reducedEffects && (
              <div
                className="pointer-events-none absolute inset-x-5 top-1 h-20 rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, hsl(96 35% 38% / 0.22) 0%, hsl(96 35% 38% / 0) 72%)",
                }}
              />
            )}

            <div className="relative min-h-[19.5rem]">
              <AnimatePresence
                mode={reducedEffects ? "sync" : "wait"}
                initial={false}
                custom={direction}
              >
                <motion.div
                  key={activeFeature.titleKey}
                  custom={direction}
                  initial={{
                    opacity: 0,
                    x: reducedEffects ? 0 : direction >= 0 ? 42 : -42,
                    scale: reducedEffects ? 0.985 : 0.96,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: reducedEffects ? 0 : direction >= 0 ? -42 : 42,
                    scale: reducedEffects ? 0.985 : 0.96,
                  }}
                  transition={{
                    duration: reducedEffects ? 0.2 : 0.32,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 transform-gpu"
                >
                  <div
                    className="relative flex h-full flex-col overflow-hidden rounded-[1.65rem] border border-primary/10 bg-white/88 px-5 pb-5 pt-5 shadow-[0_22px_60px_-42px_rgba(51,77,34,0.52)]"
                    style={{
                      boxShadow: `0 24px 64px -42px ${activeFeature.glowColor}`,
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1.5"
                      style={{ background: activeFeature.gradient }}
                    />

                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] text-white shadow-lg"
                        style={{ background: activeFeature.gradient }}
                      >
                        {activeFeature.icon}
                      </div>

                      <div className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary/60">
                        WeaveCarbon
                      </div>
                    </div>

                    <div className="mt-5">
                      <h3 className="text-[1.8rem] font-display font-bold leading-[1.05] tracking-tight text-foreground">
                        {t(activeFeature.titleKey)}
                      </h3>
                      <p className="mt-4 text-[0.98rem] leading-7 text-muted-foreground">
                        {t(activeFeature.descKey)}
                      </p>
                    </div>

                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

// Desktop Circular Constellation Layout
interface DesktopLayoutProps {
  features: FeatureItem[];
  t: (key: string) => string;
  reducedEffects?: boolean;
}

const MobileGridLayout: React.FC<FeatureLayoutProps> = ({
  features,
  t,
  reducedEffects = false,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <>
      {/* Background blur mesh */}
      <div className="absolute inset-0 bg-linear-to-b from-secondary to-background overflow-hidden pointer-events-none">
        <div
          className="absolute top-12 -left-20 w-64 h-64 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 30% 40% / 0.5) 0%, hsl(96 41% 25% / 0.3) 100%)",
          }}
        />
        <div
          className="absolute top-32 -right-16 w-56 h-56 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(40 20% 85% / 0.4) 0%, hsl(30 30% 80% / 0.2) 100%)",
          }}
        />
        <div
          className="absolute -bottom-20 left-1/3 w-64 h-64 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(25 45% 50% / 0.35) 0%, hsl(96 30% 35% / 0.25) 100%)",
          }}
        />
        <div
          className="absolute -bottom-12 -right-20 w-56 h-56 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 40% 30% / 0.4) 0%, hsl(96 30% 40% / 0.3) 100%)",
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t("badge")}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            {t("subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: "easeOut",
              }}
              className="group"
            >
              <motion.div
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className={`relative min-h-fit cursor-pointer rounded-2xl border border-primary/10 p-5 transition-all duration-300 hover:border-primary/30 sm:p-6 ${
                  reducedEffects ? "bg-card" : "bg-card/80 backdrop-blur-sm"
                }`}
                style={{
                  borderColor:
                    expandedIndex === index ? feature.glowColor : "inherit",
                }}
              >
                <motion.div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: feature.gradient }}
                />

                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                    style={{ background: feature.gradient }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {feature.icon}
                  </motion.div>

                  <div className="flex-1">
                    <h3 className="text-lg md:text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {t(feature.titleKey)}
                    </h3>
                  </div>
                </div>

                <div className="block md:hidden text-xs text-muted-foreground line-clamp-2">
                  {t(feature.descKey)}
                </div>

                <motion.div
                  initial={false}
                  animate={{
                    height: expandedIndex === index ? "auto" : 0,
                    opacity: expandedIndex === index ? 1 : 0,
                    marginTop: expandedIndex === index ? 12 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden block md:hidden"
                >
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(feature.descKey)}
                  </p>
                </motion.div>

                <p className="hidden md:block text-sm text-muted-foreground leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
};

const DesktopCircularLayout: React.FC<DesktopLayoutProps> = ({
  features,
  t,
  reducedEffects = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const constellationRef = useRef<HTMLDivElement | null>(null);
  const isConstellationInView = useInView(constellationRef, { amount: 0.25 });

  return (
    <>
      {/* Background blur mesh */}
      <div className="absolute inset-0 bg-linear-to-b from-secondary to-background overflow-hidden pointer-events-none">
        {/* Top left - Large forest orb */}
        <div
          className={`absolute top-8 -left-24 w-96 h-96 rounded-full ${reducedEffects ? "blur-2xl opacity-60" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 30% 40% / 0.6) 0%, hsl(96 41% 25% / 0.4) 100%)",
          }}
        />

        {/* Top right - Medium linen orb */}
        <div
          className={`absolute top-32 -right-20 w-80 h-80 rounded-full ${reducedEffects ? "blur-2xl opacity-55" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(40 20% 85% / 0.5) 0%, hsl(30 30% 80% / 0.3) 100%)",
          }}
        />

        {/* Center - Large primary orb with subtle pulse */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full ${reducedEffects ? "blur-2xl opacity-45" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 41% 19% / 0.25) 0%, hsl(96 30% 40% / 0.2) 50%, hsl(96 10% 90% / 0.15) 100%)",
          }}
        />

        {/* Bottom left - Small earth accent */}
        <div
          className={`absolute bottom-20 left-1/4 w-64 h-64 rounded-full ${reducedEffects ? "blur-2xl opacity-50" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(25 45% 50% / 0.4) 0%, hsl(96 30% 35% / 0.3) 100%)",
          }}
        />

        {/* Bottom right - Medium forest orb */}
        <div
          className={`absolute -bottom-16 right-1/4 w-72 h-72 rounded-full ${reducedEffects ? "blur-2xl opacity-55" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 40% 30% / 0.45) 0%, hsl(96 30% 40% / 0.35) 100%)",
          }}
        />

        {/* Middle left - Accent orb */}
        <div
          className={`absolute top-1/3 left-0 w-56 h-56 rounded-full ${reducedEffects ? "blur-2xl opacity-45" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 35% 35% / 0.35) 0%, hsl(96 30% 40% / 0.25) 100%)",
          }}
        />

        {/* Middle right - Accent orb */}
        <div
          className={`absolute top-2/3 right-0 w-60 h-60 rounded-full ${reducedEffects ? "blur-2xl opacity-50" : "blur-3xl"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(40 25% 80% / 0.4) 0%, hsl(30 30% 80% / 0.3) 100%)",
          }}
        />

        {/* Subtle ambient particles */}
        <div
          className={`absolute top-1/4 right-1/3 w-40 h-40 rounded-full ${reducedEffects ? "blur-xl opacity-40" : "blur-2xl opacity-40"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(96 25% 50% / 0.3) 0%, hsl(96 30% 40% / 0.2) 100%)",
          }}
        />

        <div
          className={`absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full ${reducedEffects ? "blur-xl opacity-45" : "blur-2xl opacity-45"}`}
          style={{
            background:
              "radial-gradient(circle, hsl(25 40% 60% / 0.35) 0%, hsl(40 25% 85% / 0.25) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div ref={constellationRef} className="container mx-auto px-6">
        {/* Interactive circular constellation */}
        <div className="relative max-w-5xl mx-auto h-225 flex items-center justify-center">
          {/* Circular path SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1000 900"
            aria-hidden="true"
          >
            {/* Main circle */}
            <circle
              cx="500"
              cy="450"
              r="340"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeOpacity="0.3"
              fill="none"
            />
            <circle
              cx="500"
              cy="450"
              r="340"
              stroke="var(--color-primary)"
              strokeWidth="1"
              strokeOpacity="0.14"
              strokeDasharray="10 14"
              fill="none"
            />
          </svg>

          {ORBITING_DOT_ROTATIONS.map((rotation, index) => (
            <motion.div
              key={`orbit-dot-${rotation}`}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 transform-gpu"
              initial={{ rotate: rotation, opacity: 0 }}
              animate={
                isConstellationInView ?
                  { rotate: rotation + 360, opacity: 1 } :
                  { rotate: rotation, opacity: 0.78 }
              }
              transition={
                isConstellationInView ?
                  {
                    rotate: {
                      duration: 18,
                      repeat: Infinity,
                      ease: "linear",
                      delay: index * 0.35,
                    },
                    opacity: {
                      duration: 0.6,
                      delay: 0.5 + index * 0.1,
                      ease: "easeOut",
                    },
                  } :
                  { duration: 0.3, ease: "easeOut" }
              }
            >
              <div
                className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70"
                style={{
                  boxShadow: "0 0 18px hsl(96 41% 19% / 0.22)",
                }}
              />
            </motion.div>
          ))}

          {/* Center content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            className="relative z-10 max-w-2xl text-center px-8"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              {t("badge")}
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
              {t("title")}
            </h2>
            <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
          </motion.div>

          {/* Feature icons positioned around the circle */}
          {features.map((feature, index) => {
            const angle = (index / features.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 340;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={feature.titleKey}
                className="absolute transform-gpu"
                style={{
                  left: `calc(47.5% + ${x}px)`,
                  top: `calc(47% + ${y}px)`,
                  transform: "translate(-50%, -50%)",
                }}
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.6,
                  delay: 0.5 + index * 0.1,
                  ease: "backOut",
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Pulsing glow ring */}
                <motion.div
                  className="absolute inset-0 w-20 h-20 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full opacity-30 blur-xl"
                  style={{ background: feature.glowColor }}
                  animate={{
                    scale: hoveredIndex === index ? [1, 1.35, 1] : 1,
                    opacity: hoveredIndex === index ? [0.28, 0.55, 0.28] : 0.18,
                  }}
                  transition={
                    hoveredIndex === index ?
                      {
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      } :
                      { duration: 0.2, ease: "easeOut" }
                  }
                />

                {/* Icon container */}
                <motion.div
                  className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg cursor-pointer"
                  style={{ background: feature.gradient }}
                  whileHover={{ scale: 1.2, rotate: 8 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{
                    y: hoveredIndex === index ? -6 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {feature.icon}
                </motion.div>

                {/* Hover card - positioned intelligently based on angle */}
                <AnimatePresence>
                  {hoveredIndex === index && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="absolute z-50 w-80"
                      style={{
                        left:
                          Math.cos(angle) > 0 ? "calc(100% + 20px)" : "auto",
                        right:
                          Math.cos(angle) <= 0 ? "calc(100% + 20px)" : "auto",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <motion.div
                        className="relative p-6 rounded-2xl bg-card/95 backdrop-blur-md border border-primary/20 shadow-2xl"
                        whileHover={{ scale: 1.02 }}
                      >
                        {/* Gradient accent bar */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                          style={{ background: feature.gradient }}
                        />

                        <h3 className="text-xl font-bold text-foreground mb-3 mt-2">
                          {t(feature.titleKey)}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t(feature.descKey)}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {/* Decorative floating particles */}
          {DESKTOP_DECORATIVE_PARTICLES.map((particle, i) => (
            <div
              key={`particle-${i}`}
              aria-hidden="true"
              className="absolute rounded-full pointer-events-none"
              style={{
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                background:
                  "radial-gradient(circle, hsl(96 41% 19% / 0.18) 0%, hsl(96 41% 19% / 0) 72%)",
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

// Main Features Component
const Features = () => {
  const t = useTranslations("features");
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [reducedEffects, setReducedEffects] = useState(false);

  useEffect(() => {
    const syncViewportMode = () => {
      const width = window.innerWidth;

      if (width <= 767) {
        setViewportMode("mobile");
        return;
      }

      if (width <= 1023) {
        setViewportMode("tablet");
        return;
      }

      setViewportMode("desktop");
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    window.addEventListener("orientationchange", syncViewportMode);
    return () => {
      window.removeEventListener("resize", syncViewportMode);
      window.removeEventListener("orientationchange", syncViewportMode);
    };
  }, []);

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
    };

    syncReducedEffects();
    window.addEventListener("resize", syncReducedEffects);
    return () => {
      window.removeEventListener("resize", syncReducedEffects);
    };
  }, []);

  const features = [
    {
      icon: <Scale className="w-6 h-6" />,
      titleKey: "carbonProxy.title",
      descKey: "carbonProxy.desc",
      gradient:
        "linear-gradient(315deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(96 41% 19% / 0.3)",
    },
    {
      icon: <Package className="w-6 h-6" />,
      titleKey: "materialDb.title",
      descKey: "materialDb.desc",
      gradient:
        "linear-gradient(135deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(96 35% 25% / 0.3)",
    },
    {
      icon: <Globe className="w-6 h-6" />,
      titleKey: "transportCalc.title",
      descKey: "transportCalc.desc",
      gradient:
        "linear-gradient(180deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(40 20% 70% / 0.3)",
    },
    {
      icon: <Recycle className="w-6 h-6" />,
      titleKey: "circularHub.title",
      descKey: "circularHub.desc",
      gradient:
        "linear-gradient(225deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(96 40% 22% / 0.3)",
    },
    {
      icon: <Users className="w-6 h-6" />,
      titleKey: "ngoPartner.title",
      descKey: "ngoPartner.desc",
      gradient:
        "linear-gradient(270deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(25 45% 50% / 0.3)",
    },
    {
      icon: <Leaf className="w-6 h-6" />,
      titleKey: "carbonCredits.title",
      descKey: "carbonCredits.desc",
      gradient:
        "linear-gradient(315deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(96 30% 35% / 0.3)",
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      titleKey: "exportReady.title",
      descKey: "exportReady.desc",
      gradient:
        "linear-gradient(315deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(40 25% 75% / 0.3)",
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      titleKey: "recommendations.title",
      descKey: "recommendations.desc",
      gradient:
        "linear-gradient(135deg, hsl(96 38% 28%) 0%, hsl(96 32% 38%) 100%)",
      glowColor: "hsl(96 38% 28% / 0.3)",
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      titleKey: "esgReports.title",
      descKey: "esgReports.desc",
      gradient:
        "linear-gradient(360deg, hsl(96 35% 25%) 0%, hsl(96 30% 40%) 100%)",
      glowColor: "hsl(25 40% 55% / 0.3)",
    },
  ];

  return (
    <section
      id="features"
      className="relative z-30 mt-0 overflow-hidden bg-linear-to-b from-secondary via-secondary/95 to-background pt-14 pb-4 sm:mt-0 sm:pt-14 md:mt-0 md:pt-12 md:pb-24"
      style={{ contain: "layout paint" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 md:hidden">
        <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-secondary/0 via-secondary/70 to-secondary" />
        <div className="absolute left-1/2 top-[-0.75rem] h-8 w-[135%] -translate-x-1/2 rounded-full bg-secondary/80 blur-3xl" />
      </div>

      {viewportMode === "mobile" ? (
        <MobileSliderLayout
          features={features}
          t={t}
          reducedEffects={reducedEffects}
        />
      ) : viewportMode === "tablet" ? (
        <MobileGridLayout
          features={features}
          t={t}
          reducedEffects={reducedEffects}
        />
      ) : (
        <DesktopCircularLayout
          features={features}
          t={t}
          reducedEffects={reducedEffects}
        />
      )}
    </section>
  );
};

export default Features;
