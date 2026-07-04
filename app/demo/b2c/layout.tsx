import React from "react";
import ScopedIntlProvider from "@/components/i18n/ScopedIntlProvider";
import DemoB2CProvider from "@/components/demo/DemoB2CProvider";
import { B2C_NAMESPACES } from "@/lib/i18n/namespaces";

const DemoB2CLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ScopedIntlProvider namespaces={B2C_NAMESPACES}>
      <DemoB2CProvider>{children}</DemoB2CProvider>
    </ScopedIntlProvider>
  );
};

export default DemoB2CLayout;
