import {useEffect, useRef, useState} from "react";
import PageContainer from "@/components/ui/PageContainer";
import {useRealTime} from "@/lib/RealTimeContext";
import {shouldDisplayLog, formatLogEntry, logEntryClasses, type LogFilterOptions} from "@/lib/LogUtils";
import rawLogsTemplate from "../../../../logs_template.json";

import {Button} from "@/components/ui/button";
import {Popover, PopoverTrigger, PopoverContent} from "@/components/ui/popover";
import {Checkbox} from "@/components/ui/checkbox";

const categoryNames = (rawLogsTemplate as any).category_names as Record<string, string>;
const severityNames = (rawLogsTemplate as any).Severity as Record<string, string>;
const importanceNames = (rawLogsTemplate as any).Importance as Record<string, string>;

const ID_REGEX = /^[A-Za-z]{2}\d{4}$/;

export default function Logs() {
    const {state} = useRealTime();
    const logContainerRef = useRef<HTMLDivElement | null>(null);
    const [isSticky, setIsSticky] = useState(true);
    const SCROLL_THRESHOLD = 50;

    const [filterOptions, setFilterOptions] = useState<LogFilterOptions>({
        categories: Object.keys(categoryNames),
        severity: Object.keys(severityNames),
        importance: Object.keys(importanceNames)
    });

    const [searchTerm, setSearchTerm] = useState('');
    const isExactIdSearch = ID_REGEX.test(searchTerm);

    function handleCheckboxChange(key: keyof LogFilterOptions, value: string) {
        setFilterOptions(prev => {
            const list = prev[key] || [];
            const newList = list.includes(value)
                ? list.filter(v => v !== value)
                : [...list, value];
            return {...prev, [key]: newList};
        });
    }

    function isAtBottom(): boolean {
        const el = logContainerRef.current;
        if (!el) return false;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD;
    }

    useEffect(() => {
        const el = logContainerRef.current;
        if (!el) return;
        if (isSticky) el.scrollTop = el.scrollHeight;
    }, [state.allLogs, isSticky]);

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

    // apply exact-ID search if pattern matches, otherwise dropdown filters
    const filteredLogs = state.allLogs.filter(entry => {
        const idStr = String(entry.log_id);
        if (isExactIdSearch) {
            return idStr === searchTerm;
        }
        return shouldDisplayLog(entry, filterOptions);
    });

    const displayed = filteredLogs
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
            <div className="h-full w-full px-6 py-4">
                <div className="flex gap-4 mb-4 text-sm text-zinc-200 items-center">
                    <h1 className="text-xl font-bold text-zinc-200">Logs</h1>

                    <input
                        type="text"
                        placeholder="Search log ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 placeholder-zinc-500"
                        maxLength={6}
                    />

                    {/* Category Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                Category{filterOptions.categories.length ? ` (${filterOptions.categories.length})` : ''}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            {Object.entries(categoryNames).map(([code, label]) => (
                                <div key={code} className="flex items-center p-1">
                                    <Checkbox
                                        checked={filterOptions.categories.includes(code)}
                                        onCheckedChange={() => handleCheckboxChange('categories', code)}
                                    />
                                    <span className="ml-2 text-sm">{label}</span>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>

                    {/* Severity Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                Severity{filterOptions.severity.length ? ` (${filterOptions.severity.length})` : ''}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            {Object.entries(severityNames).map(([code, label]) => (
                                <div key={code} className="flex items-center p-1">
                                    <Checkbox
                                        checked={filterOptions.severity.includes(code)}
                                        onCheckedChange={() => handleCheckboxChange('severity', code)}
                                    />
                                    <span className="ml-2 text-sm">{label}</span>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>

                    {/* Importance Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                Importance{filterOptions.importance.length ? ` (${filterOptions.importance.length})` : ''}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                            {Object.entries(importanceNames).map(([code, label]) => (
                                <div key={code} className="flex items-center p-1">
                                    <Checkbox
                                        checked={filterOptions.importance.includes(code)}
                                        onCheckedChange={() => handleCheckboxChange('importance', code)}
                                    />
                                    <span className="ml-2 text-sm">{label}</span>
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>

                <div
                    ref={logContainerRef}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-y-auto h-[calc(100%-54px)] scrollbar-dark text-sm font-mono text-zinc-300 flex-1 flex-col justify-end space-y-1"
                >
                    {displayed.length ? displayed : (
                        <p className="italic text-zinc-500">No logs match filters</p>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
