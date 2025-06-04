// App.tsx
import {Outlet} from "react-router-dom";
import DriverStation from "@/components/DriverStation";
import Sidebar from "@/components/Sidebar";
import TopStrip from "@/components/TopStrip";
import {TelemetryProvider} from "@/lib/TelemetryContext";
import {CesiumMapProvider} from "@/lib/CesiumMapProvider";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useLocation } from "react-router-dom";

export function App() {
    const location = useLocation();
    const showMap = ["/manual", "/mission"].includes(location.pathname);
    return (
        <TelemetryProvider>
            <CesiumMapProvider>
                {/* Cesium Viewer Mount Point */}
                <div
                    id="cesium-container"
                    className={`fixed inset-0 z-0 transition-opacity duration-300 ${
                        showMap ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                />

                {/* UI Layout */}
                <div className="relative min-h-screen w-screen flex flex-col bg-zinc-950 z-10">
                    <TopStrip/>
                    <Sidebar/>
                    <div className="flex-1 overflow-hidden">
                        <main className="overflow-y-auto pt-6 pb-[90px] ml-[80px]">
                            <Outlet/>
                        </main>
                    </div>
                    <DriverStation/>
                </div>
            </CesiumMapProvider>
        </TelemetryProvider>
    );
}

