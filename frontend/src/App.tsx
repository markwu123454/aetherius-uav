import {Outlet} from "react-router-dom";
import DriverStation from "@/components/DriverStation";
import Sidebar from "@/components/Sidebar";
import TopStrip from "@/components/TopStrip";
import {TelemetryProvider} from "@/lib/TelemetryContext";

export function App() {
  return (
    <TelemetryProvider>
  <div className="relative min-h-screen w-screen flex flex-col bg-zinc-950">

    {/* Top bar */}
    <TopStrip />

    {/* Sidebar (fixed) */}
    <Sidebar />

    {/* Main area */}
    <div className="flex-1 overflow-hidden">
      <main className="overflow-y-auto pt-6 pb-[90px] ml-[80px]">
        <Outlet />
      </main>
    </div>

    {/* Bottom bar */}
    <DriverStation />
  </div>
</TelemetryProvider>

  );
}
