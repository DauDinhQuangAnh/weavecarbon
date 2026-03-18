"use client";

import { motion } from "motion/react";
import { Leaf, Linkedin, Mail, Phone, Twitter } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const CONTACT_EMAIL = "mytrinhh.bb@gmail.com";
const CONTACT_PHONE = "0828 413 747";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const t = useTranslations("footer");

  return (
    <footer
      id="contact"
      className="relative -mt-4 bg-foreground pb-5 pt-6 text-primary-foreground md:mt-0 md:pb-6 md:pt-6"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 md:hidden">
        <div className="absolute inset-x-0 top-0 h-5 bg-linear-to-b from-foreground/0 via-foreground/80 to-foreground" />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Link href="/" className="flex items-center gap-2 md:mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-semibold">
                WeaveCarbon
              </span>
            </Link>
            <p className="hidden max-w-sm text-sm leading-7 text-primary-foreground/72 md:block">
              {t("desc")}
            </p>
            <div className="mt-6 hidden items-center gap-3 md:flex">
              <a
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/18"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/18"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/18"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="rounded-3xl border border-primary-foreground/8 bg-primary-foreground/[0.03] p-5 md:border-0 md:bg-transparent md:p-0"
          >
            <p className="mb-1 text-xs uppercase tracking-[0.18em] text-primary-foreground/45">
              {t("representative")}
            </p>
            <p className="text-lg font-semibold text-primary-foreground">
              Doan Thi My Trinh
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-start gap-3 text-sm text-primary-foreground/72">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" />
                <a
                  href="tel:0828413747"
                  className="transition-colors hover:text-primary-foreground"
                >
                  {CONTACT_PHONE}
                </a>
              </div>

              <div className="flex items-start gap-3 text-sm text-primary-foreground/72">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="break-all transition-colors hover:text-primary-foreground sm:break-normal"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="mt-5 flex flex-col items-center justify-between gap-3 pt-2 text-center md:mt-6 md:flex-row md:gap-4 md:pt-5 md:text-left"
        >
          <p className="text-sm text-primary-foreground/60">
            &copy; {currentYear} WeaveCarbon. {t("rights")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:justify-end">
            <a
              href="#"
              className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              Cookies
            </a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
