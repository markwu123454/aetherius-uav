import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function DriverStation() {
  // === Placeholder state ===
  const connected = true;
  const armed = false;
  const mode = "Stabilize";
  const rssi = "92%";
  const ping = "38ms";
  const videoLatency = "180ms";
  const recording = true;
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // === Placeholder handlers ===
  const sendArm = () => { /* TODO: send ARM command via REST */ };
  const sendDisarm = () => { /* TODO: send DISARM command */ };
  const sendHold = () => { /* TODO: set ALT_HOLD mode */ };
  const sendRTL = () => { /* TODO: return to launch */ };
  const sendAbort = () => { /* TODO: emergency abort */ };

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-900 border-t border-zinc-800 z-50 shadow-xl text-sm font-mono">
      <div className="h-full w-full flex items-center justify-between text-zinc-400" style={{ paddingLeft: "2rem", paddingRight: "2rem" }}>

        {/* === Status === */}
        <div className="flex items-center gap-6">
          <div className="text-white">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${connected ? "bg-green-500" : "bg-red-500"}`} />
            {connected ? "Connected" : "Disconnected"}
          </div>
          <div>Status: <span className={armed ? "text-green-400" : "text-red-400"}>{armed ? "Armed" : "Disarmed"}</span></div>
          <div>Mode: <span className="text-blue-400">{mode}</span></div>
        </div>

        {/* Divider */}
        <div className="border-l border-zinc-700 h-6 mx-4"></div>

        {/* === Controls === */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={sendArm}>ARM</Button>
          <Button variant="outline" onClick={sendDisarm}>DISARM</Button>
          <Button variant="outline" onClick={sendHold}>HOLD ALT</Button>
          <Button variant="outline" onClick={sendRTL}>RTL</Button>
        </div>

        {/* Divider */}
        <div className="border-l border-zinc-700 h-6 mx-4"></div>

        {/* === Link Info === */}
        <div className="flex items-center gap-6">
          <div>RSSI: <span className="text-white">{rssi}</span></div>
          <div>Ping: <span className="text-white">{ping}</span></div>
          <div>Video: <span className="text-white">{videoLatency}</span></div>
        </div>

        {/* Divider */}
        <div className="border-l border-zinc-700 h-6 mx-4"></div>

        {/* === Time + Record === */}
        <div className="flex items-center gap-4 text-white">
          <div>time: {time}</div>
          <div className={recording ? "text-red-500 font-bold" : "text-zinc-400"}>{recording ? "● REC" : "—"}</div>
        </div>

        {/* Divider */}
        <div className="border-l border-zinc-700 h-6 mx-4"></div>

        {/* === Emergency Abort === */}
        <div>
          <Button
            variant="destructive"
            onClick={sendAbort}
            className="text-white font-bold px-6 py-2 shadow-lg"
          >
            ABORT
          </Button>
        </div>
      </div>
    </div>
  );
}
