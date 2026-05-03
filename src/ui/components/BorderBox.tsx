import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface BorderBoxProps {
    title?: string;
    color: string;
    width?: number;
    height?: number;
    flexGrow?: number;
    overflowY?: "hidden" | "visible";
    children: ReactNode;
}

// Round border chars
const TL = "╭";
const TR = "╮";
const BL = "╰";
const BR = "╯";
const H = "─";
const V = "│";

export function BorderBox({
    title,
    color,
    width,
    height,
    flexGrow,
    overflowY,
    children,
}: BorderBoxProps) {
    // Inner width = total width minus 2 border chars
    const innerWidth = width ? width - 2 : undefined;

    const topBar = title
        ? buildTopWithTitle(title, color, innerWidth)
        : buildTopPlain(color, innerWidth);

    return (
        <Box
            flexDirection="column"
            width={width}
            height={height}
            flexGrow={flexGrow}
        >
            {topBar}
            <Box overflowY={overflowY}>
                <Text color={color}>{V}</Text>
                <Box
                    flexDirection="column"
                    flexGrow={1}
                    paddingX={0}
                    width={innerWidth}
                >
                    {children}
                </Box>
                <Text color={color}>{V}</Text>
            </Box>
            <Box>
                <Text color={color}>
                    {BL}
                    {H.repeat(innerWidth ?? 20)}
                    {BR}
                </Text>
            </Box>
        </Box>
    );
}

function buildTopWithTitle(
    title: string,
    color: string,
    innerWidth?: number,
): ReactNode {
    const label = ` ${title} `;
    const remaining = (innerWidth ?? 20) - label.length;
    const left = 1;
    const right = Math.max(0, remaining - left);

    return (
        <Box>
            <Text color={color}>
                {TL}
                {H.repeat(left)}
            </Text>
            <Text bold color={color}>
                {label}
            </Text>
            <Text color={color}>
                {H.repeat(right)}
                {TR}
            </Text>
        </Box>
    );
}

function buildTopPlain(color: string, innerWidth?: number): ReactNode {
    return (
        <Box>
            <Text color={color}>
                {TL}
                {H.repeat(innerWidth ?? 20)}
                {TR}
            </Text>
        </Box>
    );
}
