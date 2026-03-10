import React from "react";
import TrackShipmentClient from "@/components/dashboard/track-shipment/TrackShipmentClient";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import { DASHBOARD_TRACK_SHIPMENT_NAMESPACES } from "@/lib/i18n/namespaces";

export default function TrackShipmentPage() {
  return (
    <ScopedIntlProvider namespaces={DASHBOARD_TRACK_SHIPMENT_NAMESPACES}>
      <TrackShipmentClient />
    </ScopedIntlProvider>);
}
