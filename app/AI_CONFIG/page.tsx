import type { Metadata } from "next";
import React from "react";
import AIConfigConsole from "@/components/ai-config/AIConfigConsole";

export const metadata: Metadata = {
  title: "AI Config | WeaveCarbon",
  robots: {
    index: false,
    follow: false
  }
};

const AIConfigPage: React.FC = () => {
  return <AIConfigConsole />;
};

export default AIConfigPage;
