import type { ReactNode } from "react";

export default function HomeClient({
  children
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      {children}
    </div>
  );
}
