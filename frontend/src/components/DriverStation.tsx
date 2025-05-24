import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTelemetry } from "@/lib/TelemetryContext";

export default function DriverStation() {
  const {
    connected,
    armed,
    mode,
    rssi,
    ping,
    videoLatency,
    recording,
  } = useTelemetry();

  const [time, setTime] = useState(new Date().toLocaleTimeString());

  // === Command Sender ===
  const sendCommand = (action: string) => {
    fetch("http://localhost:8000/api/command/" + action, { method: "POST" })
      .then(res => res.json())
      .then(data => {
        console.log(`[DriverStation] Command '${action}' acknowledged:`, data);
      })
      .catch(err => console.error(`[DriverStation] Command '${action}' failed`, err));
  };

  const sendArm = () => sendCommand("arm");
  const sendDisarm = () => sendCommand("disarm");
  const sendHold = () => sendCommand("hold_alt");
  const sendRTL = () => sendCommand("rtl");
  const sendAbort = () => sendCommand("abort");

  useEffect(() => {
    const clock = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-800 border-t border-zinc-800 z-50 shadow-xl text-sm font-mono">
      <div className="h-full w-full flex items-center justify-between text-zinc-400 px-8">

        {/* === Status === */}
        <div className="flex items-center gap-6 !px-8">
          <div className="text-white">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${connected ? "bg-green-500" : "bg-red-500"}`} />
            {connected ? "Connected" : "Disconnected"}
          </div>
          <div>Status: <span className={armed ? "text-green-400" : "text-red-400"}>{armed ? "Armed" : "Disarmed"}</span></div>
          <div>Mode: <span className="text-blue-400">{mode}</span></div>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4" />

        {/* === Controls === */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={sendArm}>ARM</Button>
          <Button variant="outline" onClick={sendDisarm}>DISARM</Button>
          <Button variant="outline" onClick={sendHold}>HOLD ALT</Button>
          <Button variant="outline" onClick={sendRTL}>RTL</Button>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4" />

        {/* === Link Info === */}
        <div className="flex items-center gap-6">
          <div>RSSI: <span className="text-white">{rssi}</span></div>
          <div>Ping: <span className="text-white">{ping}</span></div>
          <div>Video: <span className="text-white">{videoLatency}</span></div>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4" />

        {/* === Time + Record === */}
        <div className="flex items-center gap-4 text-white">
          <div>Time: {time}</div>
          <div className={recording ? "text-red-500 font-bold" : "text-zinc-400"}>
            {recording ? "● REC" : "—"}
          </div>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4" />

        {/* === Emergency Abort === */}
        <div>
          <Button
            variant="destructive"
            onClick={sendAbort}
            className="text-white font-bold !px-8 py-2 shadow-lg"
          >
            ABORT
          </Button>
        </div>
      </div>
    </div>
  );
}
