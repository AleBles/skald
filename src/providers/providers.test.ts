import { describe, expect, test } from "bun:test";
import { ClaudeCodeChatProvider } from "./claude-code.ts";
import { GeminiSpeechProvider } from "./gemini.ts";
import { createChatProvider, createSpeechProvider } from "./index.ts";
import { OpenAIChatProvider, OpenAISpeechProvider } from "./openai.ts";

describe("createChatProvider", () => {
    test("returns OpenAIChatProvider for type: openai", () => {
        const p = createChatProvider({
            type: "openai",
            base_url: "https://api.example.com/v1",
            api_key: "sk_test",
            model: "gpt-4",
        });
        expect(p).toBeInstanceOf(OpenAIChatProvider);
    });

    test("returns ClaudeCodeChatProvider for type: claude-code", () => {
        const p = createChatProvider({
            type: "claude-code",
            model: "haiku",
        });
        expect(p).toBeInstanceOf(ClaudeCodeChatProvider);
    });

    test("claude-code provider accepts missing model", () => {
        const p = createChatProvider({ type: "claude-code" });
        expect(p).toBeInstanceOf(ClaudeCodeChatProvider);
    });
});

describe("createSpeechProvider", () => {
    test("returns OpenAISpeechProvider for type: openai", () => {
        const p = createSpeechProvider({
            type: "openai",
            base_url: "https://api.example.com/v1",
            api_key: "sk_test",
            model: "tts-1",
            voice: "alloy",
            speed: 1,
        });
        expect(p).toBeInstanceOf(OpenAISpeechProvider);
    });

    test("returns GeminiSpeechProvider for type: gemini", () => {
        const p = createSpeechProvider({
            type: "gemini",
            api_key: "g_test",
            model: "gemini-2.5-flash-preview-tts",
            voice: "Kore",
            speed: 1,
        });
        expect(p).toBeInstanceOf(GeminiSpeechProvider);
    });
});

describe("OpenAIChatProvider constructor", () => {
    test("throws when base_url is missing", () => {
        expect(
            () =>
                new OpenAIChatProvider({
                    type: "openai",
                    base_url: "",
                    api_key: "sk_test",
                    model: "gpt-4",
                }),
        ).toThrow("base_url is required");
    });

    test("throws when api_key is missing", () => {
        expect(
            () =>
                new OpenAIChatProvider({
                    type: "openai",
                    base_url: "https://api.example.com/v1",
                    api_key: "",
                    model: "gpt-4",
                }),
        ).toThrow("api_key is required");
    });
});

describe("OpenAISpeechProvider constructor", () => {
    test("throws when base_url is missing", () => {
        expect(
            () =>
                new OpenAISpeechProvider({
                    type: "openai",
                    base_url: "",
                    api_key: "sk_test",
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1,
                }),
        ).toThrow("base_url is required");
    });

    test("throws when api_key is missing", () => {
        expect(
            () =>
                new OpenAISpeechProvider({
                    type: "openai",
                    base_url: "https://api.example.com/v1",
                    api_key: "",
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1,
                }),
        ).toThrow("api_key is required");
    });
});

describe("GeminiSpeechProvider constructor", () => {
    test("throws when api_key is missing", () => {
        expect(
            () =>
                new GeminiSpeechProvider({
                    type: "gemini",
                    api_key: "",
                    model: "gemini-2.5-flash-preview-tts",
                    voice: "Kore",
                    speed: 1,
                }),
        ).toThrow("api_key is required");
    });
});
