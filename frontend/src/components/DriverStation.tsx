import {Button} from "@/components/ui/button";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/card";
import {useEffect, useState, useRef} from "react";
import {useTelemetry} from "@/lib/TelemetryContext";
import PopupModal from "@/components/ui/PopupModal";

export default function DriverStation() {
    const {
        connected,
        uavConnected,
        armed,
        mode,
        rssi,
        ping,
        videoLatency,
        logs,
        sendCommand,
    } = useTelemetry();

    // @ts-ignore
    const [time, setTime] = useState(new Date().toLocaleTimeString());
    const [showAbortConfirm, setShowAbortConfirm] = useState(false);
    // @ts-ignore
    const [enterCount, setEnterCount] = useState(0);
    const [armingWindow, setArmingWindow] = useState(false);
    const enterTimerRef = useRef<NodeJS.Timeout | null>(null);


    // Updated log filtering: include based on importance and severity
    const filteredLogs = logs.filter(log => {
        const impOk = log.importance === 'critical' || log.importance === 'major';
        const sevOk = ['warn', 'error', 'system'].includes(log.severity);
        return impOk || sevOk;
    }).slice(0, 50);

    // Severity badge colors
    const severityColor = (severity: string) => {
        switch (severity) {
            case 'error': return 'bg-red-600 text-white';
            case 'warn':  return 'bg-yellow-500 text-black';
            case 'system': return 'bg-blue-600 text-white';
            case 'info': return 'bg-gray-600 text-white';
            case 'debug': return 'bg-green-600 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    // Source badge colors
    const sourceColor = (source: string) => {
        switch (source) {
            case 'Pixhawk': return 'bg-indigo-600 text-white';
            case 'Telemetry': return 'bg-teal-600 text-white';
            case 'Network': return 'bg-purple-600 text-white';
            case 'AI': return 'bg-pink-600 text-white';
            case 'Vision': return 'bg-green-700 text-white';
            case 'System': return 'bg-gray-800 text-white';
            case 'Mission': return 'bg-orange-500 text-white';
            case 'GCS': return 'bg-gray-700 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    useEffect(() => {
        const clock = setInterval(() => {
            setTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(clock);
    }, []);

    useEffect(() => {
        let enterPressed = false;
        let resetTimer: NodeJS.Timeout;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Enter" && !enterPressed) {
                enterPressed = true;

                if (armed) {
                    event.preventDefault();

                    if (!showAbortConfirm) {
                        console.log("[Enter] First press — showing confirmation");
                        setShowAbortConfirm(true);
                        setEnterCount(1);
                        setArmingWindow(true);

                        resetTimer = setTimeout(() => {
                            setArmingWindow(false);
                            setEnterCount(0);
                        }, 1500);
                    } else if (armingWindow) {
                        setEnterCount(prev => {
                            const newCount = prev + 1;
                            if (newCount >= 3) {
                                console.log("[Enter] Triple tap detected — disarming");
                                sendCommand("disarm");
                                setShowAbortConfirm(false);
                                setEnterCount(0);
                                setArmingWindow(false);
                                clearTimeout(resetTimer);
                            }
                            return newCount;
                        });
                    }
                }
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Enter") {
                enterPressed = false;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            clearTimeout(resetTimer);
        };
    }, [armed, showAbortConfirm, armingWindow]);


    useEffect(() => {
        if (!armed && showAbortConfirm) {
            console.log("[State] UAV disarmed — closing confirmation modal");
            setShowAbortConfirm(false);
            setEnterCount(0);
            setArmingWindow(false);
            if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
        }
    }, [armed, showAbortConfirm]);


    const sendArm = () => sendCommand("arm");
    const sendDisarm = () => sendCommand("disarm");
    const sendHold = () => sendCommand("hold_alt");
    const sendRTL = () => sendCommand("rtl");
    const sendAbort = () => sendCommand("abort");

    return (
        <>
            {/* === ABORT CONFIRM MODAL === */}
            <PopupModal
                title="Confirm Emergency Abort"
                isOpen={showAbortConfirm}
                onClose={() => {
                }}
                closeOnBackdrop={false}
                showCloseButton={false}
                buttons={[
                    {
                        label: "Disarm",
                        variant: "danger",
                        onClick: () => {
                            sendDisarm();
                            setShowAbortConfirm(false);
                        },
                    },
                    {
                        label: "Stay Armed",
                        variant: "secondary",
                        onClick: () => setShowAbortConfirm(false),
                    },
                ]}
            >
                <p className="text-sm text-zinc-300">
                    The system is currently <span className="text-green-400 font-semibold">armed</span>.<br/>
                    Pressing <kbd>Enter</kbd> again without confirmation could lead to dangerous behavior.<br/>
                    Please confirm whether you want to disarm or stay armed.
                </p>
            </PopupModal>

            {/* === DRIVER STATION UI === */}
            <div
                className="fixed bottom-0 left-0 w-full h-[240px] bg-zinc-900 border-t border-zinc-800 z-50 shadow-xl !px-6 !py-4 text-sm font-mono"
            >
                <div className="flex justify-between h-full gap-6">

                    {/* TELEMETRY */}
                    <Card className="w-1/3 bg-zinc-800 text-zinc-200 !p-2">
                        <CardHeader className="!p-2"><CardTitle>Telemetry</CardTitle></CardHeader>
                        <CardContent className="!space-y-1 !px-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}/>
                                Backend: {connected ? "Connected" : "Disconnected"}
                            </div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-2 h-2 rounded-full ${uavConnected ? "bg-green-500" : "bg-yellow-400"}`}/>
                                Aircraft: {uavConnected ? "Connected" : "No Heartbeat"}
                            </div>
                            <div>Status: <span
                                className={armed ? "text-green-400" : "text-red-400"}>{armed ? "Armed" : "Disarmed"}</span>
                            </div>
                            <div>Mode: <span className="text-blue-400">{mode}</span></div>
                            <div>RSSI: <span className="text-white">{rssi}</span></div>
                            <div>Ping: <span className="text-white">{ping}</span></div>
                            <div>Video Latency: <span className="text-white">{videoLatency}</span></div>
                        </CardContent>
                    </Card>

                    {/* CURRENT MISSION */}
                    <Card className="w-1/3 bg-zinc-800 text-zinc-200 !p-2">
                        <CardHeader className="!p-2"><CardTitle>Current Mission</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLButtonElement).blur();
                                        sendArm();
                                    }}
                                >
                                    ARM
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLButtonElement).blur();
                                        sendDisarm();
                                    }}
                                >
                                    DISARM
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLButtonElement).blur();
                                        sendHold();
                                    }}
                                >
                                    HOLD ALT
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={(e) => {
                                        (e.currentTarget as HTMLButtonElement).blur();
                                        sendRTL();
                                    }}
                                >
                                    RTL
                                </Button>
                            </div>

                            <Button
                                variant="destructive"
                                onClick={sendAbort}
                                className="text-white font-bold !px-8 py-2 shadow-md"
                            >
                                ABORT
                            </Button>
                        </CardContent>
                    </Card>

                    {/* LOGS */}
                    <Card className="w-1/3 bg-zinc-800 text-zinc-200 !p-2">
                        <CardHeader className="!p-2"><CardTitle>Logs</CardTitle></CardHeader>
                        <CardContent className="!p-0">
                            <div className="overflow-y-auto max-h-40 !p-2 !space-y-1 scrollbar-dark">
                                {filteredLogs.length === 0 ? (
                                    <p className="italic text-zinc-500">No important logs</p>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-2">
                                            <span className="flex-none text-xs text-zinc-500">[{log.timestamp}]</span>
                                            <span className={`rounded !px-1 text-xs ${severityColor(log.severity)}`}> {log.severity.toUpperCase()} </span>
                                            <span className={`rounded !px-1 text-xs ${sourceColor(log.source)}`}> {log.source} </span>
                                            <span className="flex-grow text-zinc-300">{log.message}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </>
    );
}
