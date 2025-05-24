import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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
};

const defaultState: TelemetryState = {
  gps: { lat: "—", lon: "—", sats: "—", hdop: "—" },
  battery: { voltage: 0, current: 0, percent: "—" },
  mode: "—",
  armed: false,
  rssi: "--%",
  ping: "--ms",
  videoLatency: "--ms",
  recording: false,
  connected: false,
};

const TelemetryContext = createContext<TelemetryState>(defaultState);
export const useTelemetry = () => useContext(TelemetryContext);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TelemetryState>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Telemetry] WebSocket connected");
      setData(prev => ({ ...prev, connected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const json = JSON.parse(event.data);
        setData(prev => ({
          ...prev,
          ...json,
          connected: true,
        }));
      } catch (err) {
        console.error("[Telemetry] Failed to parse:", err);
      }
    };

    ws.onclose = () => {
      console.warn("[Telemetry] WebSocket closed. Attempting reconnect...");
      setData(prev => ({ ...prev, connected: false }));

      // Retry after 2 seconds
      retryRef.current = window.setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error("[Telemetry] WebSocket error:", err);
      ws.close(); // trigger `onclose` to start reconnect loop
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  return (
    <TelemetryContext.Provider value={data}>
      {children}
    </TelemetryContext.Provider>
  );
}
