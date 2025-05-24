import {Button} from "@/components/ui/button";
import {useEffect, useState} from "react";
import {useTelemetry} from "@/lib/TelemetryContext";

export default function DriverStation() {
  const {
    connected,
    uavConnected,
    armed,
    mode,
    rssi,
    ping,
    videoLatency,
    recording,
    sendCommand, // ✅ include this!
  } = useTelemetry();


  const [time, setTime] = useState(new Date().toLocaleTimeString());

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
    <div
      className="fixed bottom-0 left-0 w-full h-[90px] bg-zinc-800 border-t border-zinc-800 z-50 shadow-xl text-sm font-mono">
      <div className="h-full w-full flex items-center justify-between text-zinc-400 px-8">

        {/* === Status === */}
        <div className="flex items-center gap-6 !px-8">
          {/* Backend + Aircraft stacked vertically */}
          <div className="flex flex-col text-white leading-tight">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}/>
              Backend: {connected ? "Connected" : "Disconnected"}
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${uavConnected ? "bg-green-500" : "bg-yellow-400"}`}/>
              Aircraft: {uavConnected ? "Connected" : "No Heartbeat"}
            </div>
          </div>

          {/* Rest stay horizontal */}
          <div>Status: <span className={armed ? "text-green-400" : "text-red-400"}>{armed ? "Armed" : "Disarmed"}</span>
          </div>
          <div>Mode: <span className="text-blue-400">{mode}</span></div>
        </div>


        <div className="border-l border-zinc-700 h-6 mx-4"/>

        {/* === Controls === */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={sendArm}>ARM</Button>
          <Button variant="outline" onClick={sendDisarm}>DISARM</Button>
          <Button variant="outline" onClick={sendHold}>HOLD ALT</Button>
          <Button variant="outline" onClick={sendRTL}>RTL</Button>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4"/>

        {/* === Link Info === */}
        <div className="flex items-center gap-6">
          <div>RSSI: <span className="text-white">{rssi}</span></div>
          <div>Ping: <span className="text-white">{ping}</span></div>
          <div>Video: <span className="text-white">{videoLatency}</span></div>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4"/>

        {/* === Time + Record === */}
        <div className="flex items-center gap-4 text-white">
          <div>Time: {time}</div>
          <div className={recording ? "text-red-500 font-bold" : "text-zinc-400"}>
            {recording ? "● REC" : "—"}
          </div>
        </div>

        <div className="border-l border-zinc-700 h-6 mx-4"/>

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
