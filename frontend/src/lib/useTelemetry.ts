import { useEffect, useState } from "react";

type TelemetryData = {
  gps: { lat: number; lon: number };
  battery: string;
};

export function useTelemetry() {
  const [data, setData] = useState<TelemetryData | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws/telemetry");

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setData(msg);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => socket.close();
  }, []);

  return data;
}
