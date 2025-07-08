// src/components/ui/TopBar.tsx
import React from "react";
import {useRealTime} from "@/lib/RealTimeContext";
import type {
    SYS_STATUS, HEARTBEAT, GLOBAL_POSITION_INT,
    VFR_HUD, ATTITUDE, GPS_RAW_INT
} from "@/types";

function zeroProxy<T>(): T {
    return new Proxy({}, {
        get: (_, p) => {
            if (typeof p === "string" && p.endsWith("s")) return [];
            return 0;
        }
    }) as T;
}

export function TopBar() {
    const {state} = useRealTime();

    const heartbeat = (state.telemetry["HEARTBEAT"] as HEARTBEAT | undefined) ?? zeroProxy<HEARTBEAT>();
    const sys = (state.telemetry["SYS_STATUS"] as SYS_STATUS | undefined) ?? zeroProxy<SYS_STATUS>();
    const gps = (state.telemetry["GLOBAL_POSITION_INT"] as GLOBAL_POSITION_INT | undefined) ?? zeroProxy<GLOBAL_POSITION_INT>();
    const vfr = (state.telemetry["VFR_HUD"] as VFR_HUD | undefined) ?? zeroProxy<VFR_HUD>();
    const att = (state.telemetry["ATTITUDE"] as ATTITUDE | undefined) ?? zeroProxy<ATTITUDE>();
    const gpsRaw = (state.telemetry["GPS_RAW_INT"] as GPS_RAW_INT | undefined) ?? zeroProxy<GPS_RAW_INT>();

    return (
<div className="row-start-1 flex flex-row items-center border-b border-blue-800 bg-zinc-900 p-2 text-sm font-bold tracking-wide gap-4 text-blue-300 font-mono overflow-x-auto scrollbar-dark whitespace-nowrap">

            {/* ARM + MODE */}
            <div className="flex items-center gap-1">
                <span>ARM:</span>
                <span
                    className="inline-block w-[9ch] truncate">{heartbeat.base_mode & 0b100 ? "ARMED" : "DISARMED"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>MODE:</span>
                <span className="inline-block w-[8ch] truncate">{heartbeat.custom_mode ?? "—"}</span>
            </div>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* GPS */}
            <div className="flex items-center gap-1">
                <span>GPS:</span>
                <span
                    className="inline-block w-[4ch] truncate">{gpsRaw.fix_type >= 3 ? "3D FIX" : gpsRaw.fix_type ? "NO FIX" : "—"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>SATS:</span>
                <span className="inline-block w-[3ch] truncate">{gpsRaw.satellites_visible || "—"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>LAT:</span>
                <span className="inline-block w-[7ch] truncate">{gps.lat ? (gps.lat / 1e7).toFixed(6) : "—"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>LON:</span>
                <span className="inline-block w-[7ch] truncate">{gps.lon ? (gps.lon / 1e7).toFixed(6) : "—"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>ALT:</span>
                <span
                    className="inline-block w-[7ch] truncate">{gps.relative_alt ? (gps.relative_alt / 1000).toFixed(1) + " m" : "—"}</span>
            </div>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* ATTITUDE */}
            <div className="flex items-center gap-1">
                <span>PITCH:</span>
                <span className="inline-block w-[8ch] truncate">{(att.pitch * 57.3).toFixed(1)}°</span>
            </div>
            <div className="flex items-center gap-1">
                <span>ROLL:</span>
                <span className="inline-block w-[8ch] truncate">{(att.roll * 57.3).toFixed(1)}°</span>
            </div>
            <div className="flex items-center gap-1">
                <span>YAW:</span>
                <span className="inline-block w-[8ch] truncate">{(att.yaw * 57.3).toFixed(1)}°</span>
            </div>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* VFR */}
            <div className="flex items-center gap-1">
                <span>SPD:</span>
                <span className="inline-block w-[9ch] truncate">{vfr.groundspeed?.toFixed(1) ?? "—"} m/s</span>
            </div>
            <div className="flex items-center gap-1">
                <span>CLIMB:</span>
                <span className="inline-block w-[9ch] truncate">{vfr.climb?.toFixed(1) ?? "—"} m/s</span>
            </div>
            <div className="flex items-center gap-1">
                <span>HDG:</span>
                <span className="inline-block w-[5ch] truncate">{vfr.heading?.toFixed(0) ?? "—"}°</span>
            </div>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* BATTERY */}
            <div className="flex items-center gap-1">
                <span>BAT:</span>
                <span
                    className="inline-block w-[6ch] truncate">{sys.voltage_battery ? (sys.voltage_battery / 1000).toFixed(1) + " V" : "—"}</span>
            </div>
            <div className="flex items-center gap-1">
                <span>CURR:</span>
                <span
                    className="inline-block w-[9ch] truncate">{sys.current_battery ? (sys.current_battery / 100).toFixed(1) + " A" : "—"}</span>
            </div>
        </div>

    );
}
