// from https://gist.github.com/janis-me/1a55a8747f12e1c4fc86ebe2d05a0a55

import { Box, type DOMElement, measureElement, useFocus, useInput } from "ink";
import { useEffect, useReducer, useRef } from "react";

interface ScrollPanelState {
    innerHeight: number;
    height: number;
    scrollTop: number;
}

type ScrollPanelAction =
    | { type: "SET_INNER_HEIGHT"; innerHeight: number }
    | { type: "SET_HEIGHT"; height: number }
    | { type: "SCROLL_DOWN" }
    | { type: "SCROLL_UP" }
    | { type: "PAGE_DOWN" }
    | { type: "PAGE_UP" };

const reducer = (state: ScrollPanelState, action: ScrollPanelAction) => {
    switch (action.type) {
        case "SET_INNER_HEIGHT":
            return {
                ...state,
                innerHeight: action.innerHeight,
            };
        case "SET_HEIGHT":
            return {
                ...state,
                height: action.height,
            };

        case "SCROLL_DOWN":
            return {
                ...state,
                scrollTop: Math.min(
                    state.innerHeight <= state.height
                        ? 0
                        : state.innerHeight - state.height,
                    state.scrollTop + 1,
                ),
            };

        case "SCROLL_UP":
            return {
                ...state,
                scrollTop: Math.max(0, state.scrollTop - 1),
            };

        case "PAGE_DOWN":
            return {
                ...state,
                scrollTop: Math.min(
                    state.innerHeight <= state.height
                        ? 0
                        : state.innerHeight - state.height,
                    state.scrollTop + state.height,
                ),
            };

        case "PAGE_UP":
            return {
                ...state,
                scrollTop: Math.max(0, state.scrollTop - state.height),
            };

        default:
            return state;
    }
};

export interface ScrollPanelProps extends React.PropsWithChildren {
    height: number;
}

export function ScrollPanel({ height, children }: ScrollPanelProps) {
    useFocus();
    const [state, dispatch] = useReducer(reducer, {
        height: height,
        scrollTop: 0,
        innerHeight: 0,
    });

    const innerRef = useRef<DOMElement>(null);

    useEffect(() => {
        dispatch({ type: "SET_HEIGHT", height });
    }, [height]);

    useEffect(() => {
        if (!innerRef.current) return;

        const dimensions = measureElement(innerRef.current);

        if (dimensions.height !== state.innerHeight) {
            dispatch({
                type: "SET_INNER_HEIGHT",
                innerHeight: dimensions.height,
            });
        }
    });

    useInput((_input, key) => {
        if (key.downArrow) dispatch({ type: "SCROLL_DOWN" });
        if (key.upArrow) dispatch({ type: "SCROLL_UP" });
        if (key.pageDown) dispatch({ type: "PAGE_DOWN" });
        if (key.pageUp) dispatch({ type: "PAGE_UP" });
    });

    return (
        <Box height={height} flexDirection="column" overflow="hidden">
            <Box
                ref={innerRef}
                flexShrink={0}
                flexDirection="column"
                marginTop={-state.scrollTop}
            >
                {children}
            </Box>
        </Box>
    );
}
