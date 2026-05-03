import { Box, Text } from "ink";
import { BorderBox } from "./BorderBox.tsx";

let nextLogId = 0;
let nextNarrationId = 0;

export interface LogEntry {
    id: number;
    text: string;
    dim?: boolean;
    truncate?: boolean;
    narration?: boolean;
    /** Shared across all wrapped lines of a single narration. */
    narrationId?: number;
    /** Full, unwrapped original text of the narration. Stored on each line. */
    narrationText?: string;
}

export function createLogEntry(
    text: string,
    dim = false,
    truncate = false,
    narration = false,
): LogEntry {
    return { id: nextLogId++, text, dim, truncate, narration };
}

export function createNarrationLines(
    originalText: string,
    wrappedLines: string[],
): LogEntry[] {
    const narrationId = nextNarrationId++;
    return wrappedLines.map((line) => ({
        id: nextLogId++,
        text: line,
        narration: true,
        narrationId,
        narrationText: originalText,
    }));
}

/** Break a string into lines that fit within maxWidth characters. */
export function wrapText(text: string, maxWidth: number): string[] {
    if (maxWidth <= 0) return [text];
    const result: string[] = [];
    const words = text.split(" ");
    let line = "";
    for (const word of words) {
        if (line.length === 0) {
            line = word;
        } else if (line.length + 1 + word.length <= maxWidth) {
            line += ` ${word}`;
        } else {
            result.push(line);
            line = word;
        }
    }
    if (line.length > 0) result.push(line);
    return result.length > 0 ? result : [""];
}

/** Unique narrationIds in the logs, in arrival order. */
export function listNarrationIds(logs: LogEntry[]): number[] {
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const l of logs) {
        if (l.narrationId !== undefined && !seen.has(l.narrationId)) {
            seen.add(l.narrationId);
            ids.push(l.narrationId);
        }
    }
    return ids;
}

interface ChatLogProps {
    logs: LogEntry[];
    width: number;
    height: number;
    visibleLines: number;
    activeNarrationId: number | null;
}

export function ChatLog({
    logs,
    width,
    height,
    visibleLines,
    activeNarrationId,
}: ChatLogProps) {
    const scrollStart = computeScrollStart(
        logs,
        activeNarrationId,
        visibleLines,
    );
    const visible = logs.slice(scrollStart, scrollStart + visibleLines);

    const title = buildTitle(logs, activeNarrationId);

    return (
        <BorderBox
            title={title}
            color="magenta"
            width={width}
            height={height}
            flexGrow={1}
            overflowY="hidden"
        >
            <Box
                flexDirection="column"
                justifyContent="flex-end"
                paddingX={1}
                height="100%"
            >
                {visible.map((entry) => {
                    const isActive =
                        activeNarrationId !== null &&
                        entry.narrationId === activeNarrationId;
                    return (
                        <Text
                            key={entry.id}
                            backgroundColor={
                                isActive ? "blueBright" : undefined
                            }
                            color={
                                isActive
                                    ? "white"
                                    : entry.narration
                                      ? "cyan"
                                      : undefined
                            }
                            dimColor={entry.dim && !isActive}
                            wrap="truncate"
                        >
                            {entry.text || " "}
                        </Text>
                    );
                })}
            </Box>
        </BorderBox>
    );
}

function buildTitle(logs: LogEntry[], active: number | null): string {
    if (active === null) return "Updates";
    const ids = listNarrationIds(logs);
    const idx = ids.indexOf(active);
    if (idx < 0) return "Updates";
    return `Updates [narration ${idx + 1}/${ids.length}]`;
}

function computeScrollStart(
    logs: LogEntry[],
    active: number | null,
    visibleLines: number,
): number {
    if (active === null) {
        return Math.max(0, logs.length - visibleLines);
    }
    // Scroll so the last line of the active narration sits at the bottom
    // of the viewport - keeps the whole group visible when it fits.
    let lastIdx = -1;
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].narrationId === active) lastIdx = i;
    }
    if (lastIdx === -1) {
        return Math.max(0, logs.length - visibleLines);
    }
    return Math.max(
        0,
        Math.min(lastIdx - visibleLines + 1, logs.length - visibleLines),
    );
}
