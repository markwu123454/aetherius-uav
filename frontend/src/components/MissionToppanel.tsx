// src/components/ui/TopBar.tsx
import React from "react";
import {useRealTime} from "@/lib/RealTimeContext";
import type {
    SYS_STATUS, HEARTBEAT, GLOBAL_POSITION_INT,
    VFR_HUD, ATTITUDE, GPS_RAW_INT
} from "@/types";

export function TopBar() {
    const {state} = useRealTime();

    const get = <K extends keyof typeof state.telemetry>(k: K) =>
        (state.telemetry[k] as typeof state.telemetry[K] | undefined) ??
        new Proxy({}, {
            get: (_, p) => (typeof p === "string" && p.endsWith("s") ? [] : null)
        }) as typeof state.telemetry[K];

    const gps = get("GLOBAL_POSITION_INT");
    const att = get("ATTITUDE");
    const heartbeat = get("HEARTBEAT");
    const vfr = get("VFR_HUD");
    const gpsRaw = get("GPS_RAW_INT");
    const sys = get("SYS_STATUS");

    return (
        <div
            className="row-start-1 flex flex-row items-center border-b border-blue-800 bg-zinc-900 p-2 text-sm font-bold tracking-wide gap-2 text-blue-300 font-mono overflow-x-auto scrollbar-dark whitespace-nowrap">

            {/* ARM + MODE */}
            <span className="inline-block w-[7ch] truncate">
                {heartbeat.base_mode == null ? "DISCON" : (heartbeat.base_mode & 0b100 ? "RMD" : "DISRMD")}
            </span>

            <span className="inline-block w-[8ch] truncate">
                {heartbeat?.custom_mode ?? "NONE"}
            </span>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* GPS */}
            <span>GPS:</span>
            <span className="inline-block w-[5ch] truncate">
                {gpsRaw.fix_type == null ? "--" :
                    gpsRaw.fix_type >= 3 ? "3D" :
                        gpsRaw.fix_type === 2 ? "2D" :
                            gpsRaw.fix_type === 1 ? "NFX" : "--"}
            </span>

            <span>SATS:</span>
            <span className="inline-block w-[3ch] truncate">
                {gpsRaw.satellites_visible != null ? gpsRaw.satellites_visible : "--"}
            </span>

            <span>LAT:</span>
            <span className="inline-block w-[13ch] truncate">
                {gps.lat != null ? (gps.lat / 1e7).toFixed(6) : "--"}
            </span>

            <span>LON:</span>
            <span className="inline-block w-[13ch] truncate">
                {gps.lon != null ? (gps.lon / 1e7).toFixed(6) : "--"}
            </span>

            <span>ALT:</span>
            <span className="inline-block w-[7ch] truncate">
                {gps.relative_alt != null ? (gps.relative_alt / 1000).toFixed(1) + "m" : "--m"}
            </span>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* ATTITUDE */}
            <span>PITCH:</span>
            <span className="inline-block w-[8ch] truncate">
                {att.pitch != null ? (att.pitch * 57.3).toFixed(1) + "°" : "--°"}
            </span>

            <span>ROLL:</span>
            <span className="inline-block w-[8ch] truncate">
                {att.roll != null ? (att.roll * 57.3).toFixed(1) + "°" : "--°"}
            </span>

            <span>YAW:</span>
            <span className="inline-block w-[8ch] truncate">
                {att.yaw != null ? (att.yaw * 57.3).toFixed(1) + "°" : "--°"}
            </span>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* VFR */}
            <span>SPD:</span>
            <span className="inline-block w-[9ch] truncate">
                {vfr.groundspeed != null ? vfr.groundspeed.toFixed(1) + "m/s" : "--m/s"}
            </span>

            <span>CLB:</span>
            <span className="inline-block w-[10ch] truncate">
                {vfr.climb != null ? vfr.climb.toFixed(1) + "m/s" : "--m/s"}
            </span>

            <span>HDG:</span>
            <span className="inline-block w-[5ch] truncate">
                {vfr.heading != null ? vfr.heading.toFixed(0) + "°" : "--°"}
            </span>

            <div className="border-l border-blue-800 h-6 my-auto"/>

            {/* BATTERY */}
            <span>BAT:</span>
            <span className="inline-block w-[6ch] truncate">
                {sys.voltage_battery != null ? (sys.voltage_battery / 1000).toFixed(1) + "V" : "--V"}
            </span>

            <span>CURR:</span>
            <span className="inline-block w-[9ch] truncate">
                {sys.current_battery != null ? (sys.current_battery / 100).toFixed(1) + "A" : "--A"}
            </span>
        </div>


    );
}
