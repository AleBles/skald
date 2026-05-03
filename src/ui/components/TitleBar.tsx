import { Box, Text } from "ink";
import type { Config } from "../../config/types.ts";

interface TitleBarProps {
    width: number;
    config: Config;
    mode: string;
    version: string;
}

export function TitleBar({ width, config, mode, version }: TitleBarProps) {
    const filters =
        config.feed.events.length > 0 ? config.feed.events.join(", ") : "all";

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="blue"
            paddingX={1}
            width={width}
        >
            <Box justifyContent="center">
                <Text bold color="blue">
                    Skald
                </Text>
                <Text dimColor>
                    {" "}
                    v{version} - AI voice narrator for repo activity
                </Text>
            </Box>
            <Box gap={2}>
                <Text>
                    <Text dimColor>Source:</Text> {config.feed.type}
                </Text>
                <Text>
                    <Text dimColor>Feeds:</Text> {config.feed.feeds.join(", ")}
                </Text>
                <Text>
                    <Text dimColor>Poll:</Text> {config.feed.poll_interval}s
                </Text>
                <Text>
                    <Text dimColor>Filter:</Text> {filters}
                </Text>
            </Box>
            <Box gap={2}>
                <Text>
                    <Text dimColor>Personality:</Text>{" "}
                    {config.narrator.personality}
                </Text>
                <Text>
                    <Text dimColor>Mode:</Text> {mode}
                </Text>
            </Box>
        </Box>
    );
}
