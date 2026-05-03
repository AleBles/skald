import { Box, Text } from "ink";
import { BarChart, type BarChartEntry } from "./BarChart.tsx";
import { BorderBox } from "./BorderBox.tsx";

interface StatsPanelProps {
    title: string;
    color: string;
    entries: BarChartEntry[];
    width: number;
    maxRows: number;
    barWidth: number;
}

export function StatsPanel({
    title,
    color,
    entries,
    width,
    maxRows,
    barWidth,
}: StatsPanelProps) {
    return (
        <BorderBox title={title} color={color} width={width} overflowY="hidden">
            <Box flexDirection="column" paddingX={1}>
                {entries.length === 0 ? (
                    <Text dimColor>No activity yet</Text>
                ) : (
                    <BarChart
                        entries={entries.slice(0, maxRows)}
                        color={color}
                        barWidth={barWidth}
                    />
                )}
            </Box>
        </BorderBox>
    );
}
