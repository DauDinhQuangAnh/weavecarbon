"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { fetchB2CDonationImageObjectUrl } from "@/lib/b2cApi";

interface B2CDonationImageProps {
  donationId: string;
  alt: string;
  className?: string;
}

const B2CDonationImage: React.FC<B2CDonationImageProps> = ({
  donationId,
  alt,
  className
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentObjectUrl: string | null = null;

    const loadImage = async () => {
      try {
        const nextObjectUrl = await fetchB2CDonationImageObjectUrl(donationId);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }
        currentObjectUrl = nextObjectUrl;
        setImageUrl(nextObjectUrl);
      } catch {
        setImageUrl(null);
      }
    };

    void loadImage();

    return () => {
      cancelled = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [donationId]);

  if (!imageUrl) {
    return null;
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={720}
      height={720}
      unoptimized
      className={className}
    />
  );
};

export default B2CDonationImage;
