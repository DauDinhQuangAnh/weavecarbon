"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { isDemoPath } from "@/lib/demo/routes";
import DemoExportConfigurationPortalV2 from "./DemoExportConfigurationPortalV2";
import ShipmentExportPortal from "./ShipmentExportPortal";
import type { MarketCode } from "./types";

export interface ExportConfigurationPortalV2Props {
  documentManagerSlot?: React.ReactNode;
  onOpenMarketDetail?: (market: MarketCode) => void;
}

const ExportConfigurationPortalV2: React.FC<ExportConfigurationPortalV2Props> = ({
  documentManagerSlot,
  onOpenMarketDetail
}) => {
  const pathname = usePathname();
  if (isDemoPath(pathname)) {
    return (
      <DemoExportConfigurationPortalV2
        documentManagerSlot={documentManagerSlot}
        onOpenMarketDetail={onOpenMarketDetail}
      />
    );
  }
  return (
    <div className="space-y-6">
      <ShipmentExportPortal documentManagerSlot={documentManagerSlot} />
    </div>
  );
};

export default ExportConfigurationPortalV2;
