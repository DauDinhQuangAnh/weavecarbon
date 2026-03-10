"use client";

import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { ArrowRight, Shield } from "lucide-react";
import { useState } from "react";
import UserTypeDialog from "./UserTypeDialog";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Waves from "../icons/Waves";
import LeafHero3D from "./LeafHero3D";

const Hero = () => {
  const [showUserTypeDialog, setShowUserTypeDialog] = useState(false);
  const t = useTranslations("hero");
  // const tFeatures = useTranslations("features");

  return (
    <section className="relative h-screen w-screen flex items-center justify-center lg:pt-40 lg:pb-20 overflow-hidden bg-gradient-hero">
      {/* Background decorations */}

      <div className="absolute inset-0 bg-linear-to-b from-primary-foreground to-secondary overflow-hidden pointer-events-none">
        <LeafHero3D />

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
      </div>

      <div className="container px-6 relative z-10">
        <div className="max-w-4xl p-4 bg-white/50 backdrop-blur-md rounded-lg border-border lg:p-0 lg:bg-transparent lg:backdrop-blur-none lg:rounded-none lg:border-0 overflow-hidden">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8"
          >
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">{t("badge")}</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
            className="text-4xl md:text-5xl lg:text-7xl font-bold text-foreground mb-6"
          >
            {t("title")}{" "}
            <span className="text-gradient-forest">{t("titleHighlight")}</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
          >
            {t("subtitle")}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center  gap-4 mb-16"
          >
            <Button
              variant="hero"
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => setShowUserTypeDialog(true)}
            >
              {t("cta.start")}
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Link href="/calculator" className="w-full">
              <Button
                variant="heroOutline"
                size="xl"
                className="w-full sm:w-auto"
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
            className="mt-12 text-center md:text-left text-sm text-muted-foreground"
          >
            {t("trust")}
          </motion.p>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute top-16 lg:top-0 left-0 right-0">
        <Waves />
      </div>

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
