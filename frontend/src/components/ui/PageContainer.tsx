import type { ReactNode } from "react";

export default function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-hidden">
      <div className="max-w-none !px-20 !py-6 mx-auto w-full">{children}</div>
    </div>
  );
}
