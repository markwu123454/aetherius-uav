import React, {useEffect, useRef, useState} from "react";
import {useRealTime} from "@/lib/RealTimeContext";
import {formatLogEntry, logEntryClasses, getError} from "@/lib/LogUtils";

export function BottomBar() {
    const {state} = useRealTime();

    /* ---------- scroll handling ---------- */
    const logContainerRef = useRef<HTMLDivElement | null>(null);
    const alertContainerRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(true);
    const SCROLL_THRESHOLD = 50;

    const isAtBottom = (): boolean => {
        const el = logContainerRef.current;
        if (!el) return false;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    };

    useEffect(() => {
        const el = logContainerRef.current;
        if (el && isSticky) el.scrollTop = el.scrollHeight;
    }, [state.allLogs, isSticky]);

    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;
        const onScroll = () => setIsSticky(isAtBottom());
        el.addEventListener("scroll", onScroll);
        return () => el.removeEventListener("scroll", onScroll);
    }, [isSticky]);

    /* ---------- system time ---------- */
    const [timeStr, setTimeStr] = useState(
        new Date().toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit", second: "2-digit"})
    );

    useEffect(() => {
        const id = setInterval(() => {
            setTimeStr(
                new Date().toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                })
            );
        }, 1000);
        return () => clearInterval(id);
    }, []);

    /* ---------- logs ---------- */
    const displayed = state.allLogs.slice(-500).map((entry, idx) => {
        const text = formatLogEntry(entry) || "";
        return (
            <p key={idx} className={logEntryClasses(entry.log_id)}>
                {text}
            </p>
        );
    });

    /* ---------- alerts ---------- */
    const [alerts, setAlerts] = useState<string[]>([
        "Low battery detected",
        "GPS fix lost",
        "Sensor calibration failed"
    ]);

    return (
        <div className="row-start-3 border-t border-blue-800 bg-zinc-900 p-2 overflow-hidden flex flex-col">
            <div className="pb-2 font-bold tracking-wide text-blue-300 shrink-0">LIVE LOGS & ALERTS</div>

            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Logs (Left) */}
                <div
                    ref={logContainerRef}
                    className="overflow-y-auto scrollbar-dark text-sm font-mono text-zinc-300 flex flex-col space-y-1"
                >
                    {displayed.length ? displayed : (
                        <p className="italic text-zinc-500">No logs match filters</p>
                    )}
                </div>

                {/* Alerts (Right) */}
                <div className="relative flex flex-col flex-1 min-h-0">
                    <div
                        ref={alertContainerRef}
                        className="flex-1 overflow-y-auto scrollbar-dark text-sm font-mono text-red-400 flex flex-col space-y-1 pr-2"
                    >
                        {alerts.length ? alerts.map((alert, idx) => (
                            <p key={idx} className="font-semibold">{alert}</p>
                        )) : (
                            <p className="italic text-zinc-500">No alerts</p>
                        )}
                    </div>
                    <span className="absolute bottom-0 right-0 text-xs text-zinc-400 font-mono p-1">
                        {timeStr}
                    </span>
                </div>
            </div>
        </div>
    );
}
