import {Card, CardHeader, CardTitle, CardContent} from '@/components/ui/card';
import PageContainer from '@/components/ui/PageContainer';
import {useTelemetry} from '@/lib/TelemetryContext';
import {MapContainer, TileLayer, Marker} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const uavPosition = [34.029758,-117.7929415]; // TODO: change to actual waypoints

export function Dashboard() {
  const {gps, battery, mode, armed, logs} = useTelemetry();

  const filteredLogs = logs.filter(
    (log) =>
      ['major', 'critical'].includes(log.importance) ||
      ['warning', 'error'].includes(log.severity)
  );

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'warning':
        return 'text-orange-400';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-white';
    }
  };

  return (
    <PageContainer>
  <div className="w-full h-full overflow-y-hidden bg-zinc-950 text-zinc-200 font-mono !px-8 !py-8">
    <h1 className="text-4xl font-bold mb-8 text-white">Dashboard</h1>

    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">
      {/* Left Column (Info Cards + Logs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* GPS */}
        <Card className="bg-zinc-900 shadow-lg h-full">
          <CardHeader className="!p-6">
            <CardTitle>🛰️ GPS</CardTitle>
          </CardHeader>
          <CardContent className="!px-6 space-y-2 text-base">
            <p>Lat/Lon: <span className="font-mono">{gps.lat}, {gps.lon}</span></p>
            <p>Sats: {gps.sats}</p>
            <p>HDOP: {gps.hdop}</p>
          </CardContent>
        </Card>

        {/* Basic Flight Data */}
        <Card className="bg-zinc-900 shadow-lg h-full">
          <CardHeader className="!p-6">
            <CardTitle>📈 Basic Flight Data</CardTitle>
          </CardHeader>
          <CardContent className="!px-6 !space-y-2 text-base">
            <p>Altitude: -- m</p>
            <p>Airspeed: -- m/s</p>
            <p>Pitch: --°</p>
            <p>Roll: --°</p>
          </CardContent>
        </Card>

        {/* Flight Status */}
        <Card className="bg-zinc-900 shadow-lg h-full">
          <CardHeader className="!p-6">
            <CardTitle>🧭 Flight Status</CardTitle>
          </CardHeader>
          <CardContent className="!px-6 space-y-2 text-base">
            <p>Mode: <span className="text-white font-medium">{mode}</span></p>
            <p>Status: <span className={`font-bold ${armed ? 'text-green-400' : 'text-red-400'}`}>{armed ? 'ARMED' : 'DISARMED'}</span></p>
          </CardContent>
        </Card>

        {/* Battery */}
        <Card className="bg-zinc-900 shadow-lg h-full">
          <CardHeader className="!p-6">
            <CardTitle>⚡ Battery</CardTitle>
          </CardHeader>
          <CardContent className="!px-6 !space-y-2 text-base">
            <p>Voltage: {battery.voltage} V</p>
            <p>Current: {battery.current} A</p>
            <p>Charge: {battery.percent}%</p>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card className="bg-zinc-900 shadow-lg col-span-2 flex flex-col h-full">
          <CardHeader className="!p-6">
            <CardTitle>🧾 Condensed Logs</CardTitle>
          </CardHeader>
          <CardContent className="!px-0">
            <div className="scrollbar-dark !px-6 !space-y-1 text-sm text-zinc-300 overflow-y-auto max-h-40">
              {filteredLogs.length === 0 ? (
                <p className="italic text-zinc-500">No relevant logs</p>
              ) : (
                filteredLogs.slice(0, 20).map((log, idx) => (
                  <p
                    key={idx}
                    className={
                      `${log.importance === 'critical' ? 'font-bold my-2' :
                        log.importance === 'major' ? 'font-bold' : ''}`
                    }
                  >
                    [{log.timestamp}]{" "}
                    <span className={`${severityColor(log.severity)} inline-block w-[80px]`}>
                      {log.severity.toUpperCase()}
                    </span>: {log.message}
                  </p>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column (Mini Map) */}
      <Card className="bg-zinc-900 shadow-lg h-full">
        <CardHeader className="!p-6">
          <CardTitle>🗺️ Mini Map</CardTitle>
        </CardHeader>
        <CardContent className="!p-6 !h-[550px]">
          <MapContainer
            center={uavPosition}
            zoom={15}
            style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            />
            <Marker
              position={uavPosition}
              icon={L.icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
              })}
            />
          </MapContainer>
        </CardContent>
      </Card>
    </div>
  </div>
</PageContainer>

  );
}
