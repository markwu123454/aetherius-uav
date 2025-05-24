// Mission.tsx
import PageContainer from "@/components/ui/PageContainer";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function MissionPlanner() {
  return (
    <PageContainer>
      <div className="w-full h-[calc(100vh-90px-24px)] bg-zinc-950 text-zinc-200 font-mono p-6">
        <h1 className="text-3xl font-bold mb-4 text-white">Mission Planner</h1>

        <div className="w-full h-full rounded-lg overflow-hidden border border-zinc-700">
          <MapContainer
            center={[37.7749, -122.4194]} // placeholder
            zoom={14}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {/* TODO: Add waypoint markers, path lines, click-to-add support */}
          </MapContainer>
        </div>
      </div>
    </PageContainer>
  );
}
