// ./src/types.ts
export type LogEntry = {
    timestamp: number;
    log_id: string;
    variables?: Record<string, any>;
};

/* MAVLink Telemetry Types */

export interface HEARTBEAT {
    type: number;
    autopilot: number;
    base_mode: number;
    custom_mode: number;
    system_status: number;
    mavlink_version: number;
}

export interface AHRS {
    omegaIx: number;
    omegaIy: number;
    omegaIz: number;
    accel_weight: number;
    renorm_val: number;
    error_rp: number;
    error_yaw: number;
}

export interface ATTITUDE {
    time_boot_ms: number;
    roll: number;
    pitch: number;
    yaw: number;
    rollspeed: number;
    pitchspeed: number;
    yawspeed: number;
}

export interface AOA_SSA {
    time_usec: number;
    AOA: number;
    SSA: number;
}

export interface BATTERY_STATUS {
    id: number;
    battery_function: number;
    type: number;
    temperature: number;
    voltages: number[];
    current_battery: number;
    current_consumed: number;
    energy_consumed: number;
    battery_remaining: number;
    time_remaining: number;
    charge_state: number;
    voltages_ext: number[];
    mode: number;
    fault_bitmask: number;
}

export interface GLOBAL_POSITION_INT {
    time_boot_ms: number;
    lat: number;
    lon: number;
    alt: number;
    relative_alt: number;
    vx: number;
    vy: number;
    vz: number;
    hdg: number;
}

export interface VFR_HUD {
    airspeed: number;
    groundspeed: number;
    heading: number;
    throttle: number;
    alt: number;
    climb: number;
}

export interface SYS_STATUS {
    onboard_control_sensors_present: number;
    onboard_control_sensors_enabled: number;
    onboard_control_sensors_health: number;
    load: number;
    voltage_battery: number;
    current_battery: number;
    battery_remaining: number;
    drop_rate_comm: number;
    errors_comm: number;
    errors_count1: number;
    errors_count2: number;
    errors_count3: number;
    errors_count4: number;
}

export interface POWER_STATUS {
    Vcc: number;
    Vservo: number;
    flags: number;
}

export interface MEMINFO {
    brkval: number;
    freemem: number;
    freemem32: number;
}

export interface NAV_CONTROLLER_OUTPUT {
    nav_roll: number;
    nav_pitch: number;
    nav_bearing: number;
    target_bearing: number;
    wp_dist: number;
    alt_error: number;
    aspd_error: number;
    xtrack_error: number;
}

export interface MISSION_CURRENT {
    seq: number;
    total: number;
    mission_state: number;
    mission_mode: number;
}

export interface SERVO_OUTPUT_RAW {
    time_usec: number;
    port: number;
    servo1_raw: number;
    servo2_raw: number;
    servo3_raw: number;
    servo4_raw: number;
    servo5_raw: number;
    servo6_raw: number;
    servo7_raw: number;
    servo8_raw: number;
    servo9_raw: number;
    servo10_raw: number;
    servo11_raw: number;
    servo12_raw: number;
    servo13_raw: number;
    servo14_raw: number;
    servo15_raw: number;
    servo16_raw: number;
}

export interface RC_CHANNELS {
    time_boot_ms: number;
    chancount: number;
    chan1_raw: number;
    chan2_raw: number;
    chan3_raw: number;
    chan4_raw: number;
    chan5_raw: number;
    chan6_raw: number;
    chan7_raw: number;
    chan8_raw: number;
    chan9_raw: number;
    chan10_raw: number;
    chan11_raw: number;
    chan12_raw: number;
    chan13_raw: number;
    chan14_raw: number;
    chan15_raw: number;
    chan16_raw: number;
    chan17_raw: number;
    chan18_raw: number;
    rssi: number;
}

export interface RAW_IMU {
    time_usec: number;
    xacc: number;
    yacc: number;
    zacc: number;
    xgyro: number;
    ygyro: number;
    zgyro: number;
    xmag: number;
    ymag: number;
    zmag: number;
    id: number;
    temperature: number;
}

export interface SCALED_IMU2 {
    time_boot_ms: number;
    xacc: number;
    yacc: number;
    zacc: number;
    xgyro: number;
    ygyro: number;
    zgyro: number;
    xmag: number;
    ymag: number;
    zmag: number;
    temperature: number;
}

export interface SCALED_IMU3 {
    time_boot_ms: number;
    xacc: number;
    yacc: number;
    zacc: number;
    xgyro: number;
    ygyro: number;
    zgyro: number;
    xmag: number;
    ymag: number;
    zmag: number;
    temperature: number;
}

export interface SCALED_PRESSURE {
    time_boot_ms: number;
    press_abs: number;
    press_diff: number;
    temperature: number;
    temperature_press_diff: number;
}

export interface SCALED_PRESSURE2 {
    time_boot_ms: number;
    press_abs: number;
    press_diff: number;
    temperature: number;
    temperature_press_diff: number;
}

export interface GPS_RAW_INT {
    time_usec: number;
    fix_type: number;
    lat: number;
    lon: number;
    alt: number;
    eph: number;
    epv: number;
    vel: number;
    cog: number;
    satellites_visible: number;
    alt_ellipsoid: number;
    h_acc: number;
    v_acc: number;
    vel_acc: number;
    hdg_acc: number;
    yaw: number;
}

export interface SYSTEM_TIME {
    time_unix_usec: number;
    time_boot_ms: number;
}

export interface WIND {
    direction: number;
    speed: number;
    speed_z: number;
}

export interface TERRAIN_REPORT {
    lat: number;
    lon: number;
    spacing: number;
    terrain_height: number;
    current_height: number;
    pending: number;
    loaded: number;
}

export interface EKF_STATUS_REPORT {
    flags: number;
    velocity_variance: number;
    pos_horiz_variance: number;
    pos_vert_variance: number;
    compass_variance: number;
    terrain_alt_variance: number;
    airspeed_variance: number;
}

export interface VIBRATION {
    time_usec: number;
    vibration_x: number;
    vibration_y: number;
    vibration_z: number;
    clipping_0: number;
    clipping_1: number;
    clipping_2: number;
}

export interface POSITION_TARGET_GLOBAL_INT {
    time_boot_ms: number;
    coordinate_frame: number;
    type_mask: number;
    lat_int: number;
    lon_int: number;
    alt: number;
    vx: number;
    vy: number;
    vz: number;
    afx: number;
    afy: number;
    afz: number;
    yaw: number;
    yaw_rate: number;
}

export interface MCU_STATUS {
    id: number;
    MCU_temperature: number;
    MCU_voltage: number;
    MCU_voltage_min: number;
    MCU_voltage_max: number;
}

export interface UNKNOWN_295 {
    data: number[];
}

export interface AHRS2 {
    roll: number;
    pitch: number;
    yaw: number;
    altitude: number;
    lat: number;
    lng: number;
}

export interface LOCAL_POSITION_NED{
    time_boot_ms: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
}

export interface GPS_GLOBAL_ORIGIN {
    latitude: number;
    longitude: number;
    altitude: number;
    time_usec: number;
}

export interface HOME_POSITION {
    latitude: number;
    longitude: number;
    altitude: number;
    x: number;
    y: number;
    z: number;
    q: number[];
    approach_x: number;
    approach_y: number;
    approach_z: number;
    time_usec: number;
}

export interface Telemetry {
    HEARTBEAT?: HEARTBEAT;
    AHRS?: AHRS;
    ATTITUDE?: ATTITUDE;
    GLOBAL_POSITION_INT?: GLOBAL_POSITION_INT;
    VFR_HUD?: VFR_HUD;
    SYS_STATUS?: SYS_STATUS;
    POWER_STATUS?: POWER_STATUS;
    MEMINFO?: MEMINFO;
    NAV_CONTROLLER_OUTPUT?: NAV_CONTROLLER_OUTPUT;
    MISSION_CURRENT?: MISSION_CURRENT;
    SERVO_OUTPUT_RAW?: SERVO_OUTPUT_RAW;
    RC_CHANNELS?: RC_CHANNELS;
    RAW_IMU?: RAW_IMU;
    SCALED_IMU2?: SCALED_IMU2;
    SCALED_IMU3?: SCALED_IMU3;
    SCALED_PRESSURE?: SCALED_PRESSURE;
    SCALED_PRESSURE2?: SCALED_PRESSURE2;
    GPS_RAW_INT?: GPS_RAW_INT;
    SYSTEM_TIME?: SYSTEM_TIME;
    WIND?: WIND;
    TERRAIN_REPORT?: TERRAIN_REPORT;
    EKF_STATUS_REPORT?: EKF_STATUS_REPORT;
    VIBRATION?: VIBRATION;
    POSITION_TARGET_GLOBAL_INT?: POSITION_TARGET_GLOBAL_INT;
    BATTERY_STATUS?: BATTERY_STATUS;
    AOA_SSA?: AOA_SSA;
    MCU_STATUS?: MCU_STATUS;
    UNKNOWN_295?: UNKNOWN_295;
    AHRS2?: AHRS2;
    LOCAL_POSITION_NED?: LOCAL_POSITION_NED;
    GPS_GLOBAL_ORIGIN?: GPS_GLOBAL_ORIGIN;
    HOME_POSITION?: HOME_POSITION;
    logs: LogEntry[];
}


// --- Context type now includes your new HTTP methods ---
export interface TelemetryContextType extends Telemetry {
    logs: LogEntry[];

    fetchLatestTelemetry: (start?: number, end?: number) => Promise<void>;
    fetchHistoricalLogs: (start?: number, end?: number) => Promise<void>;
    addLog(entry: { log_id: string; variables?: Record<string, any>; timestamp?: number }): Promise<void>;
    sendCommand(command: string): Promise<void>;
    sendMission(mission: Mission): Promise<void>;
    fetchProcessedMission(): Promise<ProcessedMission | null>;
    fetchAutosaveMission(): Promise<Mission | null>;
}

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
}

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

// Settings
export type SettingValue = string | number | boolean | Record<string, any> | null;
export type SettingsMap = Record<string, SettingValue>;