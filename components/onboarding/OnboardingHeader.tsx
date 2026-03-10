import React from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";

const OnboardingHeader = () => {
  return (
    <div className="text-center mb-8">
      <Link href="/" className="inline-flex items-center gap-2">
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