import { describe, expect, test } from "bun:test";
import {
    extractBranch,
    extractCommitTitle,
    matchesEventFilter,
    parseFeedTitle,
} from "./gitlab.ts";
import type { FeedEvent } from "./types.ts";

describe("parseFeedTitle", () => {
    test("extracts action and project from standard title", () => {
        const result = parseFeedTitle(
            "John Doe pushed new branch feature-x at my-org/my-project",
            "John Doe",
        );
        expect(result.action).toBe("pushed new branch feature-x");
        expect(result.project).toBe("my-org/my-project");
    });

    test("handles title without 'at' separator", () => {
        const result = parseFeedTitle("did something", "");
        expect(result.action).toBe("did something");
        expect(result.project).toBe("");
    });

    test("strips author name prefix", () => {
        const result = parseFeedTitle(
            "Jane Smith opened issue #5: Bug report at org/repo",
            "Jane Smith",
        );
        expect(result.action).toBe("opened issue #5: Bug report");
        expect(result.project).toBe("org/repo");
    });

    test("detects merge request target type", () => {
        const result = parseFeedTitle(
            "accepted merge request !42: Fix login at org/repo",
            "",
        );
        expect(result.targetType).toBe("MergeRequest");
        expect(result.targetTitle).toBe("Fix login");
    });

    test("detects issue target type", () => {
        const result = parseFeedTitle(
            "opened issue #10: Add dark mode at org/repo",
            "",
        );
        expect(result.targetType).toBe("Issue");
        expect(result.targetTitle).toBe("Add dark mode");
    });

    test("returns null target for plain push", () => {
        const result = parseFeedTitle("pushed to branch main at org/repo", "");
        expect(result.targetType).toBeNull();
        expect(result.targetTitle).toBeNull();
    });

    test("uses last 'at' for project when title contains 'at' in action", () => {
        const result = parseFeedTitle(
            "looked at merge request !1: Something at org/repo",
            "",
        );
        expect(result.project).toBe("org/repo");
    });
});

describe("extractBranch", () => {
    test("extracts branch name from push title", () => {
        expect(extractBranch("pushed to branch main at org/repo")).toBe("main");
    });

    test("extracts branch with slashes", () => {
        expect(
            extractBranch("pushed new branch feature/login at org/repo"),
        ).toBe("feature/login");
    });

    test("returns empty string when no branch found", () => {
        expect(extractBranch("opened an issue")).toBe("");
    });
});

describe("extractCommitTitle", () => {
    test("extracts commit title from blockquote", () => {
        const xml = `<div class="blockquote"><p dir="auto">Fix the thing</p></div>`;
        expect(extractCommitTitle(xml)).toBe("Fix the thing");
    });

    test("returns null when no blockquote found", () => {
        expect(extractCommitTitle("<div>no commit</div>")).toBeNull();
    });

    test("trims whitespace", () => {
        const xml = `<div class="blockquote"><p>  spaces  </p></div>`;
        expect(extractCommitTitle(xml)).toBe("spaces");
    });
});

describe("matchesEventFilter", () => {
    const baseEvent: FeedEvent = {
        id: "1",
        action: "pushed to branch main",
        author: "john",
        project: "org/repo",
        link: "",
        target_type: null,
        target_title: null,
        created_at: "2026-01-01T00:00:00Z",
    };

    test("matches push events with 'pushed' filter", () => {
        const event = {
            ...baseEvent,
            push_data: { ref: "main", commit_title: "fix", commit_count: 1 },
        };
        expect(matchesEventFilter(event, new Set(["pushed"]))).toBe(true);
    });

    test("matches merge events with 'merged' filter", () => {
        const event = {
            ...baseEvent,
            action: "accepted merge request !42",
            target_type: "MergeRequest",
        };
        expect(matchesEventFilter(event, new Set(["merged"]))).toBe(true);
    });

    test("matches comment events with 'commented' filter", () => {
        const event = {
            ...baseEvent,
            action: "commented on issue",
            note: { body: "looks good", noteable_type: "Issue" },
        };
        expect(matchesEventFilter(event, new Set(["commented"]))).toBe(true);
    });

    test("matches issue events with 'issues' filter", () => {
        const event = {
            ...baseEvent,
            action: "opened issue",
            target_type: "Issue",
        };
        expect(matchesEventFilter(event, new Set(["issues"]))).toBe(true);
    });

    test("rejects non-matching events", () => {
        expect(matchesEventFilter(baseEvent, new Set(["commented"]))).toBe(
            false,
        );
    });

    test("matches with multiple filters (any match)", () => {
        const event = {
            ...baseEvent,
            push_data: { ref: "main", commit_title: "fix", commit_count: 1 },
        };
        expect(
            matchesEventFilter(event, new Set(["commented", "pushed"])),
        ).toBe(true);
    });

    test("matches pipeline events", () => {
        const event = {
            ...baseEvent,
            action: "triggered pipeline",
            target_type: "Pipeline",
        };
        expect(matchesEventFilter(event, new Set(["pipelines"]))).toBe(true);
    });
});
