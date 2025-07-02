// Logs.tsx
import {useEffect, useRef, useState} from "react";
import PageContainer from "@/components/ui/PageContainer";
import {useRealTime} from "@/lib/RealTimeContext";
import {shouldDisplayLog, formatLogEntry, logEntryClasses} from "@/lib/LogUtils";

export default function Logs() {
    const {state} = useRealTime();
    const logContainerRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(true);
    const SCROLL_THRESHOLD = 50;

    function isAtBottom(): boolean {
        const el = logContainerRef.current;
        if (!el) return false;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    }

    // Scroll to bottom if sticky
    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;
        if (isSticky) el.scrollTop = el.scrollHeight;
    }, [state.allLogs, isSticky]);

    // Watch scroll behavior
    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;

        const onScroll = () => {
            if (isAtBottom()) {
                if (!isSticky) setIsSticky(true);
            } else {
                if (isSticky) setIsSticky(false);
            }
        };

        el.addEventListener("scroll", onScroll);
        return () => el.removeEventListener("scroll", onScroll);
    }, [isSticky]);

    const displayed = state.allLogs
        .filter(entry => shouldDisplayLog(entry))
        .slice(-500)
        .map((entry, idx) => {
            const text = formatLogEntry(entry) || '';
            return (
                <p key={idx} className={logEntryClasses(entry.log_id)}>
                    {text}
                </p>
            );
        });

    return (
        <PageContainer>
            <div className="h-full w-full !px-6 !py-4 overflow-hidden">
                <h1 className="text-xl font-bold !mb-4 text-zinc-200">Flight Logs</h1>
                <div
                    ref={logContainerRef}
                    className="!bg-zinc-900 !border !border-zinc-800 !rounded-lg !p-4 !overflow-y-auto [max-height:calc(100%-48px)] scrollbar-dark !space-y-1 !text-sm font-mono text-zinc-300"
                >
                    {displayed.length > 0 ? displayed : (
                        <p className="italic text-zinc-500">No important logs</p>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
