"use client";
import { motion, AnimatePresence } from "motion/react";
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
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";

// Mobile/Tablet Grid Layout Component
interface MobileLayoutProps {
  features: Array<{
    icon: React.ReactNode;
    titleKey: string;
    descKey: string;
    gradient: string;
    glowColor: string;
  }>;
  t: (key: string) => string;
}

const MobileGridLayout: React.FC<MobileLayoutProps> = ({ features, t }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <>
      {/* Background blur mesh */}
      <div className="absolute inset-0 bg-linear-to-b from-secondary to-background overflow-hidden pointer-events-none">
        {/* Large forest orb */}
        <motion.div
          className="absolute top-12 -left-20 w-64 h-64 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 30% 40% / 0.5) 0%, hsl(96 41% 25% / 0.3) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.6 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.6, 0.5, 0.6],
          }}
        />

        {/* Top right accent */}
        <motion.div
          className="absolute top-32 -right-16 w-56 h-56 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(40 20% 85% / 0.4) 0%, hsl(30 30% 80% / 0.2) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
        />

        {/* Bottom accent */}
        <motion.div
          className="absolute -bottom-20 left-1/3 w-64 h-64 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(25 45% 50% / 0.35) 0%, hsl(96 30% 35% / 0.25) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          animate={{
            x: [0, 15, 0],
            scale: [1, 1.15, 1],
          }}
        />

        {/* Bottom right accent */}
        <motion.div
          className="absolute -bottom-12 -right-20 w-56 h-56 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 40% 30% / 0.4) 0%, hsl(96 30% 40% / 0.3) 100%)",
          }}
          initial={{ scale: 0.7, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.5 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
          animate={{
            x: [0, -20, 0],
            scale: [1, 1.1, 1],
          }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        {/* Section header */}
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

        {/* Grid Layout */}
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
              {/* Feature Card */}
              <motion.div
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="relative p-6 rounded-2xl bg-card/80 backdrop-blur-sm border border-primary/10 cursor-pointer transition-all duration-300 hover:border-primary/30 min-h-fit"
                whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
                style={{
                  borderColor:
                    expandedIndex === index ? feature.glowColor : "inherit",
                }}
              >
                {/* Gradient accent bar */}
                <motion.div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: feature.gradient }}
                />

                {/* Icon and Title */}
                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                    style={{ background: feature.gradient }}
                    whileHover={{ rotate: 8, scale: 1.1 }}
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

                {/* Description preview (always visible on mobile) */}
                <div className="block md:hidden text-xs text-muted-foreground line-clamp-2">
                  {t(feature.descKey)}
                </div>

                {/* Expanded description */}
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

                {/* Always show full description on tablet+ */}
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

// Desktop Circular Constellation Layout
interface DesktopLayoutProps {
  features: Array<{
    icon: React.ReactNode;
    titleKey: string;
    descKey: string;
    gradient: string;
    glowColor: string;
  }>;
  t: (key: string) => string;
}

const DesktopCircularLayout: React.FC<DesktopLayoutProps> = ({
  features,
  t,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <>
      {/* Background blur mesh */}
      <div className="absolute inset-0 bg-linear-to-b from-secondary to-background overflow-hidden pointer-events-none">
        {/* Top left - Large forest orb */}
        <motion.div
          className="absolute top-8 -left-24 w-96 h-96 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 30% 40% / 0.6) 0%, hsl(96 41% 25% / 0.4) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0, x: -100 }}
          whileInView={{ scale: 1, opacity: 0.7, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.7, 0.5, 0.7],
          }}
        />

        {/* Top right - Medium linen orb */}
        <motion.div
          className="absolute top-32 -right-20 w-80 h-80 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(40 20% 85% / 0.5) 0%, hsl(30 30% 80% / 0.3) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0, x: 100 }}
          whileInView={{ scale: 1, opacity: 0.6, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          animate={{
            y: [0, -30, 0],
            scale: [1, 1.15, 1],
          }}
        />

        {/* Center - Large primary orb with subtle pulse */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 41% 19% / 0.25) 0%, hsl(96 30% 40% / 0.2) 50%, hsl(96 10% 90% / 0.15) 100%)",
          }}
          initial={{ scale: 0.7, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.4 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, 0],
          }}
        />

        {/* Bottom left - Small earth accent */}
        <motion.div
          className="absolute bottom-20 left-1/4 w-64 h-64 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(25 45% 50% / 0.4) 0%, hsl(96 30% 35% / 0.3) 100%)",
          }}
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          whileInView={{ scale: 1, opacity: 0.5, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
          animate={{
            x: [0, 20, 0],
            scale: [1, 1.2, 1],
          }}
        />

        {/* Bottom right - Medium forest orb */}
        <motion.div
          className="absolute -bottom-16 right-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 40% 30% / 0.45) 0%, hsl(96 30% 40% / 0.35) 100%)",
          }}
          initial={{ scale: 0.8, opacity: 0, y: 80 }}
          whileInView={{ scale: 1, opacity: 0.6, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
          animate={{
            x: [0, -25, 0],
            y: [0, 15, 0],
          }}
        />

        {/* Middle left - Accent orb */}
        <motion.div
          className="absolute top-1/3 left-0 w-56 h-56 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 35% 35% / 0.35) 0%, hsl(96 30% 40% / 0.25) 100%)",
          }}
          initial={{ scale: 0.6, opacity: 0, x: -50 }}
          whileInView={{ scale: 1, opacity: 0.45, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.45, 0.6, 0.45],
          }}
        />

        {/* Middle right - Accent orb */}
        <motion.div
          className="absolute top-2/3 right-0 w-60 h-60 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, hsl(40 25% 80% / 0.4) 0%, hsl(30 30% 80% / 0.3) 100%)",
          }}
          initial={{ scale: 0.7, opacity: 0, x: 50 }}
          whileInView={{ scale: 1, opacity: 0.5, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.7 }}
          animate={{
            y: [0, 25, 0],
            x: [0, -15, 0],
          }}
        />

        {/* Subtle ambient particles */}
        <motion.div
          className="absolute top-1/4 right-1/3 w-40 h-40 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, hsl(96 25% 50% / 0.3) 0%, hsl(96 30% 40% / 0.2) 100%)",
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.4 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.8 }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
        />

        <motion.div
          className="absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, hsl(25 40% 60% / 0.35) 0%, hsl(40 25% 85% / 0.25) 100%)",
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.45 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.9 }}
          animate={{
            scale: [1, 1.25, 1],
            rotate: [0, 10, 0],
          }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-6">
        {/* Interactive circular constellation */}
        <div className="relative max-w-5xl mx-auto h-225 flex items-center justify-center">
          {/* Circular path SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient
                id="circle-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0.3"
                />
                <stop
                  offset="50%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0.6"
                />
                <stop
                  offset="100%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity="0.3"
                />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Main circle */}
            <motion.circle
              cx="50%"
              cy="50%"
              r="340"
              stroke="url(#circle-gradient)"
              strokeWidth="2"
              fill="none"
              filter="url(#glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 2,
                ease: "easeInOut",
              }}
            />

            {/* Animated dots traveling around the circle */}
            {[0, 0.33, 0.66].map((offset, i) => (
              <motion.circle
                key={`orbit-dot-${i}`}
                r="4"
                fill="hsl(var(--primary))"
                opacity="0.7"
                filter="url(#glow)"
              >
                <animateMotion
                  dur="12s"
                  repeatCount="indefinite"
                  begin={`${offset * 12}s`}
                >
                  <mpath href="#circle-path" />
                </animateMotion>
              </motion.circle>
            ))}

            {/* Hidden path for animation */}
            <path
              id="circle-path"
              d="M 50%,50% m -340,0 a 340,340 0 1,0 680,0 a 340,340 0 1,0 -680,0"
              fill="none"
            />
          </svg>

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
                className="absolute"
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
                    scale: hoveredIndex === index ? [1, 1.5, 1] : 1,
                    opacity: hoveredIndex === index ? [0.3, 0.7, 0.3] : 0.2,
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
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
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-1 h-1 bg-primary/30 rounded-full"
              style={{
                left: `${50 + (Math.random() - 0.5) * 80}%`,
                top: `${50 + (Math.random() - 0.5) * 80}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeInOut",
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
      className="relative z-30 md:py-32 bg-linear-to-b from-secondary to-background overflow-hidden"
    >
      {isMobile ? (
        <MobileGridLayout features={features} t={t} />
      ) : (
        <DesktopCircularLayout features={features} t={t} />
      )}
    </section>
  );
};

export default Features;
