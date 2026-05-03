import { Box, Text } from "ink";

interface HelpBarProps {
    width: number;
    muted: boolean;
    started: boolean;
    pollInterval: number;
}

export function HelpBar({ width, muted, started, pollInterval }: HelpBarProps) {
    return (
        <Box borderStyle="round" borderColor="green" paddingX={1} width={width}>
            <Text color="green">
                [↑↓] select [c] copy [t] test [r] replay [p] stop [m]{" "}
                {muted ? "unmute" : "mute"} [ctrl+c] quit
            </Text>
            {muted && <Text color="red"> MUTED</Text>}
            {started && (
                <Text dimColor>
                    {"  "}polling every {pollInterval}s
                </Text>
            )}
        </Box>
    );
}
