/** * @deprecated * **/

// /src/lib/TelemetryContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Telemetry,
  TelemetryContextType,
  LogEntry,
  Mission,
  ProcessedMission,
} from "@/types";

// Flag to pause/resume incoming telemetry
  export const pause_ws = { mission: false };

// Local state type: real-time telemetry + buffers + logs
type State = Telemetry & {
  telemetryBuffer: any[];
  logs: LogEntry[];
  historicalLogs: LogEntry[];
  activeErrors: Record<string, string>;
};

// Default values for all telemetry fields, buffers, and logs
const defaultState: State = {
  // Telemetry fields (initialize to placeholders)
  HEARTBEAT: undefined,
  AHRS: undefined,
  ATTITUDE: undefined,
  GLOBAL_POSITION_INT: undefined,
  VFR_HUD: undefined,
  SYS_STATUS: undefined,
  POWER_STATUS: undefined,
  MEMINFO: undefined,
  NAV_CONTROLLER_OUTPUT: undefined,
  MISSION_CURRENT: undefined,
  SERVO_OUTPUT_RAW: undefined,
  RC_CHANNELS: undefined,
  RAW_IMU: undefined,
  SCALED_IMU2: undefined,
  SCALED_IMU3: undefined,
  SCALED_PRESSURE: undefined,
  SCALED_PRESSURE2: undefined,
  GPS_RAW_INT: undefined,
  SYSTEM_TIME: undefined,
  WIND: undefined,
  TERRAIN_REPORT: undefined,
  EKF_STATUS_REPORT: undefined,
  VIBRATION: undefined,
  POSITION_TARGET_GLOBAL_INT: undefined,
  BATTERY_STATUS: undefined,
  AOA_SSA: undefined,
  MCU_STATUS: undefined,
  UNKNOWN_295: undefined,

  // Buffers and logs
  telemetryBuffer: [],
  logs: [],
  historicalLogs: [],
  activeErrors: {},
};

// Module setter ref for apply functions
let setDataRef: React.Dispatch<React.SetStateAction<State>> | null = null;
const deferredRef = { current: [] as any[] };

// Create context with type TelemetryContextType
const TelemetryContext = createContext<TelemetryContextType>({
  ...defaultState,
  logs: [],
  historicalLogs: [],
  telemetryBuffer: [],
  activeErrors: {},
  sendCommand: async () => {},
  fetchHistoricalTelemetry: async () => {},
  fetchHistoricalLogs: async () => {},
  addLog: async () => {},
  sendMission: async () => {},
  fetchProcessedMission: async () => null,
  fetchAutosaveMission: async () => null,
});

export const useTelemetry = () => useContext(TelemetryContext);

// Merge telemetry JSON into state
function applyTelemetry(json: Partial<State>) {
  if (!setDataRef) return;
  if (pause_ws.mission) {
    deferredRef.current.push(json);
    return;
  }
  setDataRef(prev => ({ ...prev, ...json }));
}

// Add a live log entry
function applyLog(entry: LogEntry) {
  if (!setDataRef) return;
  setDataRef(prev => ({ logs: [entry, ...prev.logs].slice(0, 1000), ...prev }));
}

// Raise an error into activeErrors
function applyError(error_id: string, message: string) {
  if (!setDataRef) return;
  setDataRef(prev => ({
    ...prev,
    activeErrors: { ...prev.activeErrors, [error_id]: message },
  }));
}

// Clear an existing error
function clearErrorLocal(error_id: string) {
  if (!setDataRef) return;
  setDataRef(prev => {
    const next = { ...prev.activeErrors };
    delete next[error_id];
    return { ...prev, activeErrors: next };
  });
}

// Flush paused telemetry
export function flushDeferredTelemetry() {
  while (deferredRef.current.length) {
    applyTelemetry(deferredRef.current.shift());
  }
}

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<State>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    setDataRef = setData;
    return () => { setDataRef = null; };
  }, [setData]);

  // WebSocket setup
  const connectWS = () => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/telemetry`);
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.error_id && msg.message && msg.type === 'error_raise') {
          applyError(msg.error_id, msg.message);
        } else if (msg.error_id && msg.type === 'error_clear') {
          clearErrorLocal(msg.error_id);
        } else if ((msg as LogEntry).log_id) {
          applyLog(msg as LogEntry);
        }
        else {
          applyTelemetry(msg);
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };
    ws.onclose = () => {
      retryRef.current = window.setTimeout(connectWS, 2000);
    };
    ws.onerror = err => {
      console.error("WS error", err);
      ws.close();
    };
  };

  useEffect(() => { const t = window.setTimeout(connectWS, 100);
    return () => { clearTimeout(t); wsRef.current?.close(); if (retryRef.current) clearTimeout(retryRef.current); };
  }, []);

  // HTTP methods
  const fetchHistoricalTelemetry = async (start?: number, end?: number) => {
    const params = new URLSearchParams();
    if (start !== undefined) params.set('start', String(start));
    if (end   !== undefined) params.set('end',   String(end));
    const res = await fetch(`http://${window.location.hostname}:8000/api/telemetry/historical?${params}`);
    const arr = await res.json();
    setData(prev => ({ ...prev, telemetryBuffer: arr }));
  };

  const fetchHistoricalLogs = async (start?: number, end?: number) => {
    const params = new URLSearchParams();
    if (start !== undefined) params.set('start', String(start));
    if (end   !== undefined) params.set('end',   String(end));
    const res = await fetch(`http://${window.location.hostname}:8000/api/log/historical?${params}`);
    const arr: LogEntry[] = await res.json();
    setData(prev => ({ ...prev, historicalLogs: arr }));
  };

  const addLog = async ({ log_id, variables, timestamp }: LogEntry) => {
    await fetch(`http://${window.location.hostname}:8000/api/log/logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id, variables, timestamp }),
    });
  };

  const sendCommand = async (action: string) => {
    await fetch(`http://${window.location.hostname}:8000/api/command/${action}`, { method: 'POST' });
  };

  const sendMission = async (mission: Mission) => {
    await fetch(`http://${window.location.hostname}:8000/api/mission/process`, {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(mission),
    });
  };

  const fetchProcessedMission = async (): Promise<ProcessedMission|null> => {
    const res = await fetch(`http://${window.location.hostname}:8000/api/mission/process`);
    return res.ok ? res.json() : null;
  };

  const fetchAutosaveMission = async (): Promise<Mission|null> => {
    const res = await fetch(`http://${window.location.hostname}:8000/api/mission/autosave`);
    if (res.status === 404) return null;
    return res.json();
  };

  return (
    <TelemetryContext.Provider value={{
      ...data,
      logs: data.logs,
      historicalLogs: data.historicalLogs,
      telemetryBuffer: data.telemetryBuffer,
      sendCommand,
      fetchHistoricalTelemetry,
      fetchHistoricalLogs,
      addLog,
      sendMission,
      fetchProcessedMission,
      fetchAutosaveMission,
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}
