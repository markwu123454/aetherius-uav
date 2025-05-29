// Mission.tsx
import PageContainer from "@/components/ui/PageContainer";
import {MapContainer, TileLayer, Marker, Polyline, useMapEvents} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {useState, useRef} from "react";
import {Card, CardHeader, CardTitle, CardContent} from "@/components/ui/card";
import {DndContext, closestCenter} from '@dnd-kit/core';
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {useEffect} from "react";
import {useTelemetry, flushDeferredTelemetry, pause_ws} from "@/lib/TelemetryContext";
import type {Waypoint, Mission} from "@/types";

import {Input} from "@/components/ui/input";


function useWaypoints() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [nextId, setNextId] = useState(1);

  const addWaypoint = (lat: number, lon: number) => {
    setWaypoints(prev => [
      ...prev,
      {id: nextId, lat, lon, alt: 100, type: "Navigate"},
    ]);
    setNextId(id => id + 1);
  };

  const updateWaypoint = (id: number, updates: Partial<Waypoint>) => {
    setWaypoints(prev => prev.map(wp => wp.id === id ? {...wp, ...updates} : wp));
  };

  const reorderWaypoints = (oldIndex: number, newIndex: number) => {
    setWaypoints(prev => arrayMove(prev, oldIndex, newIndex));
  };

  // Removes a single waypoint by ID
  const removeWaypoint = (id: number) => {
    setWaypoints(prev => prev.filter(wp => wp.id !== id));
  };

// Clears all waypoints and resets IDs
  const clearWaypoints = () => {
    setWaypoints([]);
    setNextId(1);
  };

  const setWaypointsDirect = (wps: Waypoint[]) => {
    setWaypoints(wps);
    const nextAvailableId = wps.reduce((max, wp) => Math.max(max, wp.id), 0) + 1;
    setNextId(nextAvailableId);
  };


  return {
    waypoints,
    addWaypoint,
    updateWaypoint,
    reorderWaypoints,
    removeWaypoint,
    clearWaypoints,
    setWaypointsDirect,
  };
}

function ClickHandler({onMapClick, ignoreClick}: {
  onMapClick: (lat: number, lon: number) => void;
  ignoreClick: React.MutableRefObject<boolean>
}) {
  useMapEvents({
    click(e) {
      if (!ignoreClick.current) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Updated to use a separate drag handle so clicks on the item don't trigger drag
function SortableWaypoint({wp, selectedId, setSelectedId}: any) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id: wp.id});
  const style = {transform: CSS.Transform.toString(transform), transition};

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center text-sm !p-1 cursor-pointer rounded ${selectedId === wp.id ? 'bg-zinc-700' : 'hover:bg-zinc-800'}`}
      onClick={() => setSelectedId(wp.id)}
    >
      <span {...attributes} {...listeners} className="mr-2 cursor-move select-none">
        ☰
      </span>
      <div>
        <strong>{wp.name || `WP ${wp.id}`}</strong>: {wp.lat.toFixed(5)}, {wp.lon.toFixed(5)} ({wp.alt}m)
      </div>
    </li>
  );
}

function DynamicTileLayer({satellite}: { satellite: boolean }) {
  const tileUrl = satellite
    ? "https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";

  return <TileLayer url={tileUrl} subdomains={satellite ? [] : ["a", "b", "c"]} maxNativeZoom={22} maxZoom={22}/>;
}

export function MissionPlanner() {
  const {
    waypoints,
    addWaypoint,
    updateWaypoint,
    reorderWaypoints,
    removeWaypoint,
    clearWaypoints,
    setWaypointsDirect,
  } = useWaypoints();

  const uavPosition: [number, number] = [34.029758, -117.7929415];
  const ignoreClick = useRef(false);
  const [satelliteView, setSatelliteView] = useState(false);

  const [cruiseSpeed, setCruiseSpeed] = useState(5);
  const [loiterRadius, setLoiterRadius] = useState(15);
  const [takeoffAltitude, setTakeoffAltitude] = useState(250);
  const [landingDescentRate, setLandingDescentRate] = useState(0.5);
  const [loopMission, setLoopMission] = useState(false);
  const [returnToLaunch, setReturnToLaunch] = useState(true);
  const [abortAltitude, setAbortAltitude] = useState(5);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [processedMission, setProcessedMission] = useState<null | {
    total_distance_km: number;
    estimated_time_min: number;
    errors: string[];
    flight_path?: { lat: number; lon: number; alt: number }[];
  }>(null);

  const {sendMission, fetchProcessedMission, autosaveMission, fetchAutosaveMission} = useTelemetry();

  const [autosaveReady, setAutosaveReady] = useState(false);

  useEffect(() => {
    if (!autosaveReady) return;
    console.log("[Autosave] Starting autosave")
    const mission: Mission = {
      waypoints,
      cruise_speed: cruiseSpeed,
      loiter_radius: loiterRadius,
      takeoff_alt: takeoffAltitude,
      landing_descent_rate: landingDescentRate,
      abort_alt: abortAltitude,
      rtl: returnToLaunch,
      repeat: loopMission,
    };

    const updateMission = async () => {
      await autosaveMission(mission);   // ✅ Will now only run after load
      await sendMission(mission);
      const result = await fetchProcessedMission();
      if (result) setProcessedMission(result);
    };

    updateMission();
  }, [
    autosaveReady,  // ✅ new dependency
    waypoints,
    cruiseSpeed,
    loiterRadius,
    takeoffAltitude,
    landingDescentRate,
    abortAltitude,
    returnToLaunch,
    loopMission
  ]);


  useEffect(() => {
    const loadAutosave = async () => {
      console.log("[Autosave] Grabbing autosave")
      const autosaved = await fetchAutosaveMission();
      if (autosaved) {
        setCruiseSpeed(autosaved.cruise_speed);
        setLoiterRadius(autosaved.loiter_radius);
        setTakeoffAltitude(autosaved.takeoff_alt);
        setLandingDescentRate(autosaved.landing_descent_rate);
        setAbortAltitude(autosaved.abort_alt);
        setReturnToLaunch(autosaved.rtl);
        setLoopMission(autosaved.repeat);
        setWaypointsDirect(autosaved.waypoints);
      }
      setAutosaveReady(true); // ✅ Unblocks saving
    };
    loadAutosave();
  }, []);


  // Builds a Leaflet divIcon showing an arrow + the WP’s name
  const makeWpIcon = (wp: Waypoint, idx: number) => {
    let label = wp.name?.trim();
    if (!label) {
      if (idx === 0) {
        label = 'Takeoff';
      } else if (idx === waypoints.length - 1) {
        label = 'Landing';
      } else {
        label = `WP ${wp.id}`;
      }
    }

    const arrow = idx === 0
      ? '⬆'
      : idx === waypoints.length - 1
        ? '⬇'
        : '➡';

    // width = ~8px per character + 20px padding
    const width = label.length * 6.625 + 25;
    const height = 24;

    return L.divIcon({
      className: 'bg-zinc-800 rounded shadow',
      html: `
      <div
        style="
          display: inline-block;
          font-family: monospace;
          font-size: 12px;
          color: white;
          padding: 2px 6px;
          white-space: nowrap;
        "
      >
        ${arrow}&nbsp;${label}
      </div>
    `,
      iconSize: [width, height],
      iconAnchor: [width / 2, height],
    });
  };


  const selected = waypoints.find(wp => wp.id === selectedId) || null;

  return (
    <PageContainer>
      <div className="w-full h-full bg-zinc-950 text-zinc-200 font-mono !p-6">
        <h1 className="text-3xl font-bold mb-4 text-white">Mission Planner</h1>
        <div className="w-full h-[calc(100%-20px)] flex gap-4">

          {/* Left sidebar */}
          <div className="w-[20%] h-[calc(100%-16px)] flex flex-col gap-4">
            <Card className="bg-zinc-900 h-[33%] flex flex-col !p-0">
              <div className="!p-4 pb-0">
                <CardHeader className="!p-0">
                  <CardTitle>Waypoints</CardTitle>
                </CardHeader>
              </div>
              <CardContent className="overflow-auto scrollbar-dark flex-1 !px-4 !pb-4">
                <DndContext
                  collisionDetection={closestCenter}
                  onDragEnd={({active, over}) => {
                    if (over && active.id !== over.id) {
                      const oldIndex = waypoints.findIndex(w => w.id === active.id);
                      const newIndex = waypoints.findIndex(w => w.id === over.id);
                      reorderWaypoints(oldIndex, newIndex);
                    }
                  }}
                >
                  <SortableContext items={waypoints.map(w => w.id)} strategy={verticalListSortingStrategy}>
                    <ul className="!space-y-1">
                      {waypoints.map((wp, i) => (
                        <SortableWaypoint
                          key={wp.id}
                          wp={wp}
                          index={i}
                          selectedId={selectedId}
                          setSelectedId={setSelectedId}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>


            <Card className="bg-zinc-900 h-[67%] flex flex-col !p-0">
              <div className="!p-4 pb-0">
                <CardHeader className="!p-0">
                  <CardTitle>Edit Waypoint</CardTitle>
                </CardHeader>
              </div>
              <CardContent className="overflow-y-auto flex-grow scrollbar-dark !px-4 !pb-4 !space-y-2 text-sm">
                {selected ? (
                  <>
                    <label className="block !mt-4">Name</label>
                    <Input
                      value={selected.name || ""}
                      onChange={e => updateWaypoint(selected.id, {name: e.target.value})}
                    />
                    <label className="block !mt-4">Latitude</label>
                    <Input
                      type="number"
                      value={selected.lat}
                      onChange={e => updateWaypoint(selected.id, {lat: parseFloat(e.target.value)})}
                    />
                    <label className="block !mt-4">Longitude</label>
                    <Input
                      type="number"
                      value={selected.lon}
                      onChange={e => updateWaypoint(selected.id, {lon: parseFloat(e.target.value)})}
                    />
                    <label className="block !mt-4">Altitude (m)</label>
                    <Input
                      type="number"
                      value={selected.alt}
                      onChange={e => updateWaypoint(selected.id, {alt: parseFloat(e.target.value)})}
                    />
                    <label className="block !mt-4">Type</label>
                    <select
                      className="w-full bg-zinc-800 !p-1 rounded text-sm"
                      value={selected.type}
                      onChange={e =>
                        updateWaypoint(selected.id, {type: e.target.value as Waypoint["type"]})
                      }
                    >
                      <option value="Navigate">Navigate</option>
                      <option value="Loiter">Loiter</option>
                      <option value="RTL">RTL</option>
                    </select>
                    <button
                      className="mt-2 w-full border-red-700 transition-colors hover:!text-red-500 text-white !py-1 rounded"
                      onClick={() => removeWaypoint(selected.id!)}
                    >
                      Delete Waypoint
                    </button>
                  </>
                ) : (
                  <p className="text-zinc-500">Select a waypoint to edit</p>
                )}
              </CardContent>
            </Card>


          </div>

          {/* Map view */}
          <div className="relative flex-grow h-full rounded-lg overflow-hidden border border-zinc-700">
            <MapContainer center={uavPosition} zoom={17} maxZoom={22}
                          style={{height: '100%', width: '100%', borderRadius: '0.5rem'}}>
              <DynamicTileLayer satellite={satelliteView}/>
              <ClickHandler onMapClick={addWaypoint} ignoreClick={ignoreClick}/>
              {waypoints.map((wp, i) => (
                <Marker
                  key={wp.id}
                  position={[wp.lat, wp.lon]}
                  draggable
                  eventHandlers={{
                    dragstart: () => {
                      pause_ws.mission = true;
                      ignoreClick.current = true;
                    },
                    dragend: e => {
                      const {lat, lng} = e.target.getLatLng();
                      updateWaypoint(wp.id, {lat, lon: lng});
                      setTimeout(() => {
                        ignoreClick.current = false;
                        pause_ws.mission = false;
                        flushDeferredTelemetry();
                      }, 0);
                    }
                  }}
                  icon={makeWpIcon(wp, i)}
                />
              ))}
              <Polyline positions={waypoints.map(wp => [wp.lat, wp.lon]) as [number, number][]} color="lime"/>
              {processedMission?.flight_path && (
                <Polyline
                  positions={processedMission.flight_path.map(p => [p.lat, p.lon] as [number, number])}
                  pathOptions={{color: "blue", weight: 3, dashArray: "6 8"}}
                />
              )}

            </MapContainer>

            <button
              onClick={() => setSatelliteView(prev => !prev)}
              className="absolute bottom-4 right-4 z-[1000] !bg-zinc-800/50 text-white px-4 py-2 rounded shadow !hover:bg-zinc-700 !p-1 backdrop-blur-sm"
            >
              {satelliteView ? "Switch to Map" : "Switch to Satellite"}
            </button>
          </div>

          {/* Right panel */}
          <div className="w-[20%] min-w-[200px] !space-y-4 !overflow-y-auto scrollbar-dark">
            <Card>
              <CardContent>
                <p>Total Waypoints: {waypoints.length}</p>
                <p>Estimated Distance: {processedMission ? `${processedMission.total_distance_km} km` : "—"}</p>
                <p>Estimated Time: {processedMission ? `${processedMission.estimated_time_min} min` : "—"}</p>
                {processedMission?.errors && processedMission.errors.length > 0 && (
                  <div className="text-red-400">
                    <p className="font-bold">Errors:</p>
                    <ul className="list-disc ml-5">
                      {processedMission.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </CardContent>
            </Card>


            <Card className='bg-zinc-900 !p-4 !space-y-4'>
              <CardHeader>
                <CardTitle>Flight Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <label className="block !mt-4">Cruise Speed (m/s)</label>
                <Input type="number" value={cruiseSpeed}
                       onChange={(e) => setCruiseSpeed(Number(e.target.value))}/>
                <label className="block !mt-4">Loiter Radius (m)</label>
                <Input type="number" value={loiterRadius}
                       onChange={(e) => setLoiterRadius(Number(e.target.value))}/>
                <label className="block !mt-4">Takeoff Altitude (m)</label>
                <Input type="number" value={takeoffAltitude}
                       onChange={(e) => setTakeoffAltitude(Number(e.target.value))}/>
                <label className="block !mt-4">Landing Descent Rate (m/s)</label>
                <Input type="number" value={landingDescentRate}
                       onChange={(e) => setLandingDescentRate(Number(e.target.value))}/>
              </CardContent>
            </Card>

            <Card className='bg-zinc-900 !p-4 !space-y-4'>
              <CardHeader>
                <CardTitle>Mission Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <label>Loop Mission</label>
                  <input type="checkbox" className="accent-zinc-500" checked={loopMission}
                         onChange={(e) => setLoopMission(e.target.checked)}/>
                </div>
                <div className="flex items-center justify-between">
                  <label>Return to Launch</label>
                  <input type="checkbox" className="accent-zinc-500" checked={returnToLaunch}
                         onChange={(e) => setReturnToLaunch(e.target.checked)}/>
                </div>
                <label className="block">Abort Altitude (m)</label>
                <Input type="number" value={abortAltitude}
                       onChange={(e) => setAbortAltitude(Number(e.target.value))}/>
              </CardContent>
            </Card>

            <Card className='bg-zinc-900 !p-4 !space-y-4'>
              <CardHeader>
                <CardTitle>Mission Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-1 rounded">Save Mission</button>
                <button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-1 rounded">Load Mission</button>
                <button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-1 rounded">Export to File</button>
                <button className="w-full bg-red-700 hover:bg-red-600 text-white py-1 rounded"
                        onClick={() => clearWaypoints()}>Clear Waypoints
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

