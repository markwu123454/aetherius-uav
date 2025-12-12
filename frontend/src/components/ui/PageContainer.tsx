import type {ReactNode} from "react";

export default function PageContainer({children}: { children: ReactNode }) {
  return (
    <div
      className="absolute top-[24px] left-[80px] right-0 bottom-[20px] overflow-hidden"
    >
      <div className="w-full h-full overflow-auto bg-zinc-950 text-zinc-200 font-mono">
        {children}
      </div>
    </div>
  );
}

