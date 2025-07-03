import React, {createContext, useContext, useEffect, useReducer, useRef, type ReactNode, useState} from "react";
import {useApi} from "@/lib/ApiContext"
import type {Telemetry, LogEntry} from "@/types";

export interface ErrorEntry {
    id: string;
    name: string;
    level: "info" | "warn" | "error";
}

interface RealTimeState {
    telemetry: Partial<Telemetry>;
    buffer: Partial<Telemetry>[];
    liveLogs: LogEntry[];
    allLogs: LogEntry[];
    activeErrors: Record<string, ErrorEntry>;
}

const initialRT: RealTimeState = {
    telemetry: {},
    buffer: [],
    liveLogs: [],
    allLogs: [],
    activeErrors: {},
};

type RealTimeAction =
    | { type: "telemetry"; payload: Partial<Telemetry> }
    | { type: "buffer"; payload: Partial<Telemetry>[] }
    | { type: "log"; payload: LogEntry }
    | { type: "error_raise"; payload: ErrorEntry }
    | { type: "error_clear"; payload: { id: string } };

function rtReducer(state: RealTimeState, action: RealTimeAction): RealTimeState {
    switch (action.type) {
        case "telemetry":
            return {...state, telemetry: {...state.telemetry, ...action.payload}};
        case "buffer":
            return {...state, buffer: action.payload};
        case "log":
            return {
                ...state,
                liveLogs: [action.payload, ...state.liveLogs].slice(0, 1000),
                allLogs: deduplicateAndSortLogs([...state.allLogs, action.payload]),
            };
        case "error_raise":
            return {
                ...state,
                activeErrors: {...state.activeErrors, [action.payload.id]: action.payload},
            };
        case "error_clear": {
            const errs = {...state.activeErrors};
            delete errs[action.payload.id];
            return {...state, activeErrors: errs};
        }
        default:
            return state;
    }
}

export interface RealTimeContextProps {
    state: RealTimeState;
    dispatch: React.Dispatch<RealTimeAction>;
    sendCommand: (msg: any) => void;
    sendRawCommand: (msg: any) => void;
    paused: boolean;
    setPaused: (val: boolean) => void;
    flushBuffer: () => void;
}

const RealTimeContext = createContext<RealTimeContextProps>({
    state: initialRT,
    dispatch: () => {
    },
    sendCommand: () => {
    },
    sendRawCommand: () => {
    },
    paused: false,
    setPaused: () => {
    },
    flushBuffer: () => {
    },
});

function deduplicateAndSortLogs(logs: LogEntry[]): LogEntry[] {
    const seen = new Set<string>();
    const result: LogEntry[] = [];

    for (const log of logs) {
        const key = `${log.log_id}-${log.timestamp}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(log);
        }
    }

    // Sort by timestamp ascending
    result.sort((a, b) => a.timestamp - b.timestamp);
    return result;
}

export const useRealTime = () => useContext(RealTimeContext);

export function RealTimeProvider({children}: { children: ReactNode }) {
    const [state, dispatch] = useReducer(rtReducer, initialRT);
    const wsRef = useRef<WebSocket | null>(null);
    const {fetchLogs} = useApi();

    const [paused, setPaused] = useState(false);
    const pausedRef = useRef(false);
    const pendingBuffer = useRef<{ type: string, data: any }[]>([]);

    const flushBuffer = () => {
        for (const msg of pendingBuffer.current) {
            switch (msg.type) {
                case "telemetry":
                    dispatch({type: "telemetry", payload: msg.data});
                    break;
                case "buffer":
                    dispatch({type: "buffer", payload: msg.data});
                    break;
                case "log":
                    dispatch({type: "log", payload: msg.data});
                    break;
                case "error_raise":
                    dispatch({type: "error_raise", payload: msg.data});
                    break;
                case "error_clear":
                    dispatch({type: "error_clear", payload: msg.data});
                    break;
            }
        }
        pendingBuffer.current = [];
    };


    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);


    useEffect(() => {
        fetchLogs()
            .then(logs => {
                deduplicateAndSortLogs(logs).forEach(log => {
                    dispatch({type: "log", payload: log});
                });
            })
            .catch(err => console.error("Failed to load historical logs", err));
    }, []);

    const sendCommand = (msg: any) => {
        const ws = wsRef.current;
        console.log("sendCommand", msg);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "command",
                message: msg
            }));
        }
    };

    const sendRawCommand = (msg: any) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "command_raw",
                msg
            }));
        }
    };

    useEffect(() => {
        let retry: number;

        function connect() {
            const ws = new WebSocket(`ws://${window.location.hostname}:55050/ws/telemetry`);
            wsRef.current = ws;

            ws.onmessage = evt => {
                queueMicrotask(() => {
                    try {
                        const msg = JSON.parse(evt.data);

                        if (!pausedRef.current) {
                            switch (msg.type) {
                                case "telemetry":
                                    dispatch({type: "telemetry", payload: msg.data});
                                    break;
                                case "buffer":
                                    dispatch({type: "buffer", payload: msg.data});
                                    break;
                                case "log":
                                    dispatch({type: "log", payload: msg.data});
                                    break;
                                case "error_raise":
                                    dispatch({type: "error_raise", payload: msg.data});
                                    break;
                                case "error_clear":
                                    dispatch({type: "error_clear", payload: msg.data});
                                    break;
                                case "_":
                                    console.error(msg);
                                    break;
                            }
                        } else {
                            pendingBuffer.current.push({type: msg.type, data: msg.data});
                        }

                    } catch (e) {
                        console.error("Failed to parse WebSocket message", e);
                    }
                });
            };


            ws.onclose = () => {
                retry = window.setTimeout(connect, 2000);
            };

            ws.onerror = err => {
                console.error("WebSocket error", err);
                ws.close();
            };
        }

        connect();

        return () => {
            wsRef.current?.close();
            clearTimeout(retry);
        };
    }, [dispatch]);

    return (
        <RealTimeContext.Provider
            value={{state, dispatch, sendCommand, sendRawCommand, paused, setPaused, flushBuffer}}>
            {children}
        </RealTimeContext.Provider>
    );
}
