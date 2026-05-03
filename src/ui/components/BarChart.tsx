import { Text } from "ink";

export interface BarChartEntry {
    name: string;
    events: number;
}

const BLOCK_FULL = "█";
const BLOCK_PARTIAL = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return `${str.slice(0, max - 1)}…`;
}

interface BarChartProps {
    entries: BarChartEntry[];
    color: string;
    barWidth: number;
}

export function BarChart({ entries, color, barWidth }: BarChartProps) {
    const maxEvents = entries[0]?.events ?? 1;
    const maxCountLen = String(maxEvents).length;
    const nameColWidth = Math.min(
        14,
        Math.max(...entries.map((e) => e.name.length)),
    );

    return (
        <>
            {entries.map((entry) => {
                const ratio = entry.events / maxEvents;
                const filled = ratio * barWidth;
                const fullBlocks = Math.floor(filled);
                const partialIdx = Math.round((filled - fullBlocks) * 7);
                const bar =
                    BLOCK_FULL.repeat(fullBlocks) +
                    (BLOCK_PARTIAL[partialIdx] ?? "");
                const pad = " ".repeat(
                    Math.max(
                        0,
                        barWidth - fullBlocks - (partialIdx > 0 ? 1 : 0),
                    ),
                );
                const namePad = truncate(entry.name, nameColWidth).padEnd(
                    nameColWidth,
                );
                const countStr = String(entry.events).padStart(maxCountLen);

                return (
                    <Text key={entry.name}>
                        <Text>{namePad} </Text>
                        <Text color={color}>
                            {bar}
                            {pad}
                        </Text>
                        <Text> {countStr}</Text>
                    </Text>
                );
            })}
        </>
    );
}
