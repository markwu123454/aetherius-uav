// Sparkline.tsx
import { useEffect, useRef, useState } from "react";

// ========== Hook ==========
export function useSparkline(value: number, maxLength = 60, intervalMs = 1000) {
  const [history, setHistory] = useState<number[]>([]);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        const updated = [...prev, valueRef.current];
        return updated.length > maxLength ? updated.slice(-maxLength) : updated;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [maxLength, intervalMs]);

  return history;
}


// ========== Component ==========
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  highlightMinMax?: boolean;
  highlightLast?: boolean;
}

export function Sparkline({
  data,
  width = 200,
  height = 40,
  color = "currentColor",
  strokeWidth = 1.5,
  highlightMinMax = false,
  highlightLast = false,
}: SparklineProps) {
  if (data.length < 2) return null;

  const margin = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - margin - ((val - min) / range) * (height - 2 * margin);
    return { x, y };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

  const circles: { x: number; y: number; key: string }[] = [];
  if (highlightLast) circles.push({ ...points.at(-1)!, key: "last" });
  if (highlightMinMax) {
    const minIdx = data.indexOf(min);
    const maxIdx = data.indexOf(max);
    circles.push({ ...points[minIdx], key: "min" });
    circles.push({ ...points[maxIdx], key: "max" });
  }

  return (
    <svg width={width} height={height} className="text-blue-600">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        points={polylinePoints}
      />
      {circles.map(p => (
        <circle
          key={p.key}
          cx={p.x}
          cy={p.y}
          r={2}
          fill={color}
        />
      ))}
    </svg>
  );
}
