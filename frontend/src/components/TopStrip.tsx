import {useTelemetry} from "@/lib/TelemetryContext";
import {useEffect, useState} from "react";

type Status = {
  label: string;
  level: "info" | "warn" | "error";
};

export default function TopStrip() {
  const {connected, uavConnected} = useTelemetry();
  const [blink, setBlink] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);

  // === Collect messages ===
  const statusMessages: Status[] = [];

  if (!connected) statusMessages.push({label: "Backend disconnected", level: "error"});
  if (!uavConnected) statusMessages.push({label: "UAV link lost", level: "warn"});

  if (statusMessages.length === 0) {
    statusMessages.push({label: "All systems nominal", level: "info"});
  }

  // === Determine if blinking is needed ===
  const hasUnacknowledgedAlert = statusMessages.some(
    (msg) =>
      (msg.level === "warn" || msg.level === "error") &&
      !acknowledged.includes(msg.label)
  );

  // === Blinking effect only if unacknowledged issue ===
  useEffect(() => {
    if (hasUnacknowledgedAlert) {
      const interval = setInterval(() => setBlink((b) => !b), 500);
      return () => clearInterval(interval);
    } else {
      setBlink(false);
    }
  }, [hasUnacknowledgedAlert]);

  // === Strip background (blink or not) ===
  const highestUnackedLevel = statusMessages.reduce<"info" | "warn" | "error">((max, msg) => {
    if (acknowledged.includes(msg.label)) return max;
    if (msg.level === "error") return "error";
    if (msg.level === "warn" && max !== "error") return "warn";
    return max;
  }, "info");

  const bgColor = {
    info: "bg-zinc-800",
    warn: blink ? "bg-yellow-600" : "bg-zinc-800",
    error: blink ? "bg-red-700" : "bg-zinc-800",
  }[highestUnackedLevel];

  // === Click to acknowledge a warning ===
  const acknowledge = (label: string) => {
    setAcknowledged((prev) => [...new Set([...prev, label])]);
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full h-6 ${bgColor} text-zinc-400 text-xs font-mono px-4 flex items-center gap-4 z-50 border-b border-zinc-700 transition-colors`}
    >
      <span className="text-zinc-400">Aetherius GCS · Version 0.1.0</span>
      {statusMessages.map((msg, i) => {
        const isAcknowledged = acknowledged.includes(msg.label);
        const color = {
          info: "!text-green-400",
          warn: "!text-yellow-400",
          error: "!text-red-400",
        }[msg.level];

        return (
          <div key={i} className="flex items-center gap-1">
            <span className={color}>·</span>
            <button
              onClick={() => acknowledge(msg.label)}
              className={`
    ${color}
    ${!isAcknowledged && msg.level !== "info"
                ? "uppercase underline !font-bold tracking-wide text-sm"
                : "font-normal"}
    hover:opacity-80 transition-opacity cursor-pointer
    border-none outline-none bg-transparent
  `}
            >
              {msg.label}
            </button>

          </div>
        );
      })}

    </div>
  );
}
