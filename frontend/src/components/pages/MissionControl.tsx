import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useRealTime} from "@/lib/RealTimeContext.tsx";
import * as Cesium from "cesium";
import {Sparkline} from "@/components/ui/Sparkline.tsx";
import {
    GLOBAL_POSITION_INT,
    ATTITUDE,
    RC_CHANNELS,
} from "@/types";
import {TopBar} from "@/components/MissionToppanel";
import {BottomBar} from "@/components/MissionBottompanel"
import {Button} from "@/components/ui/button";
import HoldToConfirmButton from "@/components/ui/HoldToConfirmButton"

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

function zeroProxy<T>(): T {
    return new Proxy({}, {
        get: (_, p) => {
            if (typeof p === "string" && p.endsWith("s")) return [];
            return 0;
        }
    }) as T;
}

function NavigationConfirmModal({onConfirm, onCancel}: {
    onConfirm: () => void,
    onCancel: () => void
}) {
    return (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex items-center justify-center">
            <div className="bg-zinc-900 border border-blue-800 rounded-xl p-6 shadow-lg">
                <div className="text-blue-300 font-bold text-lg pb-4">Exit Fullscreen?</div>
                <div className="text-zinc-400 text-sm">Mission Control requires fullscreen mode.</div>
                <div className="text-zinc-500 text-xs pb-4">Leaving this page may cause loss of control and
                    communications.
                </div>
                <div className="flex justify-end gap-4">
                    <Button variant="ghost" onClick={onCancel}>Return</Button>
                    <HoldToConfirmButton onConfirm={onConfirm} variant="destructive">
                        Leave anyway
                    </HoldToConfirmButton>
                </div>
            </div>
        </div>
    );
}

export default function MissionControl() {
    const ref = useRef<HTMLDivElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const [altHistory, setAltHistory] = useState<number[]>([]);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
    const [tilesetEnabled, setTilesetEnabled] = useState(false);
    const [trackedEntity, setTrackedEntity] = useState<Cesium.Entity | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    const {state} = useRealTime();

    const gps = (state.telemetry["GLOBAL_POSITION_INT"] as GLOBAL_POSITION_INT | undefined) ?? zeroProxy<GLOBAL_POSITION_INT>();
    const att = (state.telemetry["ATTITUDE"] as ATTITUDE | undefined) ?? zeroProxy<ATTITUDE>();
    const rc = (state.telemetry["RC_CHANNELS"] as RC_CHANNELS | undefined) ?? zeroProxy<RC_CHANNELS>();

    const tickWidth = 37.5;
    const degPerTick = 10;
    const pxPerDeg = tickWidth / degPerTick;

    const minDeg = -270;
    const maxDeg = 270;

    const yawDeg = att.yaw * 180 / Math.PI;
    //const centerOffset = -((0 - minDeg) * pxPerDeg) - (381 / 2);
    const centerOffset = -838;

    const ticks = Array.from(
        {length: (maxDeg - minDeg) / degPerTick + 1},
        (_, i) => {
            const rawDeg = minDeg + i * degPerTick;

            // Normalize to [-180, 180]
            let deg = ((rawDeg + 180) % 360 + 360) % 360 - 180;

            const label =
                deg % 90 === 0
                    ? {0: 'N', 90: 'E', 180: 'S', 270: "W", '-90': 'W', '-180': 'S', "-270": "E"}[deg]
                    : deg % 30 === 0
                        ? deg.toString()
                        : '│';

            return (
                <div key={i} className="w-[37.5px] text-center">
                    {label}
                </div>
            );
        }
    );

    const [prevYaw, setPrevYaw] = useState(yawDeg);
    const [smooth, setSmooth] = useState(true);

    const attYawRef = useRef(att.yaw);
    const gpsRAltRef = useRef(gps.relative_alt);

    useEffect(() => {
        attYawRef.current = att.yaw
    }, [att.yaw]);

    useEffect(() => {
        gpsRAltRef.current = gps.relative_alt
    }, [gps.relative_alt]);

    // Smooth wrap around for compass visualization
    useEffect(() => {
        const delta = Math.abs(yawDeg - prevYaw);
        setSmooth(delta < 180); // disable transition if wrapping
        setPrevYaw(yawDeg);
    }, [yawDeg]);

    // Fullscreen change handler
    useEffect(() => {
        const handler = () => {
            if (!document.fullscreenElement) {
                setShowLeaveModal(true);
            }
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    // Enter fullscreen on mount
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (!document.fullscreenElement) {
            el.requestFullscreen().catch(err => {
                console.error("Failed to enter fullscreen:", err);
                setShowLeaveModal(true);
            });
        }
    }, []);

    // Update altitude sparkline
    useEffect(() => {
        const interval = setInterval(() => {
            const yaw = gpsRAltRef.current
            setAltHistory(prev => {
                const updated = [...prev, yaw];
                return updated.length > 240 ? updated.slice(-240) : updated;
            });
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Render cesium map
    useEffect(() => {
        if (!mapRef.current) return;
        const viewerInstance = new Cesium.Viewer(mapRef.current, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            sceneModePicker: false,
            geocoder: false,
            homeButton: false,
            navigationHelpButton: false,
            infoBox: false,
            fullscreenButton: false,
        });
        viewerInstance.scene.globe.depthTestAgainstTerrain = true;
        viewerInstance.scene.skyAtmosphere.show = true;

        console.log("created")

        viewerInstance.scene.setTerrain(
            new Cesium.Terrain(
                Cesium.CesiumTerrainProvider.fromIonAssetId(1)
            )
        );

        // Add static model at specified lat/lon/alt
        const position = Cesium.Cartesian3.fromDegrees(-117.8336087, 33.9829725, 225);
        const entity = viewerInstance.entities.add({
            position,
            model: {
                uri: '/src/assets/low_poly_airplane.glb',
                scale: 0.02,
                minimumPixelSize: 64,
            },
            name: 'UAV'
        });

        setTrackedEntity(entity);
        setViewer(viewerInstance);

        return () => {
            viewerInstance.destroy();
        };
    }, []);

    // Toggle camera tracking plane
    function toggleTracking() {
        if (!viewer || !trackedEntity) return;

        if (isTracking) {
            viewer.trackedEntity = undefined;
            setIsTracking(false);
        } else {
            viewer.trackedEntity = trackedEntity;
            setIsTracking(true);
        }
    }

    // Change tileset to 3D
    async function enableTileset() {
        if (!viewer) return;

        // Hide globe surface
        viewer.scene.globe.show = false;

        // (Optional) Remove all base imagery layers
        viewer.imageryLayers.removeAll();

        // Add tileset
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2275207);
        viewer.scene.primitives.add(tileset);

        setTilesetEnabled(true);
    }

    function passing(): boolean {
        return true;
    }

    return (
        <div ref={ref} className="h-screen min-h-0 grid grid-rows-[60px_1fr_160px] overflow-hidden bg-zinc-950 ">
            <TopBar/>
            <div
                className="row-start-2 h-full min-h-0 overflow-hidden text-blue-300 grid grid-cols-[400px_1fr_500px] font-mono noselect">

                {/* Left Panel */}
                <div
                    className="col-start-1 flex flex-col h-full min-h-0 border-r border-blue-800 bg-zinc-900 p-2 text-sm font-bold tracking-wide space-y-4 text-blue-300">
                    <div className="text-base">VEHICLE COMMANDS & CONTROLS</div>

                    {/* ARM / MODE Section */}
                    <div className="space-y-1">
                        <div className="text-blue-500">ARM / MODE</div>
                        <div className="flex items-center gap-4">
                            {/* ARM/DISARM Buttons */}
                            <HoldToConfirmButton onConfirm={passing} variant={"outline"}>
                                ARM
                            </HoldToConfirmButton>
                            <HoldToConfirmButton onConfirm={passing} variant={"destructive"}>
                                DISARM
                            </HoldToConfirmButton>

                            {/* Mode Selector */}
                            <select
                                className="bg-zinc-800 border border-blue-800 text-blue-300 text-sm font-mono px-2 py-1 rounded">
                                <option value="MANUAL">MANUAL</option>
                                <option value="AUTO">AUTO</option>
                                <option value="LOITER">LOITER</option>
                                <option value="GUIDED">GUIDED</option>
                                <option value="RTL">RTL</option>
                            </select>
                        </div>
                    </div>

                    {/* Mission Execution */}
                    <div className="space-y-1 w-full max-w-[383px]">
                        <div className="text-blue-500">Mission Execution</div>
                        <div className="space-y-2">
                            {/* Progress Bar */}
                            <div className="relative h-[6px] bg-zinc-700 rounded overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300"
                                    style={{width: `${(3 / 10) * 100}%`}}
                                />
                            </div>

                            {/* WP / State / Time */}
                            <div className="flex justify-between text-sm font-mono text-zinc-300">
                                <div className="min-w-[90px]">3 / 10 WPs</div>
                                <div className="min-w-[110px] truncate">State: <span
                                    className="text-white">Paused</span>
                                </div>
                                <div className="min-w-[80px] text-right">Time: <span className="text-white">01:23</span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="px-2 py-1 text-sm">Upload</Button>
                                <Button variant="outline" className="px-2 py-1 text-sm">Start</Button>
                                <Button variant="outline" className="px-2 py-1 text-sm">Pause</Button>
                                <HoldToConfirmButton onConfirm={passing} variant="destructive">
                                    Abort
                                </HoldToConfirmButton>
                            </div>
                        </div>
                    </div>

                    {/* Manual Controls */}
                    <div className="space-y-2 text-sm text-blue-500">
                        <div className="text-blue-500 font-bold tracking-wide">Manual Controls</div>

                        {/* Artificial Horizon */}
                        <div
                            className="relative w-full aspect-[2/1] bg-black border border-blue-800 rounded-2xl overflow-hidden shadow-lg">

                            {/* Sky & Ground Layers */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div
                                    className="absolute w-[200%] left-[-50%] h-[600%] top-[-250%] transform"
                                    style={{
                                        transform: `rotate(${att.roll}rad) translateY(${att.pitch * 120}px)`,
                                    }}
                                >
                                    {/* Sky */}
                                    <div className="h-1/2 bg-blue-900/40 border-b border-blue-500"></div>
                                    {/* Ground */}
                                    <div className="h-1/2 bg-black/90"></div>
                                </div>
                            </div>

                            {/* Center Crosshair */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-8 h-0.5 bg-blue-400"/>
                                <div className="h-8 w-0.5 bg-blue-400 absolute"/>
                            </div>

                            {/* Compass Strip */}
                            <div
                                className="absolute bottom-0 w-full overflow-hidden bg-black/80 border-t border-blue-800 h-6">

                                <div
                                    className={`absolute flex text-blue-300 font-mono text-xs tracking-widest whitespace-nowrap ${
                                        smooth ? 'transition-transform duration-200' : ''
                                    }`}
                                    style={{
                                        transform: `translateX(${-yawDeg * pxPerDeg + centerOffset}px)`
                                    }}
                                >
                                    {ticks}
                                </div>
                            </div>

                        </div>

                        {/* Joystick Visualizers */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Throttle/Rudder */}
                            <div
                                className="relative aspect-square border border-blue-800 rounded-xl bg-zinc-950 flex items-center justify-center">
                                <div className="absolute inset-0 border border-dashed border-blue-700 rounded-xl"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-blue-800"/>
                                    <div className="h-full w-0.5 bg-blue-800 absolute"/>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div
                                        className="w-2 h-2 bg-blue-400 rounded-full"
                                        style={{
                                            transform: `translate(${rc.chan1_raw * 40}px, ${-rc.chan2_raw * 40}px)`,
                                        }}
                                    />
                                </div>
                                <div className="absolute bottom-1 left-1 text-blue-500 text-[10px]">Throttle/Rudder
                                </div>
                            </div>

                            {/* Pitch/Roll */}
                            <div
                                className="relative aspect-square border border-blue-800 rounded-xl bg-zinc-950 flex items-center justify-center">
                                <div className="absolute inset-0 border border-dashed border-blue-700 rounded-xl"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-blue-800"/>
                                    <div className="h-full w-0.5 bg-blue-800 absolute"/>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div
                                        className="w-2 h-2 bg-blue-400 rounded-full"
                                        style={{
                                            transform: `translate(${rc.chan3_raw * 40}px, ${-rc.chan4_raw * 40}px)`,
                                        }}
                                    />
                                </div>
                                <div className="absolute bottom-1 left-1 text-blue-500 text-[10px]">Pitch/Roll</div>
                            </div>
                        </div>
                    </div>

                    {/* Emergency Actions */}
                    <div className="space-y-1">
                        <div className="text-blue-500">Emergency Actions</div>
                        <div className="italic text-zinc-500">[Placeholder for RTL, LAND, DISARM buttons]</div>
                    </div>
                </div>

                {/* Map View */}
                <div
                    className="col-start-2 flex flex-col h-full min-h-0 relative bg-black items-center justify-center text-xl tracking-widest">
                    <div ref={mapRef} className="absolute inset-0"/>
                    {!tilesetEnabled && (
                        <div className="absolute bottom-4 right-4 z-10">
                            <HoldToConfirmButton onConfirm={enableTileset} variant="outline">
                                Enable True 3D Map
                            </HoldToConfirmButton>
                        </div>
                    )}
                    {viewer && trackedEntity && (
                        <div className="absolute bottom-20 right-4 z-10">
                            <Button onClick={toggleTracking} variant="default">
                                {isTracking ? "Free Cam" : "Follow Plane"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right Panel */}
                <div
                    className="col-start-3 flex flex-col h-full min-h-0 border-l border-blue-800 bg-zinc-900 p-2 text-sm font-bold tracking-wide overflow-y-auto">
                    <div className="mb-2">TELEMETRY + MISSION STATUS</div>
                    <div className="mb-1">ALTITUDE (m)</div>
                    <Sparkline data={altHistory} width={400} height={40} highlightMinMax={true}/>
                </div>

                {showLeaveModal && (
                    <NavigationConfirmModal
                        onConfirm={() => {
                            setShowLeaveModal(false);
                            navigate("/manual");
                        }}
                        onCancel={() => {
                            setShowLeaveModal(false);
                            ref.current?.requestFullscreen().catch(err => console.error(err));
                        }}
                    />
                )}

            </div>
            <BottomBar/>
        </div>
    );
}



