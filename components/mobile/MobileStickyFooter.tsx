'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileStickyFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Mobile sticky footer with safe-area support for iPhone notch.
 * Use pb-safe class for bottom padding that respects safe area.
 */
const MobileStickyFooter: React.FC<MobileStickyFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 bg-background border-t md:relative md:border-t-0',
        'pb-safe px-4 pt-3',
        className
      )}
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 12px), 12px)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {children}
      </div>
    </div>
  );
};

export default MobileStickyFooter;
