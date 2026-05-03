import { describe, expect, test } from "bun:test";
import { matchesEventFilter, toEvent } from "./github.ts";
import type { FeedEvent } from "./types.ts";

const baseRaw = {
    id: "12345",
    actor: { login: "octocat", display_login: "octocat" },
    repo: { name: "octocat/Hello-World" },
    public: true,
    created_at: "2026-04-01T10:00:00Z",
};

describe("toEvent", () => {
    test("maps PushEvent with branch and commit count", () => {
        const event = toEvent({
            ...baseRaw,
            type: "PushEvent",
            payload: {
                ref: "refs/heads/main",
                size: 3,
                commits: [{ message: "Fix the thing\n\nbody" }],
            },
        });
        expect(event).not.toBeNull();
        expect(event?.action).toBe("pushed to branch main");
        expect(event?.push_data?.ref).toBe("main");
        expect(event?.push_data?.commit_count).toBe(3);
        expect(event?.push_data?.commit_title).toBe("Fix the thing");
    });

    test("maps merged PullRequestEvent to merged action", () => {
        const event = toEvent({
            ...baseRaw,
            type: "PullRequestEvent",
            payload: {
                action: "closed",
                pull_request: {
                    title: "Add feature X",
                    number: 42,
                    merged: true,
                    html_url: "https://github.com/x/y/pull/42",
                },
            },
        });
        expect(event?.action).toContain("merged merge request !42");
        expect(event?.target_type).toBe("MergeRequest");
        expect(event?.target_title).toBe("Add feature X");
        expect(event?.link).toBe("https://github.com/x/y/pull/42");
    });

    test("maps closed-but-not-merged PullRequestEvent as closed", () => {
        const event = toEvent({
            ...baseRaw,
            type: "PullRequestEvent",
            payload: {
                action: "closed",
                pull_request: {
                    title: "Drop this",
                    number: 7,
                    merged: false,
                },
            },
        });
        expect(event?.action).toContain("closed merge request !7");
    });

    test("maps IssuesEvent", () => {
        const event = toEvent({
            ...baseRaw,
            type: "IssuesEvent",
            payload: {
                action: "opened",
                issue: { title: "Bug report", number: 5 },
            },
        });
        expect(event?.action).toBe("opened issue #5: Bug report");
        expect(event?.target_type).toBe("Issue");
    });

    test("maps IssueCommentEvent into note", () => {
        const event = toEvent({
            ...baseRaw,
            type: "IssueCommentEvent",
            payload: {
                comment: { body: "looks good" },
                issue: { title: "X", number: 1 },
            },
        });
        expect(event?.note?.body).toBe("looks good");
        expect(event?.note?.noteable_type).toBe("Issue");
    });

    test("maps ReleaseEvent", () => {
        const event = toEvent({
            ...baseRaw,
            type: "ReleaseEvent",
            payload: {
                action: "published",
                release: { tag_name: "v1.0.0", name: "First public release" },
            },
        });
        expect(event?.target_type).toBe("Release");
        expect(event?.target_title).toBe("First public release");
        expect(event?.action).toContain("published release");
    });

    test("returns null for unknown event types", () => {
        expect(
            toEvent({
                ...baseRaw,
                type: "WatchEvent",
                payload: { action: "started" },
            }),
        ).toBeNull();
    });
});

describe("github matchesEventFilter", () => {
    const baseEvent: FeedEvent = {
        id: "1",
        action: "pushed to branch main",
        author: "octocat",
        project: "octocat/Hello-World",
        link: "",
        target_type: null,
        target_title: null,
        created_at: "2026-04-01T10:00:00Z",
    };

    test("matches push events with 'pushed' filter", () => {
        const event = {
            ...baseEvent,
            push_data: { ref: "main", commit_title: "x", commit_count: 1 },
        };
        expect(matchesEventFilter(event, new Set(["pushed"]))).toBe(true);
    });

    test("matches release events with 'released' filter", () => {
        const event = {
            ...baseEvent,
            target_type: "Release",
            action: "published release v1",
        };
        expect(matchesEventFilter(event, new Set(["released"]))).toBe(true);
    });

    test("rejects non-matching events", () => {
        expect(matchesEventFilter(baseEvent, new Set(["commented"]))).toBe(
            false,
        );
    });
});
