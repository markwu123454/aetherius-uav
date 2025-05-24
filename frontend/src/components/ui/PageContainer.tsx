import type { ReactNode } from "react";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-full !px-20 !py-6 overflow-y-auto">
      <div className="max-w-screen-2xl mx-auto">{children}</div>
    </div>
  );
}
