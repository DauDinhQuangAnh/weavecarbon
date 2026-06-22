'use client';

import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  METHODOLOGY_DISCLAIMER_EN,
  METHODOLOGY_DISCLAIMER_VI,
} from '@/config/penalties';

interface MethodologyBannerProps {
  variant?: 'subtle' | 'prominent';
  className?: string;
}

/**
 * Weave Carbon — "Inherited Credibility" disclaimer.
 * Pin on export, audit, and report surfaces so reviewers
 * immediately see the standards the platform is built on.
 */
const MethodologyBanner = ({ variant = 'subtle', className = '' }: MethodologyBannerProps) => {
  const { locale } = useLanguage();
  const text = locale === 'vi' ? METHODOLOGY_DISCLAIMER_VI : METHODOLOGY_DISCLAIMER_EN;

  if (variant === 'prominent') {
    return (
      <div className={`flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 ${className}`}>
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-primary/70" />
      <span>{text}</span>
    </div>
  );
};

export default MethodologyBanner;
