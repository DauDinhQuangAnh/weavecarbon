import React from "react";
import TransportClient from "@/components/dashboard/transport/TransportClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_TRANSPORT_NAMESPACES } from "@/lib/i18n/namespaces";

interface TransportPageProps {
  searchParams: Promise<{
    shipmentId?: string;
    productId?: string;
    productName?: string;
    productCode?: string;
  }>;
}

const TransportLogistics = async ({ searchParams }: TransportPageProps) => {
  const params = await searchParams;
  const shipmentId = params?.shipmentId?.trim() || undefined;
  const productId = params?.productId?.trim() || undefined;
  const productName = params?.productName?.trim() || undefined;
  const productCode = params?.productCode?.trim() || undefined;

  return (
    <ScopedIntlProvider namespaces={DASHBOARD_TRANSPORT_NAMESPACES}>
      <TransportClient
        shipmentId={shipmentId}
        productId={productId}
        productName={productName}
        productCode={productCode} />
    </ScopedIntlProvider>);


};

export default TransportLogistics;
