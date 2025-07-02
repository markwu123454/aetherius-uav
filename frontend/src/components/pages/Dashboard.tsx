// src/components/Dashboard.tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import PageContainer from '@/components/ui/PageContainer';
import { useRealTime } from '@/lib/RealTimeContext';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const uavPosition = [34.029758, -117.7929415];

export function Dashboard() {
  const { state } = useRealTime();
  const { telemetry, liveLogs: logs } = state;

  const { GPS_RAW_INT, GLOBAL_POSITION_INT, BATTERY_STATUS, HEARTBEAT } = telemetry;

  // Derive GPS display
  const gps = {
    lat: GPS_RAW_INT ? GPS_RAW_INT.lat / 1e7 : '—',
    lon: GPS_RAW_INT ? GPS_RAW_INT.lon / 1e7 : '—',
    sats: GPS_RAW_INT ? GPS_RAW_INT.satellites_visible : '—',
    hdop: GPS_RAW_INT ? GPS_RAW_INT.eph : '—'
  };

  // Derive battery display
  const battery = {
    voltage: BATTERY_STATUS && BATTERY_STATUS.voltages?.length
      ? BATTERY_STATUS.voltages[0] / 1000
      : 0,
    current: BATTERY_STATUS
      ? BATTERY_STATUS.current_battery / 100
      : 0,
    percent: BATTERY_STATUS
      ? BATTERY_STATUS.battery_remaining
      : '—'
  };

  // Armed flag from base_mode bit 7
  const armed = HEARTBEAT
    ? Boolean(HEARTBEAT.base_mode & 0x80)
    : false;

  // Mode from custom_mode
  const mode = HEARTBEAT
    ? `0x${HEARTBEAT.custom_mode.toString(16)}`
    : '—';

  // Format timestamp (ns) to HH:MM:SS.mmm
  const formatTime = (ns: number) => {
    const date = new Date(ns / 1e6);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const mmm = String(date.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${mmm}`;
  };
  /*
  // Build human-readable log message
  const formatLog = (
    timestamp: number,
    log_id: string,
    variables?: Record<string, any>
  ): string => {
    const template = logsTemplate[log_id] || '';
    const filled = template.replace(/\{(\w+)\}/g, (_, key) => {
      const val = variables?.[key];
      return val !== undefined ? String(val) : '';
    });
    const timeStr = formatTime(timestamp);
    const cat = categoryNames[log_id.slice(0, 2)] || log_id.slice(0, 2);
    return `${timeStr}:${log_id} [${cat}] ${filled}`;
  };

  // Determine CSS classes based on severity & importance in log_id
  const logClasses = (log_id: string) => {
    const sev = log_id.charAt(2);
    const imp = log_id.charAt(3);
    let colorClass = 'text-gray-400';
    if (sev === '1') colorClass = 'text-yellow-400';
    else if (sev === '2') colorClass = 'text-red-500';
    else if (sev === '3') colorClass = 'text-blue-400';
    else if (sev === '0') {
      colorClass = imp === '2' ? 'text-white' : 'text-gray-400';
    }
    const boldClass = imp === '2' ? 'font-bold' : imp === '1' && sev === '0' ? 'font-bold' : '';
    return `${colorClass} ${boldClass}`.trim();
  };
  */
  return (
    <PageContainer>
      <div className="w-full h-full overflow-y-hidden bg-zinc-950 text-zinc-200 font-mono !px-8 !py-8">
        <h1 className="text-4xl font-bold mb-8 text-white">Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8">
          {/* Left Column */}
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
                <CardTitle>🧾 Logs</CardTitle>
              </CardHeader>
              <CardContent className="!px-0">

                {/* copy back in */}

              </CardContent>
            </Card>
          </div>

          {/* Mini Map */}
          <Card className="bg-zinc-900 shadow-lg h-full">
            <CardHeader className="!p-6">
              <CardTitle>🗺️ Mini Map</CardTitle>
            </CardHeader>
            <CardContent className="!px-6 !h-[550px]">
              <MapContainer center={uavPosition} zoom={15} style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
                <Marker position={uavPosition} icon={L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] })} />
              </MapContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}


/*

<div className="scrollbar-dark !px-6 text-sm overflow-y-auto max-h-40">
                  {logs.length === 0 ? (
                    <p className="italic text-zinc-500">No logs</p>
                  ) : (
                    logs.slice(0, 20).map((log, idx) => (
                      <p key={idx} className={logClasses(log.log_id)}>
                        {formatLog(log.timestamp as unknown as number, log.log_id, log.variables)}
                      </p>
                    ))
                  )}
                </div>
 */