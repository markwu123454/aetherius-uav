import {useCesiumContext, useCesiumBindTo} from "@/lib/CesiumMapProvider";
import {useTelemetry} from "@/lib/TelemetryContext";
import {useEffect, useRef, useState} from "react";
import {Cartesian3, Color} from "cesium";
import PageContainer from "@/components/ui/PageContainer";
import type {ProcessedMission} from "@/types";
import {Card} from "@/components/ui/card"

export default function Manual() {
    const {viewer, isReady} = useCesiumContext();
    const bindTo = useCesiumBindTo();
    const {fetchProcessedMission} = useTelemetry();

    const containerRef = useRef<HTMLDivElement>(null);
    const [mission, setMission] = useState<ProcessedMission | null>(null);
    const [pathPlotted, setPathPlotted] = useState(false);

    // Bind Cesium viewer to this panel
    useEffect(() => {
        bindTo(containerRef.current);
        return () => bindTo(null);
    }, [bindTo]);

    // Fetch mission data
    useEffect(() => {
        fetchProcessedMission().then(setMission).catch(console.error);
    }, [fetchProcessedMission]);

    // Initialize Cesium scene
    useEffect(() => {
        console.warn("[Cesium] viewer loading", {
            isReady,
            viewer: !!viewer,
            viewerScene: !!viewer?.scene,
            viewerEntities: !!viewer?.entities,
            flightPath: !!mission?.flight_path,
        });
        if (!isReady || !viewer || !viewer.scene || !viewer.entities || !mission?.flight_path || pathPlotted) {
            return;
        }


        try {
            // Clear existing content
            viewer.scene.primitives.removeAll();
            viewer.entities.removeAll();

            const points = mission.flight_path.map(({lon, lat, alt}) =>
                Cartesian3.fromDegrees(lon, lat, alt)
            );

            // Add flight path polyline
            const entity = viewer.entities.add({
                name: "Flight Path",
                polyline: {
                    positions: points,
                    width: 4,
                    material: Color.CYAN,
                },
            });

            // Move camera to first waypoint
            viewer.camera.flyTo({
                destination: points[0],
            });

            setPathPlotted(true);

            return () => {
                viewer.entities.remove(entity);
            };
        } catch (err) {
            console.error("Cesium error during setup:", err);
        }
    }, [viewer, isReady]);

    return (
        <PageContainer>
            <div className="flex h-full w-full">
                {/* Left panel */}
                <div className="w-[50%] overflow-y-auto bg-zinc-100 text-zinc-950 p-4">
                    <h2 className="text-xl font-semibold">Manual Controls</h2>
                    <p>Configure mission steps and direct UAV manually here.</p>
                </div>

                {/* Right panel (map mount target) */}
                <div className="flex-1 bg-black">
                    <Card className="relative h-full w-full">
                        <div ref={containerRef} className="absolute inset-0"/>
                        <div className="absolute top-4 right-4 bg-white p-2 shadow rounded">
                            Overlay on Cesium
                        </div>
                    </Card>
                </div>
            </div>
        </PageContainer>
    );
}
