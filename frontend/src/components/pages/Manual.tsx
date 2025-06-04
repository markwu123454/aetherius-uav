import { useCesiumContext, useCesiumBindTo } from "@/lib/CesiumMapProvider";
import { useEffect, useRef } from "react";
import { Cartesian3, Color } from "cesium";
import PageContainer from "@/components/ui/PageContainer";

export default function Manual() {
  const { viewer, isReady } = useCesiumContext();
  const bindTo = useCesiumBindTo();
  const containerRef = useRef<HTMLDivElement>(null);

  // Bind Cesium viewer to this panel
  useEffect(() => {
    bindTo(containerRef.current);
    return () => bindTo(null);
  }, [bindTo]);

  // Initialize Cesium scene
  useEffect(() => {
    if (!isReady || !viewer || !viewer.scene || !viewer.entities) {
      console.warn("Cesium viewer not fully initialized yet.");
      return;
    }

    try {
      // Clear existing content
      viewer.scene.primitives.removeAll();
      viewer.entities.removeAll();

      // Add a marker
      const entity = viewer.entities.add({
        name: "Manual Marker",
        position: Cartesian3.fromDegrees(-122.4175, 37.655, 150),
        point: {
          pixelSize: 12,
          color: Color.ORANGE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
        },
      });

      // Move camera to marker
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(-122.4175, 37.655, 300),
      });

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
        <div className="flex-1 bg-black relative">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="absolute top-4 right-4 bg-white p-2 shadow rounded">
            Overlay on Cesium
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
    