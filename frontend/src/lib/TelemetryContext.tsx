// /src/lib/TelemetryContext.tsx
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type * as Types from "@/types";

// Use this flag to pause/resume incoming telemetry updates
export const pause_ws = {mission: false};

// Module‐level reference for applying telemetry
let setDataRef: React.Dispatch<React.SetStateAction<Types.TelemetryState>> | null = null;

/**
 * Flush any deferred telemetry messages when resuming
 */
export function flushDeferredTelemetry() {
    while (deferredMessagesRef.current.length > 0) {
        const msg = deferredMessagesRef.current.shift();
        applyTelemetry(msg);
    }
}

/**
 * Apply incoming telemetry JSON to context state
 */
function applyTelemetry(json: any) {
    if (!setDataRef) return;

    if (pause_ws.mission) {
        console.log("[ws] Skipped due to pause");
        deferredMessagesRef.current.push(json);
        return;
    }
    console.log("[ws] continue")
    setDataRef(prev => {
        const newLogs = (json.logs || []) as Types.LogEntry[];
        const mergedLogs = [...newLogs, ...prev.logs].slice(0, 1000);
        return {
            ...prev,
            ...json,
            logs: mergedLogs,
            connected: true,
            uavConnected: json.uav_connected ?? false,
        };
    });
}


// A buffer for messages deferred during pause
const deferredMessagesRef = {current: [] as any[]};

// Default telemetry state
const defaultState: Types.TelemetryState = {
    gps: {lat: "—", lon: "—", sats: "—", hdop: "—"},
    battery: {voltage: 0, current: 0, percent: "—"},
    mode: "—",
    armed: false,
    rssi: "--%",
    ping: "--ms",
    videoLatency: "--ms",
    recording: false,
    connected: false,
    uavConnected: false,
    logs: [],
    telemetryBuffer: [],
};

const TelemetryContext = createContext<Types.TelemetryContextType>({
    ...defaultState,
    sendCommand: async () => {
    },
    fetchLatestTelemetry: async () => {
    },
    sendMission: async (mission: Types.Mission) => {
    },
    fetchProcessedMission: async () => null,
    fetchAutosaveMission: async () => null,
});


export const useTelemetry = () => useContext(TelemetryContext);

export function TelemetryProvider({children}: { children: ReactNode }) {
    const [data, setData] = useState<Types.TelemetryState>(defaultState);
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<number | null>(null);
    const lastTelemetryTimestampRef = useRef<string | null>(null);

    // Keep module ref in sync with latest setter
    useEffect(() => {
        setDataRef = setData;
        return () => {
            setDataRef = null;
        };
    }, [setData]);

    const connectWebSocket = () => {
        const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/telemetry`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("[Telemetry] WebSocket connected");
            setData(prev => ({...prev, connected: true}));
        };

        ws.onmessage = event => {
            try {
                const json = JSON.parse(event.data);
                applyTelemetry(json);
            } catch (err) {
                console.error("[Telemetry] Failed to parse:", err);
            }
        };

        ws.onclose = () => {
            console.warn("[Telemetry] WebSocket closed. Reconnecting in 2s...");
            setData(prev => ({...prev, connected: false}));
            retryRef.current = window.setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = err => {
            console.error("[Telemetry] WebSocket error:", err);
            if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
        };
    };

    useEffect(() => {
        const delay = window.setTimeout(connectWebSocket, 100);
        return () => {
            clearTimeout(delay);
            wsRef.current?.close();
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const fetchLatestTelemetry = async () => {
        try {
            const since = lastTelemetryTimestampRef.current;
            const url = `http://${window.location.hostname}:8000/api/telemetry/log${
                since ? `?since=${since}` : ""
            }`;
            const res = await fetch(url);
            const json = await res.json();
            const newPoints = json.telemetry || [];

            if (newPoints.length > 0) {
                lastTelemetryTimestampRef.current = newPoints[0].timestamp;
                setData(prev => ({
                    ...prev,
                    telemetryBuffer: [...prev.telemetryBuffer, ...newPoints].slice(-1000),
                }));
            }
        } catch (err) {
            console.error("[Telemetry] Failed to fetch telemetry:", err);
        }
    };

    const sendCommand = async (action: string) => {
        try {
            const url = `http://${window.location.hostname}:8000/api/command/${action}`;
            const res = await fetch(url, {method: "POST"});
            const data = await res.json();
            console.log(`[Command] ${action} ->`, data);
        } catch (err) {
            console.error(`[Command] ${action} failed`, err);
        }
    };

    const sendMission = async (mission: object) => {
        try {
            const url = `http://${window.location.hostname}:8000/api/mission/process`;
            const res = await fetch(url, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(mission),
            });
            const data = await res.json();
            console.log("[Mission] Sent and autosaved mission");
        } catch (err) {
            console.error("[Mission] Failed to send mission:", err);
        }
    };

    const fetchProcessedMission = async (): Promise<Types.ProcessedMission | null> => {
        try {
            const url = `http://${window.location.hostname}:8000/api/mission/process`;
            const res = await fetch(url);
            const data = await res.json();
            console.log("[Mission] Fetched processed mission");

            if (data.available_logic && Array.isArray(data.available_logic)) {
                const functionsList = data.available_logic.map(
                    (entry: any) =>
                        `${entry.class}.${entry.method}(${entry.parameters.join(", ")}) from ${entry.file}`
                );
            }

            return data as Types.ProcessedMission;
        } catch (err) {
            console.error("[Mission] Failed to fetch processed mission:", err);
            return null;
        }
    };

    const fetchAutosaveMission = async (): Promise<Types.Mission | null> => {
        try {
            const url = `http://${window.location.hostname}:8000/api/mission/autosave`;
            const res = await fetch(url);
            if (res.status === 404) {
                console.log("[Autosave] No autosave found");
                return null;
            }
            const data = await res.json();
            console.log("[Autosave] Loaded autosaved mission");
            return data as Types.Mission;
        } catch (err) {
            console.error("[Autosave] Failed to fetch autosave:", err);
            return null;
        }
    };

    return (
        <TelemetryContext.Provider
            value={{
                ...data,
                sendCommand,
                fetchLatestTelemetry,
                sendMission,
                fetchProcessedMission,
                fetchAutosaveMission,
            }}
        >

            {children}
        </TelemetryContext.Provider>
    );
}
