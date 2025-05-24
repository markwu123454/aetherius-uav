import { Outlet } from "react-router-dom";
import DriverStation from "@/components/DriverStation";
import Sidebar from "@/components/Sidebar";
import TopStrip from "@/components/TopStrip";
import { TelemetryProvider } from "@/lib/TelemetryContext";

export function App() {
  return (
    <TelemetryProvider>
      <div className="min-h-screen w-screen flex flex-col bg-zinc-950 font-mono text-zinc-200">
        {/* Top Strip (full width) */}
        <TopStrip />

        {/* Main content with sidebar + page */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pl-[64px] pt-6 pb-[90px]">
            <Outlet />
          </main>
        </div>

        {/* Fixed bottom bar */}
        <DriverStation />
      </div>
    </TelemetryProvider>
  );
}
