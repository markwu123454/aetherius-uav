import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useRealTime} from "@/lib/RealTimeContext.tsx";
import * as Cesium from "cesium";
import {Sparkline, useSparkline} from "@/components/ui/Sparkline";
import {TopBar} from "@/components/MissionToppanel";
import {BottomBar} from "@/components/MissionBottompanel"
import {Button} from "@/components/ui/button";
import HoldToConfirmButton from "@/components/ui/HoldToConfirmButton"
import {arcgisToGeoJSON} from "arcgis-to-geojson-utils";

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

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
                    <HoldToConfirmButton onConfirm={onConfirm} variant="destructive" duration={3000}>
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

    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [viewer, setViewer] = useState<Cesium.Viewer | null>(null);
    const [tilesetEnabled, setTilesetEnabled] = useState(false);
    const [trackedEntity, setTrackedEntity] = useState<Cesium.Entity | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    const {state} = useRealTime();

    const get = <K extends keyof typeof state.telemetry>(k: K) =>
        (state.telemetry[k] as typeof state.telemetry[K] | undefined) ??
        new Proxy({}, {
            get: (_, p) => (typeof p === "string" && p.endsWith("s") ? [] : null)
        }) as typeof state.telemetry[K];

    const gps = get("GLOBAL_POSITION_INT");
    const att = get("ATTITUDE");
    const rc = get("RC_CHANNELS");
    const bat = get("BATTERY_STATUS");
    const heartbeat = get("HEARTBEAT");
    const vfr = get("VFR_HUD");
    const gpsRaw = get("GPS_RAW_INT");
    const sysT = get("SYSTEM_TIME");
    const ekf = get("EKF_STATUS_REPORT");


    // Update altitude sparkline
    const altHistory = useSparkline(gps.relative_alt ?? 0, 240, 500);
    const batteryHistory = useSparkline(bat.battery_remaining ?? 0, 240, 2000);
    const speedHistory = useSparkline(vfr.airspeed ?? 0, 240, 500);

    const tickWidth = 37.5;
    const degPerTick = 10;
    const pxPerDeg = tickWidth / degPerTick;

    const minDeg = 0;
    const maxDeg = 540;

    const yawDeg = att.yaw * 180 / Math.PI;
    //const centerOffset = -((0 - minDeg) * pxPerDeg) - (381 / 2);
    const centerOffset = -503;

    const ticks = Array.from(
        {length: (maxDeg - minDeg) / degPerTick + 1},
        (_, i) => {
            const rawDeg = minDeg + i * degPerTick;

            // Normalize to [-180, 180]
            let deg = ((rawDeg + 180) % 360 + 360) % 360;

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

    // Cesium map
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
        viewerInstance.scene.globe.maximumScreenSpaceError = 4;
        viewerInstance.scene.skyAtmosphere.show = true;
        viewerInstance.scene.fog.enabled = false;
        viewerInstance.scene.globe.showGroundAtmosphere = false;
        viewerInstance.shadows = false;
        viewerInstance.targetFrameRate = 24;
        viewerInstance.useDefaultRenderLoop = true;
        viewerInstance.scene.skyBox.show = false;
        viewerInstance.scene.sun.show = false;
        viewerInstance.scene.moon.show = false;

        viewerInstance.scene.setTerrain(
            new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromIonAssetId(1))
        );

        // UAV entity
        const positionProp = new Cesium.SampledPositionProperty();
        const orientationProp = new Cesium.VelocityOrientationProperty(positionProp);

        const entity = viewerInstance.entities.add({
            position: positionProp,
            orientation: orientationProp,
            model: {
                uri: "/src/assets/low_poly_airplane.glb",
                scale: 0.02,
                minimumPixelSize: 128,
            },
            name: "UAV",
        });

        const colorMap = {
            CLASS_B: Cesium.Color.RED.withAlpha(0.25),
            CLASS_C: Cesium.Color.ORANGE.withAlpha(0.25),
            CLASS_D: Cesium.Color.YELLOW.withAlpha(0.2),
        };

        const airspaceSource = new Cesium.CustomDataSource("Airspace");

        fetch(
            "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query" +
            "?where=" + encodeURIComponent("(LOCAL_TYPE IN ('CLASS_B','CLASS_C','CLASS_D')) AND (LOWER_CODE = 'SFC')") +
            "&f=geojson" +
            "&returnGeometry=true" +
            "&geometryPrecision=3"
        )
            .then(res => res.json())
            .then(async geojson => {
                if (!geojson.features?.length) {
                    console.warn("No airspace features returned");
                    return;
                }

                console.log("Sample properties:", geojson.features[0].properties);

                const ds = await Cesium.GeoJsonDataSource.load(geojson, {
                    clampToGround: false,
                    stroke: Cesium.Color.WHITE.withAlpha(0.4),
                    fill: Cesium.Color.GRAY.withAlpha(0.05),
                    strokeWidth: 1,
                });

                ds.entities.values.forEach(e => {
                    const name = e.properties?.NAME?.getValue?.() ?? "UNKNOWN";
                    const upperName = name.toUpperCase();

                    // Infer class from the name text
                    let classType: "CLASS_B" | "CLASS_C" | "CLASS_D" | "OTHER" = "OTHER";
                    if (upperName.includes("CLASS B")) classType = "CLASS_B";
                    else if (upperName.includes("CLASS C")) classType = "CLASS_C";
                    else if (upperName.includes("CLASS D")) classType = "CLASS_D";

                    const colorMap = {
                        CLASS_B: Cesium.Color.RED.withAlpha(0.15),
                        CLASS_C: Cesium.Color.ORANGE.withAlpha(0.15),
                        CLASS_D: Cesium.Color.YELLOW.withAlpha(0.15),
                        OTHER: Cesium.Color.CYAN.withAlpha(0.2),
                    };

                    const color = colorMap[classType];

                    if (e.polygon) {
                        // Fixed approximate vertical dimensions by class
                        const lower = 0;
                        const upper =
                            classType === "CLASS_B"
                                ? 3000
                                : classType === "CLASS_C"
                                    ? 2000
                                    : classType === "CLASS_D"
                                        ? 1200
                                        : 1000;

                        e.polygon.material = new Cesium.ColorMaterialProperty(color);
                        e.polygon.outline = new Cesium.ConstantProperty(true);
                        e.polygon.outlineColor = new Cesium.ConstantProperty(
                            Cesium.Color.WHITE.withAlpha(0.5)
                        );
                        e.polygon.height = new Cesium.ConstantProperty(lower);
                        e.polygon.extrudedHeight = new Cesium.ConstantProperty(upper);
                    }
                });

                ds.entities.values.forEach(entity => airspaceSource.entities.add(entity));
                viewerInstance.dataSources.add(airspaceSource);

                viewerInstance.zoomTo(airspaceSource);
            });

        setTrackedEntity(entity);
        setViewer(viewerInstance);

        return () => viewerInstance.destroy();
    }, []);


    // Update model
    useEffect(() => {
        if (!viewer || !trackedEntity) return;

        const updatePosition = (lon: number, lat: number, alt: number, yaw = 0, pitch = 0, roll = 0) => {
            const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);
            trackedEntity.position = new Cesium.ConstantPositionProperty(position);

            const hpr = Cesium.HeadingPitchRoll.fromDegrees(yaw * 57.3, pitch * 57.3, roll * 57.3);
            const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);
            trackedEntity.orientation = new Cesium.ConstantProperty(orientation);
        };

        if (!att || !att.yaw || !att.pitch || !att.roll) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const {latitude, longitude} = pos.coords;

                    // Sample terrain height
                    const terrainProvider = viewer.terrainProvider;
                    const positions = [Cesium.Cartographic.fromDegrees(longitude, latitude)];
                    const updated = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
                    const terrainHeight = updated[0].height ?? 0;

                    updatePosition(longitude, latitude, terrainHeight, 4.5, 0, 0);
                },
                (err) => {
                    console.warn("Geolocation fallback failed:", err);
                }
            );
        } else {
            updatePosition(gps.lon / 1e7, gps.lat / 1e7, gps.alt / 1000, att.yaw, att.pitch, att.roll);
        }
    }, [gps, att, viewer, trackedEntity]);

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

    function pass(): boolean {
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
                            <HoldToConfirmButton onConfirm={pass} variant={"outline"}>
                                ARM
                            </HoldToConfirmButton>
                            <HoldToConfirmButton onConfirm={pass} variant={"destructive"}>
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
                                <HoldToConfirmButton onConfirm={pass} variant="destructive">
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
                        <HoldToConfirmButton onConfirm={pass} variant="destructive">
                            Abort Mission
                        </HoldToConfirmButton>
                        <HoldToConfirmButton onConfirm={pass} variant="destructive">
                            Return To Launch
                        </HoldToConfirmButton>
                        <HoldToConfirmButton onConfirm={pass} variant="destructive">
                            Hold Altitude
                        </HoldToConfirmButton>
                        <HoldToConfirmButton onConfirm={pass} variant="destructive">
                            Disarm
                        </HoldToConfirmButton>
                    </div>
                </div>

                {/* Map View */}
                <div
                    className="col-start-2 flex flex-col h-full min-h-0 relative bg-black items-center justify-center text-xl tracking-widest">
                    <div ref={mapRef} className="absolute inset-0"/>
                    {!tilesetEnabled && (
                        <div className="absolute bottom-20 right-4 z-10">
                            <HoldToConfirmButton onConfirm={enableTileset} variant="outline">
                                Enable True 3D Map
                            </HoldToConfirmButton>
                        </div>
                    )}
                    {viewer && trackedEntity && (
                        <div className="absolute bottom-4 right-4 z-10">
                            <Button onClick={toggleTracking} variant="outline">
                                {isTracking ? "Free Cam" : "Follow Plane"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right Panel */}
                <div
                    className="col-start-3 flex flex-col h-full min-h-0 border-l border-blue-800 bg-zinc-900 p-2 text-sm font-bold tracking-wide overflow-y-auto space-y-6">

                    {/* Header */}
                    <div className="text-blue-400 text-base">TELEMETRY</div>

                    {/* FLIGHT STATUS */}
                    <div className="space-y-1">
                        <div className="text-blue-300">FLIGHT STATUS</div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs font-mono">
                            <div>Altitude (m)</div>
                            <div className="text-right">
                                {typeof gps.relative_alt === "number" ? (gps.relative_alt / 1000).toFixed(1) + " m" : "-- m"}
                            </div>
                            <div>Ground Speed (m/s)</div>
                            <div className="text-right">
                                {vfr.groundspeed != null ? vfr.groundspeed.toFixed(1) + " m/s" : "-- m/s"}
                            </div>
                            <div>Airspeed (m/s)</div>
                            <div className="text-right">
                                {vfr.airspeed !== null ? vfr.airspeed.toFixed(1) + " m/s" : "-- m/s"}
                            </div>
                            <div>Climb Rate (m/s)</div>
                            <div className="text-right">
                                {vfr.climb !== null ? vfr.climb.toFixed(1) + " m/s" : "-- m/s"}
                            </div>
                            <div>Pitch / Roll / Yaw (°)</div>
                            <div className="text-right">
                                {att.pitch !== null && att.roll !== null && att.yaw !== null
                                    ? `${(att.pitch * 57.3).toFixed(1)}°/${(att.roll * 57.3).toFixed(1)}°/${(att.yaw * 57.3).toFixed(1)}°`
                                    : "--°/--°/--°"}
                            </div>
                        </div>
                    </div>

                    {/* NAVIGATION */}
                    <div className="space-y-1">
                        <div className="text-blue-300">NAVIGATION</div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs font-mono">
                            <div>Heading (°)</div>
                            <div className="text-right">
                                {vfr.heading !== null ? vfr.heading.toFixed(0) + "°" : "--°"}
                            </div>
                            <div>GPS Sats</div>
                            <div className="text-right">
                                {gpsRaw.satellites_visible !== null ? gpsRaw.satellites_visible : "--"}
                            </div>
                            <div>HDOP</div>
                            <div className="text-right">
                                {gpsRaw.eph !== null ? (gpsRaw.eph / 100).toFixed(2) : "--"}
                            </div>
                            <div>Fix Type</div>
                            <div className="text-right">
                                {gpsRaw.fix_type !== null ? gpsRaw.fix_type : "--"}
                            </div>
                        </div>
                    </div>

                    {/* POWER */}
                    <div className="space-y-1">
                        <div className="text-blue-300">POWER</div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs font-mono">
                            <div>Battery</div>
                            <div className="text-right">
                                {bat.voltages?.[0] !== null && bat.voltages?.[0] > 0
                                    ? `${(bat.voltages[0] / 1000).toFixed(2)}V (${bat.battery_remaining !== null ? bat.battery_remaining + "%" : "--%"})`
                                    : "-- V (--%)"}
                            </div>
                            <div>Current (A)</div>
                            <div className="text-right">
                                {bat.current_battery !== null ? (bat.current_battery / 100.0).toFixed(1) + " A" : "-- A"}
                            </div>
                            <div>Consumed (mAh)</div>
                            <div className="text-right">
                                {bat.current_consumed !== null ? bat.current_consumed : "--"}
                            </div>
                            <div>Charge State</div>
                            <div className="text-right">
                                {bat.charge_state !== null ? bat.charge_state : "--"}
                            </div>
                        </div>
                    </div>

                    {/* RADIO / LINK */}
                    <div className="space-y-1">
                        <div className="text-blue-300">RADIO / LINK</div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs font-mono">
                            <div>RC Signal</div>
                            <div className="text-right">-- dBm</div>
                            <div>RC Channels</div>
                            <div className="text-right">
                                {rc.chancount !== null ? rc.chancount : "--"}
                            </div>
                            <div>Link Quality</div>
                            <div className="text-right">-- %</div>
                            <div>Latency</div>
                            <div className="text-right">-- ms</div>
                        </div>
                    </div>

                    {/* SYSTEM STATUS */}
                    <div className="space-y-1">
                        <div className="text-blue-300">SYSTEM STATUS</div>
                        <div className="grid grid-cols-2 gap-x-2 text-xs font-mono">
                            <div>Mode</div>
                            <div className="text-right">
                                {heartbeat.custom_mode !== null ? heartbeat.custom_mode : "--"}
                            </div>
                            <div>ARM Status</div>
                            <div className="text-right">
                                {heartbeat.base_mode == null ? "DISCONNECTED" : (heartbeat.base_mode & 0b100 ? "ARMED" : "DISARMED")}
                            </div>
                            <div>EKF OK</div>
                            <div className="text-right">
                                {ekf.flags !== null ? (ekf.flags & 0b1 ? "YES" : "NO") : "--"}
                            </div>
                            <div>Uptime (s)</div>
                            <div className="text-right">
                                {sysT.time_unix_usec !== null ? Math.floor(sysT.time_unix_usec / 1e6) : "--"}
                            </div>
                        </div>
                    </div>

                    {/* GRAPHS */}
                    <div className="space-y-2">
                        <div>
                            <div className="text-blue-300 text-xs mb-1">ALTITUDE (m)</div>
                            <Sparkline data={altHistory} width={400} height={40} highlightMinMax={true}/>
                        </div>
                        <div>
                            <div className="text-blue-300 text-xs mb-1">SPEED (m/s)</div>
                            <Sparkline data={speedHistory} width={400} height={40}/>
                        </div>
                        <div>
                            <div className="text-blue-300 text-xs mb-1">BATTERY (%)</div>
                            <Sparkline data={batteryHistory} width={400} height={40}/>
                        </div>
                    </div>
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



