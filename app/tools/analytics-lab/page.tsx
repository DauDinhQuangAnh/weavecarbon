import type { Metadata } from "next";
import AnalyticsLabConsole from "@/tools/analytics-lab/AnalyticsLabConsole";

export const metadata: Metadata = {
  title: "Analytics Lab | WeaveCarbon",
  robots: {
    index: false,
    follow: false
  }
};

export default function AnalyticsLabPage() {
  return <AnalyticsLabConsole />;
}
