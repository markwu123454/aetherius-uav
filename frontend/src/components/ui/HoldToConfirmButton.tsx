import {useState, useRef} from "react";
import {Button} from "@/components/ui/button";

//import classNames from "classnames";

interface Props {
    onConfirm: () => void;
    duration?: number; // ms
    children: React.ReactNode;
    variant?: "default" | "outline" | "destructive";
}

export default function HoldToConfirmButton({
                                                onConfirm,
                                                duration = 1000,
                                                children,
                                                variant = "outline",
                                            }: Props) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    const handleMouseDown = () => {
        startTimeRef.current = Date.now();
        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const p = Math.min(1, elapsed / duration);
            setProgress(p);
        }, 16);

        timeoutRef.current = setTimeout(() => {
            onConfirm();
            setProgress(0);
            cleanup();
        }, duration);
    };

    const cleanup = () => {
        clearInterval(intervalRef.current!);
        clearTimeout(timeoutRef.current!);
        intervalRef.current = null;
        timeoutRef.current = null;
    };

    const handleMouseUp = () => {
        setProgress(0);
        cleanup();
    };

    return (
        <div className="relative">
            <Button
                variant={variant}
                className={`relative overflow-hidden w-full ${variant === "destructive" ? "bg-zinc-900 hover:bg-red-950 hover:border-red-500" : ""}`}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    className="absolute inset-0 bg-red-600/100 transition-all duration-[16ms] pointer-events-none"
                    style={{width: `${progress * 100}%`}}
                />
                <span className="relative z-10">{children}</span>
            </Button>
        </div>
    );
}
