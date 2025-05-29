import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  BarChart2,
  Map,
  Gamepad,
  FileText,
  Settings,
} from "lucide-react";

const items = [
  { icon: Home, label: "Dashboard", path: "/home" },
  { icon: BarChart2, label: "Telemetry", path: "/telemetry" },
  { icon: Map, label: "Mission planner", path: "/mission" },
  { icon: Gamepad, label: "Mission control", path: "/manual" },
  { icon: FileText, label: "Logs", path: "/logs" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Sidebar() {
  return (
    <div className="fixed top-0 left-0 w-20 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col items-center !pt-[30px]">
      <nav className="flex flex-col items-center space-y-10 flex-grow">
        {/* first group (before divider) */}
        {items.slice(0, 4).map(({ icon: Icon, path, label }) => (
          <div key={path} className="relative group flex items-center justify-center">
            <NavLink
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center !p-2 rounded-lg transition-colors",
                  "hover:bg-zinc-800",
                  isActive ? "bg-zinc-800 !text-zinc-300" : "!text-zinc-400"
                )
              }
            >
              <Icon size={32} />
            </NavLink>
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow">
              {label}
            </span>
          </div>
        ))}

        <hr className="!w-12 border-t !border-zinc-400 my-3" />

        {/* second group (after divider) */}
        {items.slice(4).map(({ icon: Icon, path, label }) => (
          <div key={path} className="relative group flex items-center justify-center">
            <NavLink
              to={path}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-center !p-2 rounded-lg transition-colors",
                  "hover:bg-zinc-800",
                  isActive ? "bg-zinc-800 !text-zinc-300" : "!text-zinc-400"
                )
              }
            >
              <Icon size={32} />
            </NavLink>
            <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-xs !px-2 !py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap shadow">
              {label}
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}
