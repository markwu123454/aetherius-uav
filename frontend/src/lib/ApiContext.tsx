// src/context/ApiContext.tsx
import {createContext, useContext, type ReactNode, useCallback} from "react";
import type {Telemetry, LogEntry, Mission, ProcessedMission, SettingValue, SettingsMap} from "@/types";

export interface ApiContextProps {
    fetchTelemetry: (start?: number, end?: number) => Promise<Partial<Telemetry>[]>;
    fetchLogs: (start?: number, end?: number) => Promise<LogEntry[]>;
    sendMission: (mission: Mission) => Promise<void>;
    fetchProcessedMission: () => Promise<ProcessedMission | null>;
    fetchAutosaveMission: () => Promise<Mission | null>;
    sendCommandLong: (command: number | string, params: (number | string)[]) => Promise<void>;
    updateSetting: (setting: string, value: SettingValue) => Promise<any>;
    fetchFullSettings: () => Promise<Record<string, SettingValue>>;
}

const ApiContext = createContext<ApiContextProps>({
    fetchTelemetry: async () => [],
    fetchLogs: async () => [],
    sendMission: async () => {},
    fetchProcessedMission: async () => null,
    fetchAutosaveMission: async () => null,
    sendCommandLong: async () => {},
    updateSetting: async () => ({}),
    fetchFullSettings: async () => ({}),
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
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mission),
        });
        console.log("send")
    }, []);

    const fetchProcessedMission = useCallback(async () => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/mission/process`);
        return res.ok ? res.json() : null;
    }, []);

    const fetchAutosaveMission = useCallback(async () => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/mission/autosave`);
        console.log("fetch")
        if (res.status === 404) return null;
        return res.json();
    }, []);

    const sendCommandLong = useCallback(async (command: number | string, params: (number | string)[]) => {
        try {
            const res = await fetch(`http://${window.location.hostname}:55050/api/command/command_long`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({command, params}),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            console.error("Command failed", err);
        }
    }, []);

    const updateSetting = useCallback(async (setting: string, value: SettingValue) => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/setting/update`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({setting, value}),
        });
        if (!res.ok) {
            throw new Error(`Failed to update setting: ${res.status} ${res.statusText}`);
        }
        return await res.json();  // { status: "ok", updated: {setting: value} }
    }, []);

    const fetchFullSettings = useCallback(async (): Promise<SettingsMap> => {
        const res = await fetch(`http://${window.location.hostname}:55050/api/setting/full`);
        if (!res.ok) {
            throw new Error(`Failed to fetch settings: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return data.settings;
    }, []);


    return (
        <ApiContext.Provider value={{
            fetchTelemetry,
            fetchLogs,
            sendMission,
            fetchProcessedMission,
            fetchAutosaveMission,
            sendCommandLong,
            updateSetting,
            fetchFullSettings,
        }}>
            {children}
        </ApiContext.Provider>
    );
}
