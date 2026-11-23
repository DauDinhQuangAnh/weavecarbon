import type { ReactNode } from "react";
import B2CDemoRuntime from "@/components/demo/B2CDemoRuntime";

// The landing "Demo B2C" button starts an offline B2C demo session that lives on /b2c.
// B2CDemoRuntime serves that session from the local demo dataset instead of the real API.
export default function B2CLayout({ children }: { children: ReactNode }) {
  return <B2CDemoRuntime>{children}</B2CDemoRuntime>;
}
