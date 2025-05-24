// src/lib/useTelemetry.ts
import { useEffect, useRef, useState } from "react";

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({
    armed: false,
    mode: "—",
    gps: { lat: "—", lon: "—", sats: "—", hdop: "—" },
    battery: { voltage: 0, current: 0, percent: "—" },
    rssi: "--%",
    ping: "--ms",
    videoLatency: "--ms",
    recording: false,
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/telemetry");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTelemetry((prev) => ({ ...prev, ...data }));
      } catch (err) {
        console.error("[WebSocket] Failed to parse:", err);
      }
    };

    ws.onopen = () => console.log("[WebSocket] Connected");
    ws.onerror = () => console.error("[WebSocket] Error");
    ws.onclose = () => console.warn("[WebSocket] Closed");

    return () => ws.close();
  }, []);

  const sendCommand = async (action: string) => {
    try {
      const res = await fetch(`/api/command/${action}`, { method: "POST" });
      const data = await res.json();
      console.log(`[Command] ${action} ->`, data);
    } catch (err) {
      console.error(`[Command] ${action} failed`, err);
    }
  };

  return { telemetry, sendCommand };
}
