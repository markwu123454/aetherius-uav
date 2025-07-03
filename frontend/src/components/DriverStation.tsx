import {Button} from "@/components/ui/button";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {useEffect, useRef, useState} from "react";
import {useRealTime} from "@/lib/RealTimeContext";
import PopupModal from "@/components/ui/PopupModal";
import type {ATTITUDE, SYS_STATUS, GLOBAL_POSITION_INT} from "@/types";
import {shouldDisplayLog, formatLogEntry, logEntryClasses} from "@/lib/LogUtils";
import HoldToConfirmButton from "@/components/ui/HoldToConfirmButton.tsx";

function zeroProxy<T>(): T {
    return new Proxy({}, {
        get: (_, p) => {
            if (typeof p === "string" && p.endsWith("s")) return [];
            return 0;
        }
    }) as T;
}

export default function DriverStation() {
    const {
        sendCommand,
        sendRawCommand,
        state,
    } = useRealTime();


    // TODO: replace with real armed state from ApiContext
    const [isArmed, setIsArmed] = useState(false);

    // Abort confirmation
    const [showAbortConfirm, setShowAbortConfirm] = useState(false);
    // const enterTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Custom MAVLink command state
    const [customCmd, setCustomCmd] = useState<string>("");
    const [customParams, setCustomParams] = useState<string[]>(Array(7).fill(""));

    const sys = (state.telemetry["SYS_STATUS"] as SYS_STATUS | undefined) ?? zeroProxy<SYS_STATUS>();
    const gps = (state.telemetry["GLOBAL_POSITION_INT"] as GLOBAL_POSITION_INT | undefined) ?? zeroProxy<GLOBAL_POSITION_INT>();
    const attitude = (state.telemetry["ATTITUDE"] as ATTITUDE | undefined) ?? zeroProxy<ATTITUDE>();


    // Logs
    const logContainerRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(true);
    const SCROLL_THRESHOLD = 50;

    function isAtBottom(): boolean {
        const el = logContainerRef.current;
        if (!el) return false;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    }

    // Scroll to bottom if sticky
    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;
        if (isSticky) {
            el.scrollTop = el.scrollHeight;
        }
    }, [state.allLogs, isSticky]);

    // Watch scroll behavior to update isSticky
    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;

        const onScroll = () => {
            if (isAtBottom()) {
                if (!isSticky) setIsSticky(true);
            } else {
                if (isSticky) setIsSticky(false);
            }
        };

        el.addEventListener("scroll", onScroll);
        return () => el.removeEventListener("scroll", onScroll);
    }, [isSticky]);

    const displayed = state.allLogs
        .filter(entry => shouldDisplayLog(entry))
        .slice(-50)
        .map((entry, idx) => {
            const text = formatLogEntry(entry) || '';
            return (
                <p key={idx} className={logEntryClasses(entry.log_id)}>
                    {text}
                </p>
            );
        });


    // Handle Enter triple-tap to disarm
    useEffect(() => {
        let pressCount = 0;
        let timer: NodeJS.Timeout;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            if (!isArmed) return;

            e.preventDefault();
            pressCount += 1;
            if (pressCount === 1) {
                setShowAbortConfirm(true);
                timer = setTimeout(() => {
                    setShowAbortConfirm(false);
                    pressCount = 0;
                }, 1500);
            }
            if (pressCount >= 3) {
                sendCommand('disarm');
                setShowAbortConfirm(false);
                clearTimeout(timer);
                pressCount = 0;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            if (timer) clearTimeout(timer);
        };
    }, [isArmed, sendCommand]);

    // Built-in commands
    const sendArm = () => {
        sendCommand('arm');
    };
    const sendDisarm = () => {
        sendCommand('disarm');
    };
    const sendManual = () => sendCommand('manual');
    const sendRTL = () => sendCommand('rtl');

    // Send custom MAVLink
    const handleSendCustom = () => {
        const params: Array<number | string> = customParams.map(p => {
            const trimmed = p.trim();
            if (trimmed === '') {
                return 0;
            }
            const num = Number(trimmed);
            return isNaN(num) ? trimmed : num;
        });

        sendRawCommand({
            command: customCmd,
            params,
        });
    };


    return (
        <>
            {/* Abort Modal */}
            <PopupModal
                title="Confirm Emergency Abort"
                isOpen={showAbortConfirm}
                onClose={() => {
                }}
                closeOnBackdrop={false}
                showCloseButton={false}
                buttons={[
                    {
                        label: "Disarm", variant: "danger", onClick: () => {
                            sendDisarm();
                            setShowAbortConfirm(false);
                        }
                    },
                    {label: "Stay Armed", variant: "secondary", onClick: () => setShowAbortConfirm(false)},
                ]}
            >
                <p className="text-sm text-zinc-300">
                    The system is armed. Press Enter three times quickly to confirm disarm.
                </p>
            </PopupModal>

            <div
                className="fixed bottom-0 left-0 w-full !h-[240px] bg-zinc-900 border-t border-zinc-800 z-50 shadow-xl !px-6 !py-4 text-sm font-mono">
                <div className="flex justify-between !h-full !gap-6">

                    {/* Telemetry */}
                    <Card className="w-1/3 bg-zinc-800 !text-zinc-200 !p-2">
                        <CardHeader className="!p-2">
                            <CardTitle>Telemetry</CardTitle>
                        </CardHeader>
                        <CardContent className="!space-y-1 !px-2">
                            <div>Battery: {sys.current_battery ?? "—"}</div>
                            <div>Latitude: {gps.lat ? gps.lat / 1e7 : "—"}</div>
                            <div>Longitude: {gps.lon ? gps.lon / 1e7 : "—"}</div>
                            <div>Altitude: {gps.alt ? gps.alt / 1000 + " m" : "—"}</div>
                            <div>Pitch: {attitude.pitch ?? "—"}</div>
                            <div>Roll: {attitude.roll ?? "—"}</div>
                            <div>Yaw: {attitude.yaw ?? "—"}</div>
                            <div>Comm Drop
                                Rate: {sys.drop_rate_comm != null ? (sys.drop_rate_comm / 100).toFixed(1) + "%" : "—"}</div>
                        </CardContent>
                    </Card>

                    {/* Controls */}
                    <Card className="w-1/3 bg-zinc-800 !text-zinc-200 !p-2 overflow-y-auto scrollbar-dark">
                        <CardHeader className="!p-2"><CardTitle>Controls</CardTitle></CardHeader>
                        <CardContent className="!space-y-4 ">
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={sendArm}>ARM</Button>
                                <Button variant="outline" onClick={sendDisarm}>DISARM</Button>
                                <Button variant="outline" onClick={sendManual}>MANUAL</Button>
                                <Button variant="outline" onClick={sendRTL}>RTL</Button>
                                <HoldToConfirmButton onConfirm={sendDisarm}>ABORT</HoldToConfirmButton>
                            </div>

                            {/* Custom MAVLink */}
                            <div className="grid grid-cols-1 gap-2">
                                <Input
                                    type="text"
                                    value={customCmd}
                                    onChange={e => setCustomCmd(e.target.value)}
                                    placeholder="Custom command (commands sent here do not have safety checks)"
                                />

                                <div className="grid grid-cols-7 gap-2">
                                    {customParams.map((v, i) => (
                                        <Input
                                            key={i}
                                            type="text"
                                            value={v}
                                            onChange={e => {
                                                const arr = [...customParams];
                                                arr[i] = e.target.value;
                                                setCustomParams(arr);
                                            }}
                                            placeholder={`P${i}`}
                                        />
                                    ))}
                                </div>
                                <Button variant="outline" onClick={handleSendCustom}>Send Custom</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Logs */}
                    <Card className="w-1/3 bg-zinc-800 text-zinc-200 !p-2">
                        <CardHeader className="!p-2">
                            <CardTitle>Logs</CardTitle>
                        </CardHeader>
                        <CardContent
                            ref={logContainerRef}
                            className="!p-0 overflow-y-auto !max-h-40 !px-2 !space-y-1 scrollbar-dark"
                        >
                            {displayed.length > 0 ? displayed : (
                                <p className="italic text-zinc-500">No important logs</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
