"use client";

import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

const CTA = () => {
  const [email, setEmail] = useState("");
  const t = useTranslations("cta");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    setEmail("");
  };

  return (
    <section className="py-24 md:py-32 relative bg-primary-foreground">
      <div className="container relative z-50 mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="bg-card rounded-3xl border border-border p-8 md:p-12 lg:p-16 shadow-lg relative overflow-hidden"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative text-center">
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
                className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              >
                {t("badge")}
              </motion.span>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-6"
              >
                {t("title")}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto"
              >
                {t("subtitle")}
              </motion.p>

              {/* Email form */}
              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                className="max-w-md mx-auto mb-8"
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder={t("email")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-14 pl-12 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    size="xl"
                    className="shrink-0"
                  >
                    {t("button")}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              </motion.form>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
                className="text-sm text-muted-foreground"
              >
                {t("terms")}
              </motion.p>
            </div>
          </motion.div>
        </div>
      </div>
      <div
        className="absolute hidden lg:block top-0 left-0 w-1/3 h-full bg-cover bg-left bg-no-repeat opacity-100 pointer-events-none z-0"
        style={{ backgroundImage: "url('/CTA-BG-left.png')" }}
      />
      <div
        className="absolute hidden lg:block top-0 right-0 w-1/3 h-full bg-cover bg-right bg-no-repeat opacity-100 pointer-events-none z-0"
        style={{ backgroundImage: "url('/CTA-BG-right.png')" }}
      />
    </section>
  );
};

export default CTA;
