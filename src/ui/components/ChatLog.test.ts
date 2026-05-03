import { describe, expect, test } from "bun:test";
import {
    createLogEntry,
    createNarrationLines,
    type LogEntry,
    listNarrationIds,
    wrapText,
} from "./ChatLog.tsx";

describe("wrapText", () => {
    test("returns [text] when maxWidth <= 0", () => {
        expect(wrapText("hello world", 0)).toEqual(["hello world"]);
        expect(wrapText("hello world", -5)).toEqual(["hello world"]);
    });

    test("keeps single short line intact", () => {
        expect(wrapText("hello", 20)).toEqual(["hello"]);
    });

    test("wraps at word boundaries", () => {
        expect(wrapText("the quick brown fox", 10)).toEqual([
            "the quick",
            "brown fox",
        ]);
    });

    test("puts words longer than maxWidth on their own line", () => {
        expect(wrapText("hi verylongword rest", 5)).toEqual([
            "hi",
            "verylongword",
            "rest",
        ]);
    });

    test("returns single empty-string element for empty input", () => {
        expect(wrapText("", 10)).toEqual([""]);
    });

    test("handles exact fit without orphaning words", () => {
        expect(wrapText("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
    });
});

describe("listNarrationIds", () => {
    test("returns empty array when no narrations", () => {
        const logs: LogEntry[] = [
            createLogEntry("first"),
            createLogEntry("second"),
        ];
        expect(listNarrationIds(logs)).toEqual([]);
    });

    test("returns unique ids in arrival order", () => {
        const a = createNarrationLines("A", ["A1", "A2"]);
        const b = createNarrationLines("B", ["B1"]);
        const logs = [
            createLogEntry("pre"),
            ...a,
            createLogEntry("middle"),
            ...b,
        ];
        const aId = a[0].narrationId ?? -1;
        const bId = b[0].narrationId ?? -1;
        expect(listNarrationIds(logs)).toEqual([aId, bId]);
    });

    test("dedupes ids shared across wrapped lines", () => {
        const lines = createNarrationLines("same", ["s1", "s2", "s3", "s4"]);
        expect(listNarrationIds(lines)).toHaveLength(1);
    });
});

describe("createNarrationLines", () => {
    test("all wrapped lines share one narrationId", () => {
        const lines = createNarrationLines("hello there", ["hello", "there"]);
        expect(lines[0].narrationId).toBeDefined();
        expect(lines[1].narrationId).toBe(lines[0].narrationId);
    });

    test("all lines carry the full original text", () => {
        const lines = createNarrationLines("full text", ["full", "text"]);
        expect(lines[0].narrationText).toBe("full text");
        expect(lines[1].narrationText).toBe("full text");
    });

    test("every line is flagged as narration", () => {
        const lines = createNarrationLines("x", ["x"]);
        expect(lines[0].narration).toBe(true);
    });

    test("successive calls produce distinct narrationIds", () => {
        const a = createNarrationLines("A", ["A"]);
        const b = createNarrationLines("B", ["B"]);
        expect(a[0].narrationId).not.toBe(b[0].narrationId);
    });

    test("each line gets a unique log id", () => {
        const lines = createNarrationLines("x", ["a", "b", "c"]);
        const ids = new Set(lines.map((l) => l.id));
        expect(ids.size).toBe(3);
    });
});
