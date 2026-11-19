"use client";

import React from "react";
import DemoExportConfigurationPortalV2 from "./DemoExportConfigurationPortalV2";
import type { MarketCode } from "./types";

export interface ExportConfigurationPortalV2Props {
  documentManagerSlot?: React.ReactNode;
  onOpenMarketDetail?: (market: MarketCode) => void;
}

/**
 * Demo và tài khoản thật dùng cùng một cổng xuất khẩu đầy đủ.
 * Bên trong cổng tự phân biệt nguồn dữ liệu: demo dùng gói SKU mẫu,
 * tài khoản thật dùng sản phẩm/thị trường/chứng từ thật và có thêm tab hồ sơ lô hàng & hải quan.
 */
const ExportConfigurationPortalV2: React.FC<ExportConfigurationPortalV2Props> = ({
  documentManagerSlot,
  onOpenMarketDetail
}) => (
  <DemoExportConfigurationPortalV2
    documentManagerSlot={documentManagerSlot}
    onOpenMarketDetail={onOpenMarketDetail}
  />
);

export default ExportConfigurationPortalV2;
