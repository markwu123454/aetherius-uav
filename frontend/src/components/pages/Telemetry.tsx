import {useEffect, useRef, useState} from "react";
import PageContainer from "@/components/ui/PageContainer";
import {useTelemetry} from "@/lib/TelemetryContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";

export default function Telemetry() {
  const {connected, telemetryBuffer, fetchLatestTelemetry} = useTelemetry();
  const [brushStart, setBrushStart] = useState(0);
  const [brushEnd, setBrushEnd] = useState(0);
  const prevLenRef = useRef(0);
  const [visibility] = useState({battery: true, gps: true, link: true});

  // Poll for telemetry updates
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(fetchLatestTelemetry, 500);
    return () => clearInterval(interval);
  }, [connected, fetchLatestTelemetry]);

  // Adjust brush window
  useEffect(() => {
    const total = telemetryBuffer.length;
    if (total === 0) {
      setBrushStart(0);
      setBrushEnd(0);
    } else {
      const prevLen = prevLenRef.current;
      const delta = total - prevLen;
      if (prevLen === 0) {
        const visible = Math.min(100, total);
        setBrushStart(total - visible);
        setBrushEnd(total - 1);
      } else if (brushEnd === prevLen - 1) {
        setBrushStart((bs) => Math.max(0, bs + delta));
        setBrushEnd(total - 1);
      }
      prevLenRef.current = total;
    }
  }, [telemetryBuffer.length]);

  const displayedData =
    telemetryBuffer.length > 0 && brushEnd >= brushStart
      ? telemetryBuffer.slice(brushStart, brushEnd + 1)
      : telemetryBuffer;

  const handleBrushChange = (e: { startIndex?: number; endIndex?: number }) => {
    if (e.startIndex !== undefined && e.endIndex !== undefined) {
      setBrushStart(e.startIndex);
      setBrushEnd(e.endIndex);
    }
  };

  return (
    <PageContainer>
      <div className="flex h-full">
        {/* LEFT PANEL: Charts + Timeline */}
        <div className="flex-1 min-w-0 flex flex-col !p-4">
          <div className="text-white text-xl font-bold mb-4">📈 Telemetry Charts</div>

          {telemetryBuffer.length === 0 ? (
            <div className="text-zinc-400 italic">Waiting for telemetry data...</div>
          ) : (
            <>
              {/* Scrollable Chart Section */}
              <div className="overflow-y-auto !space-y-4 !pr-1 max-h-[calc(100%-120px)]">

                {visibility.battery && (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayedData} syncId="charts">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333"/>
                        <XAxis dataKey="timestamp" hide/>
                        <YAxis tick={{fill: "#ccc", fontSize: 10}} domain={[10, 13]}/>
                        <Tooltip contentStyle={{backgroundColor: "#222", borderColor: "#555"}}/>
                        <Line
                          type="monotone"
                          dataKey="voltage"
                          stroke="#00f7ff"
                          dot={false}
                          name="Voltage (V)"
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {visibility.gps && (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayedData} syncId="charts">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333"/>
                        <XAxis dataKey="timestamp" hide/>
                        <YAxis tick={{fill: "#ccc", fontSize: 10}} domain={[0, 12]}/>
                        <Tooltip contentStyle={{backgroundColor: "#222", borderColor: "#555"}}/>
                        <Line type="monotone" dataKey="sats" stroke="#facc15" dot={false} name="Satellites"
                              isAnimationActive={false}/>
                        <Line type="monotone" dataKey="hdop" stroke="#22d3ee" dot={false} name="HDOP"
                              isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {visibility.link && (
                  <ChartCard>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayedData} syncId="charts">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333"/>
                        <XAxis dataKey="timestamp" hide/>
                        <YAxis tick={{fill: "#ccc", fontSize: 10}} domain={[0, 100]}/>
                        <Tooltip contentStyle={{backgroundColor: "#222", borderColor: "#555"}}/>
                        <Line type="monotone" dataKey={(d) => +d.rssi.replace('%', '')} stroke="#f472b6" dot={false}
                              name="RSSI (%)" isAnimationActive={false}/>
                        <Line type="monotone" dataKey={(d) => parseInt(d.ping)} stroke="#60a5fa" dot={false}
                              name="Ping (ms)" isAnimationActive={false}/>
                        <Line type="monotone" dataKey={(d) => parseInt(d.videoLatency)} stroke="#c084fc" dot={false}
                              name="Video Latency (ms)" isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>

              {/* Fixed Timeline */}
              <div className="h-[120px] mt-4 bg-zinc-900 rounded p-2 shrink-0">
                <div className="text-white text-sm mb-2">Timeline</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryBuffer}>
                    <XAxis dataKey="timestamp" hide/>
                    <YAxis hide/>
                    <Line type="monotone" isAnimationActive={false} dataKey="voltage" stroke="#8884d8" dot={false}/>
                    <Brush
                      dataKey="timestamp"
                      height={20}
                      stroke="#8884d8"
                      travellerWidth={8}
                      startIndex={brushStart}
                      endIndex={brushEnd}
                      onChange={handleBrushChange}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL: Video */}
        <div className="w-[400px] border-l border-zinc-700 !p-4 flex flex-col">
          <div className="text-white text-xl font-bold mb-2">🎥 Video Panel</div>
          <video controls className="w-full rounded-lg border border-zinc-600" src="/video/sample.mp4"/>
        </div>
      </div>
    </PageContainer>
  );
}

// Reusable chart card wrapper
function ChartCard({children}: { children: React.ReactNode }) {
  return (
    <div className="h-[200px] bg-zinc-900 rounded !p-2">
      {children}
    </div>
  );
}
