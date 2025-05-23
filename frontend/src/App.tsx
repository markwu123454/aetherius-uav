import { Outlet } from "react-router-dom";
import DriverStation from "@/components/DriverStation";
import Sidebar from "@/components/Sidebar";
import TopStrip from "@/components/TopStrip";

export function App() {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <TopStrip />
      <Sidebar />
      <div className="flex-1 pb-[90px] pt-[24px] pl-[64px]">
        <Outlet />
      </div>
      <DriverStation />
    </div>
  );
}
