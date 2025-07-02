// src/context/ApiContext.tsx
import {createContext, useContext, type ReactNode, useCallback} from "react";
import type {Telemetry, LogEntry, Mission, ProcessedMission} from "@/types";

export interface ApiContextProps {
    fetchTelemetry: (start?: number, end?: number) => Promise<Partial<Telemetry>[]>;
    fetchLogs: (start?: number, end?: number) => Promise<LogEntry[]>;
    sendMission: (mission: Mission) => Promise<void>;
    fetchProcessedMission: () => Promise<ProcessedMission | null>;
    fetchAutosaveMission: () => Promise<Mission | null>;
}

const ApiContext = createContext<ApiContextProps>({
    fetchTelemetry: async () => [],
    fetchLogs: async () => [],
    sendMission: async () => {},
    fetchProcessedMission: async () => null,
    fetchAutosaveMission: async () => null,
});

export const useApi = () => useContext(ApiContext);

export function ApiProvider({children}: { children: ReactNode }) {
    const fetchTelemetry = useCallback(async (start?: number, end?: number) => {
        const params = new URLSearchParams();
        if (start != null) params.set("start", String(start));
        if (end != null) params.set("end", String(end));
        const res = await fetch(`http://${window.location.hostname}:55050/api/telemetry/historical?${params}`);
        return res.json();
    }, []);

    const fetchLogs = useCallback(async (start?: number, end?: number): Promise<LogEntry[]> => {
        const params = new URLSearchParams();
        params.set("start", String(start ?? 0));
        if (end != null) params.set("end", String(end));
        const res = await fetch(`http://${window.location.hostname}:55050/api/log/historical?${params}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch logs: ${res.status} ${res.statusText}`);
        }
        return await res.json();
    }, []);

    const sendMission = useCallback(async (mission: Mission) => {
        await fetch(`http://${window.location.hostname}:55050/api/mission/process`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mission),
        });
    }, []);

    const fetchProcessedMission = useCallback(async () => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/mission/process`);
        return res.ok ? res.json() : null;
    }, []);

    const fetchAutosaveMission = useCallback(async () => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/mission/autosave`);
        if (res.status === 404) return null;
        return res.json();
    }, []);

    return (
        <ApiContext.Provider value={{
            fetchTelemetry,
            fetchLogs,
            sendMission,
            fetchProcessedMission,
            fetchAutosaveMission,
        }}>
            {children}
        </ApiContext.Provider>
    );
}
