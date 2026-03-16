import React from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";

const OnboardingHeader = () => {
  return (
    <div className="mb-8 flex w-full justify-center">
      <Link href="/" className="inline-flex items-center justify-center gap-2 text-center">
        <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
          <Leaf className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-display font-bold text-foreground">
          WEAVE<span className="text-primary">CARBON</span>
        </span>
      </Link>
    </div>);

};

export default OnboardingHeader;
