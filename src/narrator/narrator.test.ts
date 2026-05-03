import { describe, expect, test } from "bun:test";
import type { Config } from "../config/types.ts";
import type { GitLabEvent } from "../feed/types.ts";
import type { ChatOptions, ChatProvider } from "../providers/types.ts";
import { describeEvent, describeEvents, Narrator } from "./narrator.ts";

function makeEvent(overrides: Partial<GitLabEvent> = {}): GitLabEvent {
    return {
        id: 1,
        action: "pushed to branch main",
        author: "john.doe",
        project: "org/repo",
        link: "https://gitlab.example.com/org/repo",
        target_type: null,
        target_title: null,
        created_at: "2026-04-01T10:30:00Z",
        ...overrides,
    };
}

describe("describeEvent", () => {
    test("describes comment events", () => {
        const event = makeEvent({
            action: "commented on issue",
            note: { body: "Looks good to me!", noteable_type: "Issue" },
        });
        const result = describeEvent(event);
        expect(result).toBe('john.doe commented on Issue: "Looks good to me!"');
    });

    test("truncates long comment bodies to 100 chars", () => {
        const longBody = "A".repeat(200);
        const event = makeEvent({
            action: "commented on merge request",
            note: { body: longBody, noteable_type: "MergeRequest" },
        });
        const result = describeEvent(event);
        expect(result).toContain(`"${"A".repeat(100)}"`);
        expect(result).not.toContain(`"${"A".repeat(101)}"`);
    });

    test("describes merge request events", () => {
        const event = makeEvent({
            action: "accepted merge request !42",
            target_type: "MergeRequest",
            target_title: "Add dark mode",
        });
        const result = describeEvent(event);
        expect(result).toBe(
            'john.doe accepted merge request !42 merge request: "Add dark mode"',
        );
    });

    test("describes issue events", () => {
        const event = makeEvent({
            action: "opened issue #10",
            target_type: "Issue",
            target_title: "Login broken",
        });
        const result = describeEvent(event);
        expect(result).toBe('john.doe opened issue #10 issue: "Login broken"');
    });

    test("describes unknown events with fallback", () => {
        const event = makeEvent({
            action: "did something",
            target_type: null,
            target_title: null,
        });
        const result = describeEvent(event);
        expect(result).toContain("john.doe did something something");
    });

    test("describes push events", () => {
        const event = makeEvent({
            push_data: {
                ref: "main",
                commit_title: "Initial commit",
                commit_count: 2,
            },
        });
        const result = describeEvent(event);
        expect(result).toBe(
            'john.doe pushed 2 commit(s) to main: "Initial commit"',
        );
    });

    test("describes push events with missing commit title", () => {
        const event = makeEvent({
            push_data: { ref: "dev", commit_title: null, commit_count: 1 },
        });
        expect(describeEvent(event)).toContain('"no message"');
    });
});

// -- Narrator class tests --

class StubChatProvider implements ChatProvider {
    public calls: ChatOptions[] = [];
    constructor(private response: string) {}
    chat(opts: ChatOptions): Promise<string> {
        this.calls.push(opts);
        return Promise.resolve(this.response);
    }
}

function makeConfig(): Config {
    return {
        configPath: "/tmp/test.yaml",
        gitlab: {
            url: "https://gitlab.example.com",
            feed_token: "t",
            feeds: ["group"],
            exclude_users: [],
            poll_interval: 30,
            events: [],
        },
        providers: {
            chat: {
                type: "openai",
                base_url: "https://api.example.com/v1",
                api_key: "sk_test",
                model: "gpt-4",
            },
            speech: {
                type: "openai",
                base_url: "https://api.example.com/v1",
                api_key: "sk_test",
                model: "tts-1",
                voice: "alloy",
                speed: 1,
            },
        },
        narrator: { personality: "test narrator" },
        authors: {
            "john.doe": { name: "John Doe", job_title: "Engineer" },
        },
        projects: {
            "org/repo": { name: "Repo", description: "test project" },
        },
        last_message: null,
    };
}

describe("Narrator.narrate", () => {
    test("returns empty result for zero events", async () => {
        const stub = new StubChatProvider("irrelevant");
        const narrator = new Narrator(makeConfig(), stub);
        const result = await narrator.narrate([]);
        expect(result.text).toBe("");
        expect(result.events).toEqual([]);
        expect(stub.calls).toHaveLength(0);
    });

    test("passes events and personality to chat provider", async () => {
        const stub = new StubChatProvider("A gentle push arrives.");
        const narrator = new Narrator(makeConfig(), stub);
        const events = [
            makeEvent({
                push_data: {
                    ref: "main",
                    commit_title: "Fix",
                    commit_count: 1,
                },
            }),
        ];
        const result = await narrator.narrate(events);
        expect(result.text).toBe("A gentle push arrives.");
        expect(stub.calls).toHaveLength(1);
        const system = stub.calls[0].messages[0];
        expect(system.role).toBe("system");
        expect(system.content).toContain("test narrator");
    });

    test("includes author and project context in system prompt", async () => {
        const stub = new StubChatProvider("out");
        const narrator = new Narrator(makeConfig(), stub);
        await narrator.narrate([
            makeEvent({
                push_data: { ref: "main", commit_title: "x", commit_count: 1 },
            }),
        ]);
        const system = stub.calls[0].messages[0].content;
        expect(system).toContain("John Doe");
        expect(system).toContain("Engineer");
        expect(system).toContain("test project");
    });

    test("builds alternating history into subsequent calls", async () => {
        const stub = new StubChatProvider("narration one");
        const narrator = new Narrator(makeConfig(), stub);
        const event = makeEvent({
            push_data: { ref: "main", commit_title: "x", commit_count: 1 },
        });
        await narrator.narrate([event]);
        // Second call should reference the prior assistant turn.
        stub.calls.length = 0;
        await narrator.narrate([event]);
        const roles = stub.calls[0].messages.map((m) => m.role);
        expect(roles).toContain("assistant");
    });

    test("history window caps at 6 entries", async () => {
        const stub = new StubChatProvider("resp");
        const narrator = new Narrator(makeConfig(), stub);
        const event = makeEvent({
            push_data: { ref: "main", commit_title: "x", commit_count: 1 },
        });
        for (let i = 0; i < 10; i++) await narrator.narrate([event]);
        stub.calls.length = 0;
        await narrator.narrate([event]);
        const assistantCount = stub.calls[0].messages.filter(
            (m) => m.role === "assistant",
        ).length;
        expect(assistantCount).toBeLessThanOrEqual(6);
    });
});

describe("Narrator.summarize", () => {
    test("returns empty result for zero events", async () => {
        const stub = new StubChatProvider("irrelevant");
        const narrator = new Narrator(makeConfig(), stub);
        const result = await narrator.summarize([], "1 hour");
        expect(result.text).toBe("");
        expect(stub.calls).toHaveLength(0);
    });

    test("mentions downtime and event count in user message", async () => {
        const stub = new StubChatProvider("catch-up summary");
        const narrator = new Narrator(makeConfig(), stub);
        const events = [
            makeEvent({
                push_data: { ref: "main", commit_title: "a", commit_count: 1 },
            }),
            makeEvent({
                push_data: { ref: "main", commit_title: "b", commit_count: 1 },
            }),
        ];
        await narrator.summarize(events, "3 hours");
        const user = stub.calls[0].messages.at(-1)?.content ?? "";
        expect(user).toContain("3 hours");
        expect(user).toContain("2 events");
    });
});

describe("describeEvents", () => {
    test("groups pushes by author + branch", () => {
        const events = [
            makeEvent({
                id: 1,
                push_data: {
                    ref: "main",
                    commit_title: "Fix bug",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 2,
                push_data: {
                    ref: "main",
                    commit_title: "Add test",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 3,
                push_data: {
                    ref: "main",
                    commit_title: "Update docs",
                    commit_count: 1,
                },
            }),
        ];
        const result = describeEvents(events);
        expect(result).toContain("john.doe pushed 3 commit(s) to main");
        expect(result).toContain("Fix bug");
        expect(result).toContain("Add test");
        expect(result).toContain("Update docs");
        // Should be a single line, not 3
        expect(result.split("\n")).toHaveLength(1);
    });

    test("keeps separate groups for different branches", () => {
        const events = [
            makeEvent({
                id: 1,
                push_data: {
                    ref: "main",
                    commit_title: "Fix A",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 2,
                push_data: {
                    ref: "develop",
                    commit_title: "Fix B",
                    commit_count: 1,
                },
            }),
        ];
        const result = describeEvents(events);
        const lines = result.split("\n");
        expect(lines).toHaveLength(2);
        expect(lines.some((l) => l.includes("to main"))).toBe(true);
        expect(lines.some((l) => l.includes("to develop"))).toBe(true);
    });

    test("keeps separate groups for different authors", () => {
        const events = [
            makeEvent({
                id: 1,
                author: "alice",
                push_data: {
                    ref: "main",
                    commit_title: "Fix A",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 2,
                author: "bob",
                push_data: {
                    ref: "main",
                    commit_title: "Fix B",
                    commit_count: 1,
                },
            }),
        ];
        const result = describeEvents(events);
        const lines = result.split("\n");
        expect(lines).toHaveLength(2);
        expect(lines.some((l) => l.includes("alice"))).toBe(true);
        expect(lines.some((l) => l.includes("bob"))).toBe(true);
    });

    test("mixes grouped pushes with other events", () => {
        const events = [
            makeEvent({
                id: 1,
                push_data: {
                    ref: "main",
                    commit_title: "Fix A",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 2,
                push_data: {
                    ref: "main",
                    commit_title: "Fix B",
                    commit_count: 1,
                },
            }),
            makeEvent({
                id: 3,
                action: "accepted merge request !42",
                target_type: "MergeRequest",
                target_title: "Feature X",
            }),
        ];
        const result = describeEvents(events);
        const lines = result.split("\n");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("pushed 2 commit(s) to main");
        expect(lines[1]).toContain("merge request");
    });

    test("sums commit counts across grouped pushes", () => {
        const events = [
            makeEvent({
                id: 1,
                push_data: {
                    ref: "main",
                    commit_title: "Batch 1",
                    commit_count: 3,
                },
            }),
            makeEvent({
                id: 2,
                push_data: {
                    ref: "main",
                    commit_title: "Batch 2",
                    commit_count: 5,
                },
            }),
        ];
        const result = describeEvents(events);
        expect(result).toContain("pushed 8 commit(s) to main");
    });
});
