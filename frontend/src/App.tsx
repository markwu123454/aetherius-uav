// App.tsx
import {Outlet, useLocation} from "react-router-dom";
import DriverStation from "@/components/DriverStation";
import Sidebar from "@/components/Sidebar";
import TopStrip from "@/components/TopStrip";
import {RealTimeProvider} from "@/lib/RealTimeContext";
import {ApiProvider} from "@/lib/ApiContext";
import "cesium/Build/Cesium/Widgets/widgets.css";

export function App() {
    const location = useLocation();

    const isMissionControl = location.pathname === "/mission-control";

    return (
        <ApiProvider>
            <RealTimeProvider>
                <div className="relative min-h-screen w-screen flex flex-col bg-zinc-950 z-10">
                    {isMissionControl ? (
                            <Outlet/> // simple content only
                    ) : (
                        <>
                            <TopStrip/>
                            <Sidebar/>
                            <div className="flex-1 overflow-hidden">
                                <main className="overflow-y-auto pt-6 pb-[90px] ml-[80px]">
                                    <Outlet/>
                                </main>
                            </div>
                            <DriverStation/>
                        </>
                    )}
                </div>
            </RealTimeProvider>
        </ApiProvider>
    );
}
