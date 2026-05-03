import { describe, expect, test } from "bun:test";
import {
    loadConfig,
    normalizeList,
    parseInterval,
    resolveHome,
} from "./loader.ts";

describe("parseInterval", () => {
    test("passes through numbers", () => {
        expect(parseInterval(60)).toBe(60);
    });

    test("parses seconds string", () => {
        expect(parseInterval("30s")).toBe(30);
    });

    test("parses minutes string", () => {
        expect(parseInterval("5m")).toBe(300);
    });

    test("parses hours string", () => {
        expect(parseInterval("2h")).toBe(7200);
    });

    test("defaults bare number string to seconds", () => {
        expect(parseInterval("45")).toBe(45);
    });

    test("returns 30 for invalid string", () => {
        expect(parseInterval("abc")).toBe(30);
        expect(parseInterval("")).toBe(30);
    });
});

describe("normalizeList", () => {
    test("returns empty array for falsy input", () => {
        expect(normalizeList(null)).toEqual([]);
        expect(normalizeList(undefined)).toEqual([]);
        expect(normalizeList("")).toEqual([]);
        expect(normalizeList(0)).toEqual([]);
    });

    test("wraps single string in array", () => {
        expect(normalizeList("hello")).toEqual(["hello"]);
    });

    test("passes through arrays with string conversion", () => {
        expect(normalizeList(["a", "b"])).toEqual(["a", "b"]);
    });

    test("converts non-string array items to strings", () => {
        expect(normalizeList([1, 2, 3])).toEqual(["1", "2", "3"]);
    });

    test("wraps single number in array as string", () => {
        expect(normalizeList(42)).toEqual(["42"]);
    });
});

describe("resolveHome", () => {
    test("expands ~/ to HOME", () => {
        const home = process.env.HOME ?? "";
        expect(resolveHome("~/config.yaml")).toBe(`${home}/config.yaml`);
    });

    test("leaves absolute paths unchanged", () => {
        expect(resolveHome("/etc/config.yaml")).toBe("/etc/config.yaml");
    });

    test("leaves relative paths unchanged", () => {
        expect(resolveHome("./config.yaml")).toBe("./config.yaml");
    });

    test("only expands leading ~/", () => {
        expect(resolveHome("some/~/path")).toBe("some/~/path");
    });

    test("throws when HOME is unset", () => {
        const original = process.env.HOME;
        try {
            process.env.HOME = "";
            delete process.env.HOME;
            expect(() => resolveHome("~/config.yaml")).toThrow(
                "HOME is not set",
            );
        } finally {
            process.env.HOME = original;
        }
    });
});

describe("loadConfig validation", () => {
    async function withTempConfig(yaml: string): Promise<string> {
        const tmp = `${Bun.env.TMPDIR ?? "/tmp"}/test-config-${crypto.randomUUID()}.yaml`;
        await Bun.write(tmp, yaml);
        return tmp;
    }

    const providersYaml = `providers:
  chat:
    type: openai
    base_url: https://api.openai.com/v1
    api_key: sk_chat
    model: gpt-4o-mini
  speech:
    type: openai
    base_url: https://api.openai.com/v1
    api_key: sk_speech
    model: tts-1
    voice: alloy
`;

    function gitlabFeed(url = "https://gitlab.example.com"): string {
        return `feed:
  type: gitlab
  url: ${url}
  feed-token: abc
  feeds:
    - group
`;
    }

    function githubFeed(): string {
        return `feed:
  type: github
  feeds:
    - users/octocat
`;
    }

    test("rejects HTTP gitlab URLs", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed("http://gitlab.example.com")}${providersYaml}`,
        );
        try {
            await expect(loadConfig(tmp)).rejects.toThrow("must use HTTPS");
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("accepts HTTPS gitlab URLs", async () => {
        const tmp = await withTempConfig(`${gitlabFeed()}${providersYaml}`);
        try {
            const config = await loadConfig(tmp);
            if (config.feed.type === "gitlab") {
                expect(config.feed.url).toBe("https://gitlab.example.com");
            }
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("accepts http://localhost for local dev", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed("http://localhost:8080")}${providersYaml}`,
        );
        try {
            const config = await loadConfig(tmp);
            if (config.feed.type === "gitlab") {
                expect(config.feed.url).toBe("http://localhost:8080");
            }
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("accepts github feed type without token", async () => {
        const tmp = await withTempConfig(`${githubFeed()}${providersYaml}`);
        try {
            const config = await loadConfig(tmp);
            expect(config.feed.type).toBe("github");
            expect(config.feed.feeds).toEqual(["users/octocat"]);
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("rejects unknown feed.type", async () => {
        const tmp = await withTempConfig(
            `feed:\n  type: bitbucket\n  feeds:\n    - x\n${providersYaml}`,
        );
        try {
            await expect(loadConfig(tmp)).rejects.toThrow(
                'Unknown feed.type "bitbucket"',
            );
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("requires chat.api_key for openai provider type", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: openai\n    base_url: https://x/v1\n    model: m\n  speech:\n    type: openai\n    base_url: https://x/v1\n    api_key: s\n    model: tts\n    voice: alloy\n`,
        );
        try {
            await expect(loadConfig(tmp)).rejects.toThrow(
                "providers.chat.api_key",
            );
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("requires chat.base_url for openai provider type", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: openai\n    api_key: c\n    model: m\n  speech:\n    type: openai\n    base_url: https://x/v1\n    api_key: s\n    model: tts\n    voice: alloy\n`,
        );
        try {
            await expect(loadConfig(tmp)).rejects.toThrow(
                "providers.chat.base_url",
            );
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("claude-code chat provider does not require api_key", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: claude-code\n    model: haiku\n  speech:\n    type: openai\n    base_url: https://x/v1\n    api_key: s\n    model: tts\n    voice: alloy\n`,
        );
        try {
            const config = await loadConfig(tmp);
            expect(config.providers.chat.type).toBe("claude-code");
            if (config.providers.chat.type === "claude-code") {
                expect(config.providers.chat.model).toBe("haiku");
            }
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("requires speech.voice for openai", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: openai\n    base_url: https://x/v1\n    api_key: c\n    model: m\n  speech:\n    type: openai\n    base_url: https://x/v1\n    api_key: s\n    model: tts\n`,
        );
        try {
            await expect(loadConfig(tmp)).rejects.toThrow(
                "providers.speech.voice",
            );
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("parses gemini speech provider", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: openai\n    base_url: https://x/v1\n    api_key: c\n    model: m\n  speech:\n    type: gemini\n    api_key: g\n    voice: Puck\n    speed: 1.25\n`,
        );
        try {
            const config = await loadConfig(tmp);
            expect(config.providers.speech.type).toBe("gemini");
            expect(config.providers.speech.voice).toBe("Puck");
            expect(config.providers.speech.speed).toBe(1.25);
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("falls back to CHAT_API_KEY env var", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}providers:\n  chat:\n    type: openai\n    base_url: https://x/v1\n    model: m\n  speech:\n    type: openai\n    base_url: https://x/v1\n    api_key: s\n    model: tts\n    voice: alloy\n`,
        );
        const prev = process.env.CHAT_API_KEY;
        process.env.CHAT_API_KEY = "env-chat-key";
        try {
            const config = await loadConfig(tmp);
            if (config.providers.chat.type === "openai") {
                expect(config.providers.chat.api_key).toBe("env-chat-key");
            }
        } finally {
            if (prev === undefined) delete process.env.CHAT_API_KEY;
            else process.env.CHAT_API_KEY = prev;
            Bun.file(tmp).unlink();
        }
    });

    test("parses authors and projects maps", async () => {
        const tmp = await withTempConfig(
            `${gitlabFeed()}${providersYaml}authors:\n  alice:\n    name: Alice\n    job_title: SRE\nprojects:\n  team/app:\n    name: App\n    description: main app\n`,
        );
        try {
            const config = await loadConfig(tmp);
            expect(config.authors.alice).toEqual({
                name: "Alice",
                job_title: "SRE",
            });
            expect(config.projects["team/app"]).toEqual({
                name: "App",
                description: "main app",
            });
        } finally {
            Bun.file(tmp).unlink();
        }
    });

    test("legacy gitlab: block still works as alias for feed:", async () => {
        const tmp = await withTempConfig(
            `gitlab:\n  url: https://gitlab.example.com\n  feed-token: abc\n  feeds:\n    - group\n${providersYaml}`,
        );
        try {
            const config = await loadConfig(tmp);
            expect(config.feed.type).toBe("gitlab");
        } finally {
            Bun.file(tmp).unlink();
        }
    });
});
