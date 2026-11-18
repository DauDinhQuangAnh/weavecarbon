"use client";

import { motion } from "motion/react";
import { Leaf, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useLandingT } from "./LandingLanguage";
import { SALES_CONTACT } from "@/lib/pricing/plans";

const CONTACT_EMAIL = SALES_CONTACT.email;
const CONTACT_PHONE = "0828 413 747";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const t = useLandingT("footer");

  const columns = [
    {
      title: t("platform"),
      links: [
        { label: t("links.ingestion"), href: "#solution" },
        { label: t("links.engine"), href: "#solution" },
        { label: t("links.evidence"), href: "#solution" },
        { label: t("links.adapters"), href: "#reports-sample" },
      ],
    },
    {
      title: t("company"),
      links: [
        { label: t("links.problem"), href: "#problem" },
        { label: t("links.solution"), href: "#solution" },
        { label: t("links.why"), href: "#why-weavecarbon" },
        { label: t("links.pricing"), href: "#pricing" },
      ],
    },
    {
      title: t("resources"),
      links: [
        { label: t("links.samples"), href: "#reports-sample" },
        { label: t("links.demo"), href: "/auth" },
        { label: t("links.advisory"), href: `mailto:${CONTACT_EMAIL}` },
      ],
    },
  ];

  return (
    <footer
      id="contact"
      className="relative -mt-4 bg-foreground pb-6 pt-12 text-primary-foreground md:mt-0 md:pt-16"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 md:hidden">
        <div className="absolute inset-x-0 top-0 h-5 bg-linear-to-b from-foreground/0 via-foreground/80 to-foreground" />
      </div>

      <div className="container relative z-10 mx-auto px-6">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="col-span-2"
          >
            <Link href="/" className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-semibold">WeaveCarbon</span>
            </Link>
            <p className="mb-6 max-w-sm text-sm leading-6 text-primary-foreground/70">{t("desc")}</p>
            <div className="flex items-center gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10 transition-colors hover:bg-primary-foreground/20"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </motion.div>

          {columns.map((column, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 * (index + 1) }}
            >
              <h4 className="mb-4 font-semibold">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.32 }}
            className="col-span-2 md:col-span-1"
          >
            <h4 className="mb-4 font-semibold">{t("contact")}</h4>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs text-primary-foreground/50">{t("representative")}</p>
                <p className="text-sm font-medium text-primary-foreground/90">Đoàn Thị Mỹ Trinh</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Phone className="h-4 w-4 shrink-0" />
                <a href="tel:0828413747" className="transition-colors hover:text-primary-foreground">
                  {CONTACT_PHONE}
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${CONTACT_EMAIL}`} className="break-all transition-colors hover:text-primary-foreground">
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
          className="flex flex-col items-center justify-between gap-4 border-t border-primary-foreground/10 pt-6 text-center md:flex-row md:text-left"
        >
          <p className="text-sm text-primary-foreground/60">
            &copy; {currentYear} WeaveCarbon. {t("rights")}{" "}
            <Link href="/terms" className="underline-offset-2 hover:underline">{t("terms")}</Link>
            {" · "}
            <Link href="/privacy" className="underline-offset-2 hover:underline">{t("privacy")}</Link>
          </p>
          <p className="max-w-xl text-xs text-primary-foreground/50 md:text-right">{t("disclaimer")}</p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
