import type { Metadata } from "next";
import React from "react";
import { notFound } from "next/navigation";
import AIConfigConsole from "@/components/ai-config/AIConfigConsole";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Config | WeaveCarbon",
  robots: {
    index: false,
    follow: false
  }
};

const AIConfigPage: React.FC = () => {
  if (process.env.AI_CONFIG_CONSOLE_ENABLED !== "1") {
    notFound();
  }

  return <AIConfigConsole />;
};

export default AIConfigPage;
