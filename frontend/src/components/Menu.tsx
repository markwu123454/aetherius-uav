import {NavLink} from "react-router-dom";
import {cn} from "@/lib/utils";
import {
    Home,
    BarChart2,
    Map,
    Gamepad,
    FileText,
    Settings,
} from "lucide-react";

const items = [
    {icon: Home, label: "Dashboard", path: "/home"},
    {icon: BarChart2, label: "Telemetry", path: "/telemetry"},
    {icon: Map, label: "Mission planner", path: "/mission"},
    {icon: Gamepad, label: "Mission control", path: "/manual"},
    {icon: FileText, label: "Logs", path: "/logs"},
    {icon: Settings, label: "Settings", path: "/settings"},
];

export default function Menu() {
    return (
        <div
            className="w-16 h-screen sticky top-0 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-2">
            <nav className="flex flex-col items-center space-y-1 flex-grow">
                {/* first group (before divider) */}
                {items.slice(0, 4).map(({icon: Icon, path, label}) => (
                    <div key={path} className="relative group flex items-center justify-center">
                        <NavLink
                            to={path}
                            className={({isActive}) =>
                                cn(
                                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                                    "hover:bg-zinc-800",
                                    isActive ? "bg-zinc-800 text-zinc-300" : "text-zinc-400"
                                )
                            }
                        >
                            <Icon size={32}/>
                        </NavLink>
                    </div>
                ))}

                <hr className="w-12 border-t border-zinc-400 my-3"/>

                {/* second group (after divider) */}
                {items.slice(4).map(({icon: Icon, path, label}) => (
                    <div key={path} className="relative group flex items-center justify-center">
                        <NavLink
                            to={path}
                            className={({isActive}) =>
                                cn(
                                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                                    "hover:bg-zinc-800",
                                    isActive ? "bg-zinc-800 text-zinc-300" : "text-zinc-400"
                                )
                            }
                        >
                            <Icon size={32}/>
                        </NavLink>
                    </div>
                ))}
            </nav>
        </div>
    );
}
