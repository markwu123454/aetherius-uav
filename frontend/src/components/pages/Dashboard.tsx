import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageContainer from "@/components/ui/PageContainer";
import { useTelemetry } from "@/lib/TelemetryContext";

export default function Dashboard() {
  const { gps, battery, mode, armed } = useTelemetry();

  return (
    <PageContainer>
      <div className="bg-zinc-950 w-full min-h-screen text-zinc-200 font-mono !px-8 !py-8 overflow-hidden">
        <h1 className="text-4xl font-bold !mb-8 text-white">Dashboard</h1>

        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 !gap-6 !mb-8">
          <Card className="bg-zinc-900 shadow-lg">
            <CardHeader className="!p-6">
              <CardTitle>🛰️ GPS</CardTitle>
            </CardHeader>
            <CardContent className="!p-6 !space-y-2 text-base">
              <p>Lat/Lon: <span className="font-mono">{gps.lat}, {gps.lon}</span></p>
              <p>Sats: {gps.sats}</p>
              <p>HDOP: {gps.hdop}</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 shadow-lg">
            <CardHeader className="!p-6">
              <CardTitle>⚡ Battery</CardTitle>
            </CardHeader>
            <CardContent className="!p-6 !space-y-2 text-base">
              <p>Voltage: {battery.voltage} V</p>
              <p>Current: {battery.current} A</p>
              <p>Charge: {battery.percent}%</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 shadow-lg">
            <CardHeader className="!p-6">
              <CardTitle>🗺️ Mini Map</CardTitle>
            </CardHeader>
            <CardContent className="!p-6">
              <p className="italic text-sm text-zinc-400">[TODO: Add live map widget]</p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 !gap-6">
          <Card className="bg-zinc-900 shadow-lg">
            <CardHeader className="!p-6">
              <CardTitle>✅ Flight Mode</CardTitle>
            </CardHeader>
            <CardContent className="!p-6">
              <p className="text-lg">{mode}</p>
            </CardContent>
          </Card>

          <Card className={`bg-zinc-900 shadow-lg ${armed ? "border-green-500" : "border-red-500"}`}>
            <CardHeader className="!p-6">
              <CardTitle>⛔ Armed Status</CardTitle>
            </CardHeader>
            <CardContent className="!p-6">
              <p className={`font-bold text-lg ${armed ? "text-green-400" : "text-red-400"}`}>
                {armed ? "ARMED" : "DISARMED"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
