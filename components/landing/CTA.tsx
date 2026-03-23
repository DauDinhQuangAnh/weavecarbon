"use client";

import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/apiClient";
import { motion } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

const CTA = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("cta");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error(t("invalidEmail"));
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post("/contact/lead", {
        email: normalizedEmail
      });
      toast.success(t("success"));
      setEmail("");
    } catch (error) {
      if (isApiError(error) && error.code === "VALIDATION_ERROR") {
        toast.error(t("invalidEmail"));
      } else {
        toast.error(t("error"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative -mt-6 bg-primary-foreground pt-12 pb-12 sm:-mt-8 sm:pt-16 sm:pb-16 md:mt-0 md:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-10 md:hidden">
        <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-primary-foreground/0 via-primary-foreground/85 to-primary-foreground" />
        <div className="absolute left-1/2 top-[-0.75rem] h-8 w-[138%] -translate-x-1/2 rounded-full bg-primary-foreground/95 blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-8 md:p-12 lg:p-16"
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
                      disabled={isSubmitting}
                      className="w-full h-14 pl-12 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="hero"
                    size="xl"
                    className="shrink-0"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("submitting") : t("button")}
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
