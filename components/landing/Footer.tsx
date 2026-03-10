"use client";

import { motion } from "motion/react";
import { Leaf, Linkedin, Mail, Twitter, Phone } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const t = useTranslations("footer");

  return (
    <footer
      id="contact"
      className="bg-foreground text-primary-foreground pt-8 pb-8">

      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="">

            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-semibold">
                WeaveCarbon
              </span>
            </Link>
            <p className="text-primary-foreground/70 text-sm mb-6 max-w-xs">
              {t("desc")}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="Twitter">
                
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="LinkedIn">
                
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="mailto:mytrinhh.bb@gmail.com"
                className="w-10 h-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
                aria-label="Email">
                
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-primary-foreground/50 mb-1">
                  {t("representative")}
                </p>
                <p className="text-sm text-primary-foreground/90 font-medium">
                  Doan Thi My Trinh
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Phone className="w-4 h-4" />
                <a
                  href="tel:0828413747"
                  className="hover:text-primary-foreground transition-colors">
                  
                  0828 413 747
                </a>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Mail className="w-4 h-4" />
                <a
                  href="mailto:mytrinhh.bb@gmail.com"
                  className="hover:text-primary-foreground transition-colors">
                  
                  mytrinhh.bb@gmail.com
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
          className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <p className="text-sm text-primary-foreground/60">
            © {currentYear} WeaveCarbon. {t("rights")}
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              
              Cookies
            </a>
          </div>
        </motion.div>
      </div>
    </footer>);

};

export default Footer;
