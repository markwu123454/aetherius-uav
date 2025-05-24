// /src/lib/TelemetryContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// const backend = import.meta.env.VITE_BACKEND_URL;

type LogEntry = {
  timestamp: string;
  message: string;
  importance: "minor" | "major" | "critical";
  severity: "info" | "warning" | "error";
};
type GPSData = { lat: number | string; lon: number | string; sats: number | string; hdop: number | string };
type BatteryData = { voltage: number; current: number; percent: number | string };

type TelemetryState = {
  gps: GPSData;
  battery: BatteryData;
  mode: string;
  armed: boolean;
  rssi: string;
  ping: string;
  videoLatency: string;
  recording: boolean;
  connected: boolean;
  uavConnected: boolean;
  logs: LogEntry[];
};

const defaultState: TelemetryState = {
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
};

type TelemetryContextType = TelemetryState & {
  sendCommand: (action: string) => Promise<void>;
};

const TelemetryContext = createContext<TelemetryContextType>({
  ...defaultState,
  sendCommand: async () => {
  },
});

export const useTelemetry = () => useContext(TelemetryContext);

export function TelemetryProvider({children}: { children: ReactNode }) {
  const [data, setData] = useState<TelemetryState>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  const connectWebSocket = () => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/telemetry`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Telemetry] WebSocket connected");
      setData(prev => ({...prev, connected: true}));
    };

    ws.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);

        setData(prev => {
          const newLogs = (json.logs || []) as LogEntry[];
          const mergedLogs = [...newLogs, ...prev.logs].slice(0, 1000); // keep newest 1000

          return {
            ...prev,
            ...json,
            logs: mergedLogs,
            connected: true,
            uavConnected: json.uav_connected ?? false,
          };
        });
      } catch (err) {
        console.error("[Telemetry] Failed to parse:", err);
      }
    };


    ws.onclose = () => {
      console.warn("[Telemetry] WebSocket closed. Attempting reconnect...");
      setData(prev => ({...prev, connected: false}));
      retryRef.current = window.setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error("[Telemetry] WebSocket error:", err);
      if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  };

  useEffect(() => {
    const delay = setTimeout(connectWebSocket, 100);
    return () => {
      clearTimeout(delay);
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);


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


  return (
    <TelemetryContext.Provider value={{...data, sendCommand}}>
      {children}
    </TelemetryContext.Provider>
  );
}
