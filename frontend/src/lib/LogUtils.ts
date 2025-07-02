// src/lib/logUtils.ts

import rawLogsTemplate from "../../../logs_template.json";
// Cast imported JSON to a simple string->string map
const logsTemplate: Record<string,string> = rawLogsTemplate as unknown as Record<string,string>;
import {type LogEntry} from "@/types"

/**
 * Options for filtering log entries.
 */
export interface LogFilterOptions {
  /**
   * Which importance characters (4th char) to include. e.g. ['1','2']
   * Default: all except '0'.
   */
  importance?: string[];
  /**
   * Which severity characters (3rd char) to include. e.g. ['1','2']
   * Default: all.
   */
  severity?: string[];
}

/**
 * Decide whether a log should be displayed according to filter options.
 */
export function shouldDisplayLog(
  entry: LogEntry,
  options: LogFilterOptions = {}
): boolean {
  const idStr = String(entry.log_id);
  const imp = idStr.charAt(3);
  const sev = idStr.charAt(2);

  // Importance filter: default allow all
  if (options.importance && !options.importance.includes(imp)) return false;

  // Severity filter: default include all
  if (options.severity && !options.severity.includes(sev)) return false;

  return true;
}


/**
 * Format a log entry into a human-readable string, applying the template and timestamp.
 * Returns null if template or formatting fails.
 */
export function formatLogEntry(entry: LogEntry): string | null {
  const idStr = String(entry.log_id);

  // 1) prepare variables safely
  let safeVars: Record<string, any>;
  const variables = entry.variables;
  if (variables && typeof variables === 'object') {
    safeVars = {};
    for (const [k, v] of Object.entries(variables)) {
      safeVars[String(k)] = v;
    }
  } else {
    safeVars = { value: variables };
  }

  // 2) apply the template
  const template = logsTemplate[idStr] || '';
  let body: string;
  try {
    body = template.replace(/\{(\w+)}/g, (_, key) =>
      safeVars[key] !== undefined ? String(safeVars[key]) : ''
    );
  } catch (err) {
    console.warn(`${idStr} format error:`, err, 'raw vars:', variables);
    return null;
  }

  // 3) format the timestamp (ns → ms)
  const date = new Date(entry.timestamp / 1e6);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const mmm = String(date.getMilliseconds()).padStart(3, '0');
  const timeStr = `${hh}:${mm}:${ss}.${mmm}`;

  return `${timeStr}: [${idStr}] ${body}`;
}

/**
 * Returns CSS class names based on the 3rd (severity) and 4th (importance) chars of log_id.
 */
export function logEntryClasses(log_id: string | number): string {
  const idStr = String(log_id);
  const sev = idStr.charAt(2);
  const imp = idStr.charAt(3);

  // severity → color
  let colorClass = 'text-gray-400';
  if (sev === '2') colorClass = 'text-red-500';
  else if (sev === '1') colorClass = 'text-yellow-400';

  // importance → weight
  const weightClass = imp === '2' ? 'font-bold' : '';

  return [colorClass, weightClass].filter(Boolean).join(' ');
}
