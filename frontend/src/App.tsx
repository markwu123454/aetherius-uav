// App.tsx
import {Routes, Route, Navigate, Outlet, useLocation} from "react-router-dom";
import Menu from "@/components/Menu";
import KPI from "@/components/KPI";
import {RealTimeProvider} from "@/lib/RealTimeContext";
import {ApiProvider} from "@/lib/ApiContext";
import "cesium/Build/Cesium/Widgets/widgets.css";

import {Dashboard} from "@/components/pages/Dashboard";
import Telemetry from "@/components/pages/Telemetry";
import {MissionPlanner as Mission} from "@/components/pages/Mission";
import Manual from "@/components/pages/Manual";
import Logs from "@/components/pages/Logs";
import Settings from "@/components/pages/Settings";
import MissionControl from "@/components/pages/MissionControl";

/* ---------- Layouts ---------- */

function DefaultLayout() {
    return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-zinc-950">
            {/* KPI */}
            <KPI/>

            {/* BODY */}
            <div className="flex flex-1 overflow-hidden">
                <Menu/>

                {/* 🚫 MAIN MUST NOT SCROLL */}
                <main className="flex-1 overflow-hidden">
                    <Outlet/>
                </main>
            </div>
        </div>
    );
}


function MissionControlLayout() {
    return (
        <div className="min-h-screen w-screen bg-black overflow-hidden">
            <Outlet/>
        </div>
    );
}

/* ---------- App ---------- */

export function App() {
    return (
        <ApiProvider>
            <RealTimeProvider>
                <Routes>
                    {/* Default app layout */}
                    <Route element={<DefaultLayout/>}>
                        <Route index element={<Navigate to="/home" replace/>}/>
                        <Route path="/home" element={<Dashboard/>}/>
                        <Route path="/telemetry" element={<Telemetry/>}/>
                        <Route path="/mission" element={<Mission/>}/>
                        <Route path="/manual" element={<Manual/>}/>
                        <Route path="/logs" element={<Logs/>}/>
                        <Route path="/settings" element={<Settings/>}/>
                    </Route>

                    {/* Mission Control (isolated layout) */}
                    <Route element={<MissionControlLayout/>}>
                        <Route path="/mission-control" element={<MissionControl/>}/>
                    </Route>
                </Routes>
            </RealTimeProvider>
        </ApiProvider>
    );
}
