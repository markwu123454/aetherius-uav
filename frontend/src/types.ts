// ./src/types.ts
export type LogEntry = {
    id?: number;
    timestamp: string;
    message: string;
    importance: "minor" | "major" | "critical";
    severity: "info" | "warning" | "error" | "system" | "debug";
    source: "Pixhawk" | "Telemetry" | "Network" | "AI" | "Vision" | "GCS" | "Mission" | "System";
};

export type TelemetryPoint = {
    timestamp: string;
    lat: number;
    lon: number;
    sats: number;
    hdop: number;
    voltage: number;
    current: number;
    percent: number;
    rssi: string;
    ping: string;
    videoLatency: string;
    mode: string;
    armed: boolean;
};

export type GPSData = { lat: number | string; lon: number | string; sats: number | string; hdop: number | string };

export type BatteryData = { voltage: number; current: number; percent: number | string };

export type TelemetryState = {
    gps: GPSData;
    battery: BatteryData;
    mode: string;
    armed: boolean;
    rssi: string;
    ping: string;
    videoLatency: string;
    recording: boolean;
    connected: boolean;
    uavConnected: boolean;
    logs: LogEntry[];
    telemetryBuffer: TelemetryPoint[];
};

export interface TelemetryContextType extends TelemetryState {
    sendCommand: (command: string) => Promise<void>;
    fetchLatestTelemetry: () => Promise<void>;
    sendMission: (mission: Mission) => Promise<void>;
    fetchProcessedMission: () => Promise<ProcessedMission | null>;
    fetchAutosaveMission: () => Promise<Mission | null>;
}

export type ProcessedMission = {
    total_distance_km: number;
    estimated_time_min: number;
    errors: string[];
    flight_path?: { lat: number; lon: number; alt: number }[];
    available_logic?: {
        file: string;
        class: string;
        method: string;
        parameters: string[]; // list of argument names
    }[];
};

export type Waypoint = {
    id: number;
    lat: number;
    lon: number;
    alt: number;
    type: "Navigate" | "Loiter" | "RTL" | "Conditional" | "MissionAction";
    name?: string;

    // Optional fields based on type
    condition?: string;         // Used only for type === "Conditional"
    function?: string;          // Used only for type === "MissionAction"
    params?: string;            // JSON string for MissionAction parameters
};


export interface Mission {
    waypoints: Waypoint[];
    cruise_speed: number;
    loiter_radius: number;
    takeoff_alt: number;
    landing_descent_rate: number;
    abort_alt: number;
    rtl: boolean;
    repeat: boolean;
    logic_files?: {
        [filename: string]: string; // filename → file contents
    };
}

