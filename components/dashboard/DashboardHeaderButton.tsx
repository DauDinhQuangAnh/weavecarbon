"use client";

import React from "react";
import { Menu } from "lucide-react";

export default function DashboardHeaderButton() {
  const handleToggleSidebar = () => {
    const event = new CustomEvent("toggleSidebar");
    window.dispatchEvent(event);
  };

  return (
    <button
      onClick={handleToggleSidebar}
      className="rounded-lg p-2.5 transition-colors hover:bg-muted lg:hidden"
      title="Toggle sidebar">
      
      <Menu className="w-5 h-5" />
    </button>);

}
